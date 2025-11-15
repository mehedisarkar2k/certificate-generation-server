import { CertificateGeneratorFactory } from '../generators/factory/CertificateGeneratorFactory';
import {
    GenerationOptions,
    GenerationResult,
    DataRecord,
    ICertificateTemplate,
    PackageType,
} from '../types/certificate.types';
import { TemplateModel } from '../models/Template.model';
import { UserModel } from '../models/User.model';

/**
 * Service layer for certificate generation
 * Handles business logic, validation, and package limits
 */
export class CertificateService {
    /**
     * Generate certificates with template and data
     */
    async generateCertificates(
        options: GenerationOptions
    ): Promise<GenerationResult> {
        // Get template
        const template = await TemplateModel.findById(options.templateId);
        if (!template) {
            throw new Error(`Template not found: ${options.templateId}`);
        }

        if (!template.isActive) {
            throw new Error('Template is inactive');
        }

        // Get user
        const user = await UserModel.findById(options.userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (!user.isActive) {
            throw new Error('User account is inactive');
        }

        // Validate package limits
        await this.validatePackageLimits(
            user,
            options.dataRecords.length,
            options.packageType
        );

        // Convert template to ICertificateTemplate
        const certificateTemplate: ICertificateTemplate = {
            id: template.id,
            name: template.name,
            type: template.type,
            createdBy: String(template.createdBy),
            fields: template.fields,
            metadata: template.metadata,
        };

        // Get appropriate generator
        const generator = CertificateGeneratorFactory.getGenerator(template.type);

        // Generate certificates
        const result = await generator.generate(
            certificateTemplate,
            options.dataRecords,
            options
        );

        // Update user's usage
        await this.updateUserUsage(user, result.count);

        return result;
    }

    /**
     * Validate if user can generate requested number of certificates
     */
    private async validatePackageLimits(
        user: any,
        requestedCount: number,
        packageType: PackageType
    ): Promise<void> {
        const limits = this.getPackageLimits(packageType);

        if (user.certificatesRemaining < requestedCount) {
            throw new Error(
                `Insufficient certificates. You have ${user.certificatesRemaining} remaining, but requested ${requestedCount}. Package limit: ${limits.limit}`
            );
        }

        // For custom packages, check if they have explicit approval
        if (packageType === PackageType.CUSTOM) {
            // Custom logic for custom packages
            // Could check a separate approval or limit field
        }
    }

    /**
     * Update user's certificate usage
     */
    private async updateUserUsage(user: any, generatedCount: number): Promise<void> {
        user.certificatesGenerated += generatedCount;
        user.certificatesRemaining -= generatedCount;
        await user.save();
    }

    /**
     * Get package limits
     */
    getPackageLimits(packageType: PackageType) {
        const limits = {
            [PackageType.FREE]: { limit: 10, watermark: true },
            [PackageType.STANDARD]: { limit: 100, watermark: false },
            [PackageType.PREMIUM]: { limit: 1000, watermark: false },
            [PackageType.CUSTOM]: { limit: -1, watermark: false }, // -1 = unlimited/custom
        };

        return limits[packageType];
    }

    /**
     * Check available generators
     */
    getAvailableGenerators(): string[] {
        return CertificateGeneratorFactory.getRegisteredTypes();
    }

    /**
     * Validate template before saving
     */
    async validateTemplate(template: ICertificateTemplate): Promise<boolean> {
        const generator = CertificateGeneratorFactory.getGenerator(template.type);
        return generator.validateTemplate(template);
    }
}
