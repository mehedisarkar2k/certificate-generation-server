import { Router, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { requireAuth, AuthRequest } from '../middlewares/auth.middleware';
import { DataParserService } from '../services/dataParser.service';
import { UserModel } from '../models/User.model';
import { GenerationModel, GenerationStatus } from '../models/Generation.model';
import { certificateQueue } from '../queue/certificate.queue';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const dataParserService = new DataParserService();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/temp',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'));
        }
    },
});

/**
 * POST /api/certificates/generate
 * Generate certificates from template and data (async with worker)
 */
router.post(
    '/generate',
    requireAuth,
    upload.single('dataFile'),
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { templateId } = req.body;
            const dataFile = req.file;

            if (!templateId) {
                return res.status(400).json({ error: 'Template ID is required' });
            }

            if (!dataFile) {
                return res.status(400).json({ error: 'Data file is required' });
            }

            // Get user to check package
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Parse data file to get count
            const dataRecords = await dataParserService.parseDataFile(dataFile.path);

            if (dataRecords.length === 0) {
                await fs.promises.unlink(dataFile.path);
                return res.status(400).json({ error: 'No records found in data file' });
            }

            // Check if user has enough certificates
            if (user.certificatesRemaining < dataRecords.length) {
                await fs.promises.unlink(dataFile.path);
                return res.status(400).json({
                    error: `Insufficient certificates. You have ${user.certificatesRemaining} remaining, but requested ${dataRecords.length}`,
                });
            }

            // Save data file permanently for worker
            const permanentDir = 'uploads/data';
            await fs.promises.mkdir(permanentDir, { recursive: true });
            const permanentPath = path.join(
                permanentDir,
                `${uuidv4()}${path.extname(dataFile.originalname)}`
            );
            await fs.promises.rename(dataFile.path, permanentPath);

            // Create generation record
            const generation = await GenerationModel.create({
                userId,
                templateId,
                status: GenerationStatus.PENDING,
                totalCertificates: dataRecords.length,
                metadata: {
                    originalFileName: dataFile.originalname,
                },
            });

            // Add job to queue
            await certificateQueue.add({
                generationId: generation.id,
                templateId,
                userId,
                dataFilePath: permanentPath,
                packageType: user.packageType,
            });

            res.json({
                success: true,
                message: 'Certificate generation started',
                data: {
                    generationId: generation.id,
                    status: generation.status,
                    totalCertificates: generation.totalCertificates,
                },
            });
        } catch (error: any) {
            console.error('Certificate generation error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({
                error: error.message || 'Failed to start certificate generation',
            });
        }
    }
);

/**
 * GET /api/certificates/status/:generationId
 * Get generation status
 */
router.get(
    '/status/:generationId',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { generationId } = req.params;

            const generation = await GenerationModel.findOne({
                _id: generationId,
                userId,
            });

            if (!generation) {
                return res.status(404).json({ error: 'Generation not found' });
            }

            // Get job progress if still processing
            let progress = 0;
            if (generation.status === GenerationStatus.PROCESSING) {
                const jobs = await certificateQueue.getJobs(['active']);
                const job = jobs.find((j) => j.data.generationId === generationId);
                if (job) {
                    progress = certificateQueue.getJobProgress(job.id);
                }
            }

            res.json({
                success: true,
                data: {
                    ...generation.toObject(),
                    progress,
                },
            });
        } catch (error: any) {
            console.error('Get generation status error:', error);
            res.status(500).json({ error: 'Failed to get generation status' });
        }
    }
);

/**
 * GET /api/certificates/download/:generationId
 * Download generated certificate ZIP
 */
router.get(
    '/download/:generationId',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user!.id;
            const { generationId } = req.params;

            const generation = await GenerationModel.findOne({
                _id: generationId,
                userId,
            });

            if (!generation) {
                return res.status(404).json({ error: 'Generation not found' });
            }

            if (generation.status !== GenerationStatus.COMPLETED) {
                return res.status(400).json({
                    error: 'Generation not completed yet',
                    status: generation.status,
                });
            }

            if (!generation.zipPath) {
                return res.status(404).json({ error: 'ZIP file not found' });
            }

            // Check if file exists
            try {
                await fs.promises.access(generation.zipPath);
            } catch {
                return res.status(404).json({ error: 'ZIP file not found on server' });
            }

            res.download(generation.zipPath, (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
            });
        } catch (error: any) {
            console.error('Download error:', error);
            res.status(500).json({ error: 'Failed to download file' });
        }
    }
);

/**
 * GET /api/certificates/history
 * Get generation history for user
 */
router.get('/history', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { page = 1, limit = 20 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const [generations, total] = await Promise.all([
            GenerationModel.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('templateId', 'name type'),
            GenerationModel.countDocuments({ userId }),
        ]);

        res.json({
            success: true,
            data: generations,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

/**
 * POST /api/certificates/preview-fields
 * Extract field names from uploaded data file
 */
router.post(
    '/preview-fields',
    requireAuth,
    upload.single('dataFile'),
    async (req: AuthRequest, res: Response) => {
        try {
            const dataFile = req.file;

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
            });
        } catch (error: any) {
            console.error('Field extraction error:', error);

            if (req.file?.path) {
                try {
                    await fs.promises.unlink(req.file.path);
                } catch { }
            }

            res.status(500).json({
                error: error.message || 'Failed to extract fields',
            });
        }
    }
);

/**
 * GET /api/certificates/usage
 * Get user's certificate usage stats
 */
router.get('/usage', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { CertificateService } = await import('../services/certificate.service');
        const certificateService = new CertificateService();
        const limits = certificateService.getPackageLimits(user.packageType);

        res.json({
            success: true,
            data: {
                packageType: user.packageType,
                certificatesRemaining: user.certificatesRemaining,
                certificatesGenerated: user.certificatesGenerated,
                packageLimit: limits.limit,
                hasWatermark: limits.watermark,
            },
        });
    } catch (error: any) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage stats' });
    }
});

export default router;
