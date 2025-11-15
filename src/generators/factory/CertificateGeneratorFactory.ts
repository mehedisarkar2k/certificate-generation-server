import { CertificateGenerator } from '../base/CertificateGenerator';
import { ImageCertificateGenerator } from '../image/ImageCertificateGenerator';
import { TemplateType } from '../../types/certificate.types';

/**
 * Factory Pattern for creating certificate generators
 * Makes it easy to add new template types (HTML, SVG, etc.)
 */
export class CertificateGeneratorFactory {
    private static generators: Map<string, CertificateGenerator> = new Map();

    /**
     * Register a generator for a specific template type
     */
    static register(type: string, generator: CertificateGenerator): void {
        this.generators.set(type.toLowerCase(), generator);
    }

    /**
     * Get a generator for a specific template type
     */
    static getGenerator(type: string | TemplateType): CertificateGenerator {
        const typeKey = typeof type === 'string' ? type.toLowerCase() : type;
        const generator = this.generators.get(typeKey);

        if (!generator) {
            throw new Error(
                `No generator registered for template type: ${type}. Available types: ${Array.from(
                    this.generators.keys()
                ).join(', ')}`
            );
        }

        return generator;
    }

    /**
     * Check if a generator exists for a type
     */
    static hasGenerator(type: string | TemplateType): boolean {
        const typeKey = typeof type === 'string' ? type.toLowerCase() : type;
        return this.generators.has(typeKey);
    }

    /**
     * Get all registered generator types
     */
    static getRegisteredTypes(): string[] {
        return Array.from(this.generators.keys());
    }

    /**
     * Initialize with default generators
     */
    static initialize(): void {
        // Register image generator
        this.register(TemplateType.IMAGE, new ImageCertificateGenerator());

        // Future: Register HTML generator
        // this.register(TemplateType.HTML, new HtmlCertificateGenerator());
    }
}

// Auto-initialize on import
CertificateGeneratorFactory.initialize();
