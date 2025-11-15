import {
    ICertificateTemplate,
    DataRecord,
    GenerationResult,
    GenerationOptions,
} from '../../types/certificate.types';

/**
 * Abstract base class for certificate generators
 * This enables the Strategy Pattern for different template types
 */
export abstract class CertificateGenerator {
    /**
     * Generate certificates based on template and data
     */
    abstract generate(
        template: ICertificateTemplate,
        dataRecords: DataRecord[],
        options: GenerationOptions
    ): Promise<GenerationResult>;

    /**
     * Validate template structure
     */
    abstract validateTemplate(template: ICertificateTemplate): Promise<boolean>;

    /**
     * Get supported template type
     */
    abstract getSupportedType(): string;

    /**
     * Generate a single certificate
     */
    protected abstract generateSingle(
        template: ICertificateTemplate,
        record: DataRecord,
        outputPath: string,
        options: GenerationOptions
    ): Promise<string>;

    /**
     * Apply watermark for free packages
     */
    protected applyWatermark(
        packageType: string,
        content: any
    ): any {
        // Override in subclasses if needed
        return content;
    }
}
