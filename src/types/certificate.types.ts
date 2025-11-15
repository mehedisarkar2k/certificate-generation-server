/**
 * Base interface for template engines
 * This allows for different types of certificate generation (Image, HTML, etc.)
 */
export interface ICertificateTemplate {
    id: string;
    name: string;
    type: TemplateType;
    createdBy: string;
    fields: FieldMapping[];
    fonts?: FontData[];
    metadata: Record<string, any>;
}

export enum TemplateType {
    IMAGE = 'image',
    HTML = 'html',
    // Future: PDF, SVG, etc.
}

export interface FieldMapping {
    csvColumn: string;
    x: number;
    y: number;
    fontSize: number;
    font?: string;
    color?: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
}

export interface FontData {
    id: string;
    name: string;
    path: string;
    uploadedBy: string;
}

export interface DataRecord {
    [key: string]: string | number;
}

export interface GenerationOptions {
    templateId: string;
    dataRecords: DataRecord[];
    userId: string;
    packageType: PackageType;
}

export interface GenerationResult {
    certificates: GeneratedCertificate[];
    zipPath: string;
    batchDir: string;
    count: number;
}

export interface GeneratedCertificate {
    name: string;
    path: string;
    data: DataRecord;
}

export enum PackageType {
    FREE = 'free',
    STANDARD = 'standard',
    PREMIUM = 'premium',
    CUSTOM = 'custom',
}

export interface PackageLimit {
    type: PackageType;
    limit: number;
    watermark: boolean;
}
