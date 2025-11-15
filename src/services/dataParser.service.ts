import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { DataRecord } from '../types/certificate.types';

/**
 * Service for parsing different data file formats
 * Supports CSV and Excel files
 */
export class DataParserService {
    /**
     * Parse uploaded data file
     */
    async parseDataFile(filePath: string, fileType?: string): Promise<DataRecord[]> {
        const ext = fileType || path.extname(filePath).toLowerCase();

        switch (ext) {
            case '.csv':
                return this.parseCsv(filePath);
            case '.xlsx':
            case '.xls':
                return this.parseExcel(filePath);
            default:
                throw new Error(`Unsupported file type: ${ext}`);
        }
    }

    /**
     * Parse CSV file
     */
    private async parseCsv(filePath: string): Promise<DataRecord[]> {
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');

        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        return records;
    }

    /**
     * Parse Excel file
     */
    private async parseExcel(filePath: string): Promise<DataRecord[]> {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
            throw new Error('Excel file has no sheets');
        }

        const worksheet = workbook.Sheets[sheetName];
        const records = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            defval: '',
        });

        return records as DataRecord[];
    }

    /**
     * Extract field names from data file
     */
    async extractFieldNames(filePath: string, fileType?: string): Promise<string[]> {
        const records = await this.parseDataFile(filePath, fileType);

        if (records.length === 0) {
            return [];
        }

        return Object.keys(records[0]);
    }

    /**
     * Validate data records
     */
    validateRecords(records: DataRecord[], requiredFields: string[]): boolean {
        if (records.length === 0) {
            throw new Error('No records found in data file');
        }

        const firstRecord = records[0];
        const availableFields = Object.keys(firstRecord);

        for (const field of requiredFields) {
            if (!availableFields.includes(field)) {
                throw new Error(`Required field '${field}' not found in data`);
            }
        }

        return true;
    }
}
