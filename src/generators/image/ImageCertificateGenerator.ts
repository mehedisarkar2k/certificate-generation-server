import { CertificateGenerator } from '../base/CertificateGenerator';
import {
    ICertificateTemplate,
    DataRecord,
    GenerationResult,
    GenerationOptions,
    GeneratedCertificate,
    PackageType,
} from '../../types/certificate.types';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

/**
 * Image-based certificate generator
 * Generates certificates from image templates with overlaid text
 */
export class ImageCertificateGenerator extends CertificateGenerator {
    private readonly outputBaseDir = 'output';

    getSupportedType(): string {
        return 'image';
    }

    async validateTemplate(template: ICertificateTemplate): Promise<boolean> {
        if (template.type !== 'image') {
            throw new Error('Template type must be "image"');
        }

        if (!template.metadata?.imagePath) {
            throw new Error('Image template must have imagePath in metadata');
        }

        // Check if image exists
        const imagePath = template.metadata.imagePath;
        try {
            await fs.promises.access(imagePath);
            return true;
        } catch {
            throw new Error(`Template image not found at: ${imagePath}`);
        }
    }

    async generate(
        template: ICertificateTemplate,
        dataRecords: DataRecord[],
        options: GenerationOptions
    ): Promise<GenerationResult> {
        await this.validateTemplate(template);

        // Create output directory
        const batchId = `batch-${Date.now()}`;
        const batchDir = path.join(this.outputBaseDir, batchId);
        await fs.promises.mkdir(batchDir, { recursive: true });

        const certificates: GeneratedCertificate[] = [];

        // Generate each certificate
        for (let i = 0; i < dataRecords.length; i++) {
            const record = dataRecords[i];
            const fileName = this.generateFileName(record, i);
            const outputPath = path.join(batchDir, fileName);

            await this.generateSingle(template, record, outputPath, options);

            certificates.push({
                name: fileName,
                path: outputPath,
                data: record,
            });
        }

        // Create ZIP archive
        const zipPath = path.join(
            this.outputBaseDir,
            `certificates-${Date.now()}.zip`
        );
        await this.createZipArchive(batchDir, zipPath);

        return {
            certificates,
            zipPath,
            batchDir,
            count: certificates.length,
        };
    }

    protected async generateSingle(
        template: ICertificateTemplate,
        record: DataRecord,
        outputPath: string,
        options: GenerationOptions
    ): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const imagePath = template.metadata.imagePath;
                const { width, height } = await this.getImageDimensions(imagePath);

                // Create PDF document
                const doc = new PDFDocument({
                    size: [width, height],
                    margin: 0,
                });

                const writeStream = fs.createWriteStream(outputPath);
                doc.pipe(writeStream);

                // Add template image as background
                doc.image(imagePath, 0, 0, {
                    width,
                    height,
                });

                // Add text fields
                await this.addTextFields(doc, template, record, width, height);

                // Add watermark for free package
                if (options.packageType === PackageType.FREE) {
                    this.addFreeWatermark(doc, width, height);
                }

                doc.end();

                writeStream.on('finish', () => resolve(outputPath));
                writeStream.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    private async addTextFields(
        doc: PDFKit.PDFDocument,
        template: ICertificateTemplate,
        record: DataRecord,
        width: number,
        height: number
    ): Promise<void> {
        for (const mapping of template.fields) {
            const value = String(record[mapping.csvColumn] || '');
            if (!value) continue;

            // Set font
            const fontName = mapping.font || 'Helvetica-Bold';
            const fontSize = mapping.fontSize || 36;

            // Handle custom fonts
            if (fontName.endsWith('.ttf') || fontName.endsWith('.otf')) {
                const fontPath = path.join('fonts', fontName);
                try {
                    await fs.promises.access(fontPath);
                    doc.font(fontPath).fontSize(fontSize);
                } catch {
                    console.warn(
                        `Custom font not found at ${fontPath}, using Helvetica-Bold`
                    );
                    doc.font('Helvetica-Bold').fontSize(fontSize);
                }
            } else {
                doc.font(fontName).fontSize(fontSize);
            }

            // Set color
            const color = mapping.color || '#000000';
            doc.fillColor(color);

            // Calculate position (adjust for baseline)
            const textX = mapping.x;
            const textY = mapping.y - fontSize * 0.75;
            const maxWidth = mapping.width || width - mapping.x - 50;
            const align = mapping.align || 'left';

            // Render text
            doc.text(value, textX, textY, {
                width: maxWidth,
                align: align,
            });
        }
    }

    private addFreeWatermark(
        doc: PDFKit.PDFDocument,
        width: number,
        height: number
    ): void {
        doc
            .save()
            .opacity(0.3)
            .fontSize(48)
            .font('Helvetica-Bold')
            .fillColor('#FF0000')
            .text('FREE', width - 200, height - 80, {
                width: 180,
                align: 'center',
            })
            .restore();
    }

    private async getImageDimensions(
        imagePath: string
    ): Promise<{ width: number; height: number }> {
        const Jimp = (await import('jimp')).default;
        const image = await Jimp.read(imagePath);
        return {
            width: image.bitmap.width,
            height: image.bitmap.height,
        };
    }

    private generateFileName(record: DataRecord, index: number): string {
        const nameField =
            record.name ||
            record.Name ||
            record.fullname ||
            record.FullName ||
            `record-${index + 1}`;
        const sanitized = String(nameField)
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .substring(0, 50);
        return `certificate-${sanitized}-${uuidv4().substring(0, 8)}.pdf`;
    }

    private async createZipArchive(
        sourceDir: string,
        outputPath: string
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve(outputPath));
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    protected applyWatermark(packageType: string, content: any): any {
        // Watermark is applied during PDF generation
        return content;
    }
}
