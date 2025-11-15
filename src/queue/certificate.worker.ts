import { certificateQueue, CertificateJobData } from './certificate.queue';
import { GenerationModel, GenerationStatus } from '../models/Generation.model';
import { CertificateService } from '../services/certificate.service';
import { DataParserService } from '../services/dataParser.service';
import { GenerationOptions, PackageType } from '../types/certificate.types';
import * as fs from 'fs';

const certificateService = new CertificateService();
const dataParserService = new DataParserService();

interface Job<T> {
    id: string;
    data: T;
    progress: (value: number) => void;
    attemptsMade: number;
}

certificateQueue.process(async (job: Job<CertificateJobData>) => {
    const { generationId, templateId, userId, dataFilePath, packageType } = job.data;

    console.log(`Processing certificate generation job ${job.id} for generation ${generationId}`);

    try {
        // Update status to processing
        await GenerationModel.findByIdAndUpdate(generationId, {
            status: GenerationStatus.PROCESSING,
        });

        // Parse data file
        const dataRecords = await dataParserService.parseDataFile(dataFilePath);

        if (dataRecords.length === 0) {
            throw new Error('No records found in data file');
        }

        // Update progress
        await job.progress(10);

        // Prepare generation options
        const options: GenerationOptions = {
            templateId,
            dataRecords,
            userId,
            packageType: packageType as PackageType,
        };

        // Generate certificates
        const result = await certificateService.generateCertificates(options);

        // Update progress
        await job.progress(90);

        // Update generation record
        await GenerationModel.findByIdAndUpdate(generationId, {
            status: GenerationStatus.COMPLETED,
            processedCertificates: result.count,
            zipPath: result.zipPath,
            batchDir: result.batchDir,
            completedAt: new Date(),
        });

        // Clean up data file
        try {
            await fs.promises.unlink(dataFilePath);
        } catch (error) {
            console.warn('Failed to delete data file:', error);
        }

        await job.progress(100);

        console.log(`Completed certificate generation job ${job.id}`);

        return {
            success: true,
            generationId,
            count: result.count,
            zipPath: result.zipPath,
        };
    } catch (error: any) {
        console.error(`Failed certificate generation job ${job.id}:`, error);

        // Update generation record with error
        await GenerationModel.findByIdAndUpdate(generationId, {
            status: GenerationStatus.FAILED,
            errorMessage: error.message,
        });

        // Clean up data file on error
        try {
            await fs.promises.unlink(dataFilePath);
        } catch { }

        throw error;
    }
});

// Event listeners
certificateQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result);
});

certificateQueue.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
});

certificateQueue.on('stalled', (job) => {
    console.warn(`Job ${job.id} stalled`);
});

export { certificateQueue };
