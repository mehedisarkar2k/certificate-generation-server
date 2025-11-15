import { Router, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import { TemplateModel } from '../models/Template.model';
import { FontModel } from '../models/Font.model';
import { TelegramService } from '../services/telegram.service';
import { DataParserService } from '../services/dataParser.service';
import { TemplateType } from '../types/certificate.types';

const router = Router();
const telegramService = new TelegramService();
const dataParserService = new DataParserService();

// Configure multer for template image uploads
const upload = multer({
    dest: 'uploads/temp',
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.png', '.jpg', '.jpeg', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (PNG, JPG, JPEG, WEBP)'));
        }
    },
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post(
    '/',
    requireAuth,
    upload.single('templateImage'),
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { name, type, fields, fontIds, metadata } = req.body;
            const templateImage = req.file;

            if (!name || !type) {
                return res.status(400).json({ error: 'Name and type are required' });
            }

            if (!Object.values(TemplateType).includes(type)) {
                return res.status(400).json({ error: 'Invalid template type' });
            }

            if (!templateImage) {
                return res.status(400).json({ error: 'Template image is required' });
            }

            // Upload image to Telegram
            const telegramFileId = await telegramService.uploadImage(templateImage.path);

            // Parse fields if provided as JSON string
            let parsedFields = [];
            if (fields) {
                try {
                    parsedFields = JSON.parse(fields);
                } catch {
                    parsedFields = [];
                }
            }

            // Parse fontIds if provided
            let parsedFontIds = [];
            if (fontIds) {
                try {
                    parsedFontIds = JSON.parse(fontIds);
                } catch {
                    parsedFontIds = [];
                }
            }

            // Parse metadata
            let parsedMetadata = {};
            if (metadata) {
                try {
                    parsedMetadata = JSON.parse(metadata);
                } catch {
                    parsedMetadata = {};
                }
            }

            // Create template
            const template = await TemplateModel.create({
                name,
                type,
                createdBy: userId,
                fields: parsedFields,
                fontIds: parsedFontIds,
                metadata: {
                    ...parsedMetadata,
                    telegramFileId,
                    originalFileName: templateImage.originalname,
                },
            });

            // Clean up uploaded file
            await fs.promises.unlink(templateImage.path);

            res.status(201).json({
                success: true,
                message: 'Template created successfully',
                data: template,
            });
        } catch (error: any) {
            console.error('Create template error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({
                error: error.message || 'Failed to create template',
            });
        }
    }
);

/**
 * GET /api/templates
 * Get all templates for authenticated user
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const templates = await TemplateModel.find({
            createdBy: userId,
            isActive: true,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: templates.length,
            data: templates,
        });
    } catch (error: any) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

/**
 * GET /api/templates/:id
 * Get template details with preview
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const template = await TemplateModel.findOne({
            _id: id,
            createdBy: userId,
            isActive: true,
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Get attached fonts
        const fonts = await FontModel.find({
            _id: { $in: template.fontIds },
            uploadedBy: userId,
            isActive: true,
        });

        // Get preview URL from Telegram
        let previewUrl = null;
        if (template.metadata?.telegramFileId) {
            try {
                previewUrl = await telegramService.getFileUrl(template.metadata.telegramFileId);
            } catch (error) {
                console.warn('Failed to get preview URL:', error);
            }
        }

        res.json({
            success: true,
            data: {
                template,
                fonts,
                previewUrl,
            },
        });
    } catch (error: any) {
        console.error('Get template error:', error);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

/**
 * PUT /api/templates/:id
 * Update template
 */
router.put(
    '/:id',
    requireAuth,
    upload.single('templateImage'),
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const { name, fields, fontIds, metadata } = req.body;
            const templateImage = req.file;

            const template = await TemplateModel.findOne({
                _id: id,
                createdBy: userId,
                isActive: true,
            });

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            // Update fields
            if (name) template.name = name;

            if (fields) {
                try {
                    template.fields = JSON.parse(fields);
                } catch { }
            }

            if (fontIds) {
                try {
                    template.fontIds = JSON.parse(fontIds);
                } catch { }
            }

            // Update metadata
            if (metadata) {
                try {
                    template.metadata = { ...template.metadata, ...JSON.parse(metadata) };
                } catch { }
            }

            // Upload new image if provided
            if (templateImage) {
                const telegramFileId = await telegramService.uploadImage(templateImage.path);
                template.metadata = {
                    ...template.metadata,
                    telegramFileId,
                    originalFileName: templateImage.originalname,
                };
                await fs.promises.unlink(templateImage.path);
            }

            await template.save();

            res.json({
                success: true,
                message: 'Template updated successfully',
                data: template,
            });
        } catch (error: any) {
            console.error('Update template error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({ error: 'Failed to update template' });
        }
    }
);

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { deleteFonts } = req.query;

        const template = await TemplateModel.findOne({
            _id: id,
            createdBy: userId,
            isActive: true,
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check if fonts should be deleted
        if (deleteFonts === 'true' && template.fontIds.length > 0) {
            // Check if fonts are used by other templates
            const fontsToDelete = [];

            for (const fontId of template.fontIds) {
                const otherTemplates = await TemplateModel.countDocuments({
                    _id: { $ne: id },
                    createdBy: userId,
                    fontIds: fontId,
                    isActive: true,
                });

                if (otherTemplates === 0) {
                    fontsToDelete.push(fontId);
                }
            }

            // Delete unused fonts
            if (fontsToDelete.length > 0) {
                await FontModel.updateMany(
                    { _id: { $in: fontsToDelete }, uploadedBy: userId },
                    { isActive: false }
                );
            }
        }

        // Soft delete template
        template.isActive = false;
        await template.save();

        res.json({
            success: true,
            message: 'Template deleted successfully',
        });
    } catch (error: any) {
        console.error('Delete template error:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

/**
 * POST /api/templates/:id/preview-fields
 * Extract field names from uploaded data file for template mapping
 */
router.post(
    '/:id/preview-fields',
    requireAuth,
    upload.single('dataFile'),
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { id } = req.params;
            const dataFile = req.file;

            const template = await TemplateModel.findOne({
                _id: id,
                createdBy: userId,
                isActive: true,
            });

            if (!template) {
                return res.status(404).json({ error: 'Template not found' });
            }

            if (!dataFile) {
                return res.status(400).json({ error: 'Data file is required' });
            }

            // Extract field names
            const fieldNames = await dataParserService.extractFieldNames(dataFile.path);

            // Clean up uploaded file
            await fs.promises.unlink(dataFile.path);

            res.json({
                success: true,
                fields: fieldNames,
                currentMapping: template.fields,
            });
        } catch (error: any) {
            console.error('Preview fields error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({ error: 'Failed to preview fields' });
        }
    }
);

export default router;
