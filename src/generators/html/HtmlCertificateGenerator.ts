import { CertificateGenerator } from '../base/CertificateGenerator';
import {
    ICertificateTemplate,
    DataRecord,
    GenerationResult,
    GenerationOptions,
    GeneratedCertificate,
    PackageType,
} from '../../types/certificate.types';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

/**
 * HTML-based certificate generator (Future implementation)
 * Generates certificates from HTML templates
 * 
 * This is a placeholder implementation showing how to extend
 * the system with new template types
 */
export class HtmlCertificateGenerator extends CertificateGenerator {
    private readonly outputBaseDir = 'output';

    getSupportedType(): string {
        return 'html';
    }

    async validateTemplate(template: ICertificateTemplate): Promise<boolean> {
        if (template.type !== 'html') {
            throw new Error('Template type must be "html"');
        }

        if (!template.metadata?.htmlContent && !template.metadata?.htmlPath) {
            throw new Error('HTML template must have htmlContent or htmlPath in metadata');
        }

        return true;
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
        // Get HTML template content
        let htmlContent = template.metadata.htmlContent;

        if (!htmlContent && template.metadata.htmlPath) {
            htmlContent = await fs.promises.readFile(
                template.metadata.htmlPath,
                'utf-8'
            );
        }

        // Replace template variables
        let processedHtml = this.processTemplateVariables(htmlContent, record);

        // Add watermark for free package
        if (options.packageType === PackageType.FREE) {
            processedHtml = this.addFreeWatermarkHtml(processedHtml);
        }

        // TODO: Convert HTML to PDF using puppeteer or similar
        // For now, just save as HTML
        const htmlOutputPath = outputPath.replace('.pdf', '.html');
        await fs.promises.writeFile(htmlOutputPath, processedHtml, 'utf-8');

        return htmlOutputPath;
    }

    private processTemplateVariables(
        html: string,
        record: DataRecord
    ): string {
        let processed = html;

        // Replace {{fieldName}} with actual values
        for (const [key, value] of Object.entries(record)) {
            const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            processed = processed.replace(placeholder, String(value));
        }

        return processed;
    }

    private addFreeWatermarkHtml(html: string): string {
        const watermarkStyle = `
      <style>
        .free-watermark {
          position: fixed;
          bottom: 20px;
          right: 20px;
          font-size: 48px;
          font-weight: bold;
          color: rgba(255, 0, 0, 0.3);
          z-index: 9999;
          pointer-events: none;
        }
      </style>
    `;

        const watermarkHtml = `
      <div class="free-watermark">FREE</div>
    `;

        // Insert before closing body tag
        return html.replace(
            '</body>',
            `${watermarkStyle}${watermarkHtml}</body>`
        );
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
}
