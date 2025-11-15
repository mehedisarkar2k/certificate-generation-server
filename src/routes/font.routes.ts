import { Router, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import { FontModel } from '../models/Font.model';
import { TemplateModel } from '../models/Template.model';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configure multer for font uploads
const upload = multer({
    dest: 'uploads/temp',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.ttf', '.otf', '.woff', '.woff2'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only font files are allowed (TTF, OTF, WOFF, WOFF2)'));
        }
    },
});

/**
 * POST /api/fonts
 * Upload a new font
 */
router.post(
    '/',
    requireAuth,
    upload.single('fontFile'),
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { name } = req.body;
            const fontFile = req.file;

            if (!fontFile) {
                return res.status(400).json({ error: 'Font file is required' });
            }

            const fontName = name || path.parse(fontFile.originalname).name;

            // Read font file and convert to base64
            const fontBuffer = await fs.promises.readFile(fontFile.path);
            const fontData = fontBuffer.toString('base64');

            // Determine MIME type
            const ext = path.extname(fontFile.originalname).toLowerCase();
            const mimeTypes: Record<string, string> = {
                '.ttf': 'font/ttf',
                '.otf': 'font/otf',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
            };
            const mimeType = mimeTypes[ext] || 'application/octet-stream';

            // Create font record with base64 data
            const font = await FontModel.create({
                name: fontName,
                fileName: fontFile.originalname,
                fontData,
                mimeType,
                uploadedBy: userId,
                metadata: {
                    originalName: fontFile.originalname,
                    size: fontFile.size,
                },
            });

            // Clean up uploaded file
            await fs.promises.unlink(fontFile.path);

            res.status(201).json({
                success: true,
                message: 'Font uploaded successfully',
                data: font,
            });
        } catch (error: any) {
            console.error('Upload font error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({ error: 'Failed to upload font' });
        }
    }
);

/**
 * GET /api/fonts/:fontId/download
 * Download font file
 */
router.get(
    '/:fontId/download',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { fontId } = req.params;

            const font = await FontModel.findOne({
                _id: fontId,
                uploadedBy: userId,
            });

            if (!font) {
                return res.status(404).json({ error: 'Font not found' });
            }

            // Convert base64 back to buffer
            const fontBuffer = Buffer.from(font.fontData, 'base64');

            // Set appropriate headers
            res.setHeader('Content-Type', font.mimeType);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${font.fileName}"`
            );
            res.setHeader('Content-Length', fontBuffer.length);

            res.send(fontBuffer);
        } catch (error: any) {
            console.error('Download font error:', error);
            res.status(500).json({ error: 'Failed to download font' });
        }
    }
);

/**
 * GET /api/fonts
 * Get all fonts for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const fonts = await FontModel.find({
            uploadedBy: userId,
            isActive: true,
        })
            .select('-fontData') // Exclude base64 data from list
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: fonts.length,
            data: fonts,
        });
    } catch (error: any) {
        console.error('Get fonts error:', error);
        res.status(500).json({ error: 'Failed to get fonts' });
    }
});

/**
 * GET /api/fonts/:id
 * Get font details (only owner can access)
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const font = await FontModel.findOne({
            _id: id,
            uploadedBy: userId,
            isActive: true,
        });

        if (!font) {
            return res.status(404).json({ error: 'Font not found' });
        }

        res.json({
            success: true,
            data: font,
        });
    } catch (error: any) {
        console.error('Get font error:', error);
        res.status(500).json({ error: 'Failed to get font' });
    }
});

/**
 * DELETE /api/fonts/:id
 * Delete a font (only if not attached to any template)
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const font = await FontModel.findOne({
            _id: id,
            uploadedBy: userId,
            isActive: true,
        });

        if (!font) {
            return res.status(404).json({ error: 'Font not found' });
        }

        // Check if font is attached to any template
        const templatesUsingFont = await TemplateModel.countDocuments({
            fontIds: id,
            createdBy: userId,
            isActive: true,
        });

        if (templatesUsingFont > 0) {
            return res.status(400).json({
                error: 'Cannot delete font that is attached to templates',
                templatesCount: templatesUsingFont,
            });
        }

        // Soft delete font
        font.isActive = false;
        await font.save();

        res.json({
            success: true,
            message: 'Font deleted successfully',
        });
    } catch (error: any) {
        console.error('Delete font error:', error);
        res.status(500).json({ error: 'Failed to delete font' });
    }
});

/**
 * GET /api/fonts/:id/download
 * Download font file (only owner can access)
 */
router.get('/:id/download', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const font = await FontModel.findOne({
            _id: id,
            uploadedBy: userId,
            isActive: true,
        });

        if (!font) {
            return res.status(404).json({ error: 'Font not found' });
        }

        res.json({
            success: true,
            data: font,
        });
    } catch (error: any) {
        console.error('Get font details error:', error);
        res.status(500).json({ error: 'Failed to get font details' });
    }
});

export default router;
