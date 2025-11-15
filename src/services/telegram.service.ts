import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

export class TelegramService {
    private botToken: string;
    private chatId: string;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';

        if (!this.botToken || !this.chatId) {
            console.warn('Telegram credentials not configured');
        }
    }

    /**
     * Upload image to Telegram and get file_id
     */
    async uploadImage(filePath: string): Promise<string> {
        if (!this.botToken || !this.chatId) {
            throw new Error('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
        }

        try {
            const form = new FormData();
            form.append('chat_id', this.chatId);
            form.append('photo', fs.createReadStream(filePath));

            const response = await axios.post(
                `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
                form,
                {
                    headers: form.getHeaders(),
                }
            );

            if (!response.data.ok) {
                throw new Error(`Telegram API error: ${response.data.description}`);
            }

            // Get the largest photo size
            const photos = response.data.result.photo;
            const largestPhoto = photos[photos.length - 1];

            return largestPhoto.file_id;
        } catch (error: any) {
            console.error('Telegram upload error:', error);
            throw new Error(`Failed to upload image to Telegram: ${error.message}`);
        }
    }

    /**
     * Get file URL from file_id
     */
    async getFileUrl(fileId: string): Promise<string> {
        if (!this.botToken) {
            throw new Error('Telegram not configured');
        }

        try {
            const response = await axios.get(
                `https://api.telegram.org/bot${this.botToken}/getFile`,
                {
                    params: { file_id: fileId },
                }
            );

            if (!response.data.ok) {
                throw new Error(`Telegram API error: ${response.data.description}`);
            }

            const filePath = response.data.result.file_path;
            return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
        } catch (error: any) {
            console.error('Telegram getFile error:', error);
            throw new Error(`Failed to get file URL: ${error.message}`);
        }
    }

    /**
     * Download image from Telegram
     */
    async downloadImage(fileId: string, outputPath: string): Promise<string> {
        const fileUrl = await this.getFileUrl(fileId);

        const response = await axios.get(fileUrl, {
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }
}
