import { Router, Response } from 'express';
import { requireAdmin, AuthRequest } from '../middlewares/auth.middleware';
import { UserModel } from '../models/User.model';
import { GenerationModel } from '../models/Generation.model';
import { TemplateModel } from '../models/Template.model';
import { PackageType } from '../types/certificate.types';

const router = Router();

/**
 * GET /api/admin/stats
 * Get overall system statistics
 */
router.get('/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const [totalUsers, totalGenerations, totalTemplates, activeGenerations] =
            await Promise.all([
                UserModel.countDocuments(),
                GenerationModel.countDocuments(),
                TemplateModel.countDocuments({ isActive: true }),
                GenerationModel.countDocuments({
                    status: { $in: ['pending', 'processing'] },
                }),
            ]);

        // Package distribution
        const packageStats = await UserModel.aggregate([
            {
                $group: {
                    _id: '$packageType',
                    count: { $sum: 1 },
                    totalGenerated: { $sum: '$certificatesGenerated' },
                },
            },
        ]);

        res.json({
            success: true,
            data: {
                totalUsers,
                totalGenerations,
                totalTemplates,
                activeGenerations,
                packageStats,
            },
        });
    } catch (error: any) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, search } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const query: any = {};

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
            ];
        }

        const [users, total] = await Promise.all([
            UserModel.find(query)
                .select('-passwordHash')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            UserModel.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

/**
 * GET /api/admin/users/:id
 * Get user details
 */
router.get('/users/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const user = await UserModel.findById(id).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's generation stats
        const [totalGenerations, recentGenerations] = await Promise.all([
            GenerationModel.countDocuments({ userId: id }),
            GenerationModel.find({ userId: id })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('templateId', 'name type'),
        ]);

        res.json({
            success: true,
            data: {
                user,
                stats: {
                    totalGenerations,
                    recentGenerations,
                },
            },
        });
    } catch (error: any) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * PUT /api/admin/users/:id/package
 * Update user's package
 */
router.put(
    '/users/:id/package',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
        try {
            const { id } = req.params;
            const { packageType, certificatesRemaining } = req.body;

            if (!packageType || !Object.values(PackageType).includes(packageType)) {
                return res.status(400).json({ error: 'Invalid package type' });
            }

            const user = await UserModel.findById(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.packageType = packageType;

            if (certificatesRemaining !== undefined) {
                user.certificatesRemaining = Number(certificatesRemaining);
            }

            await user.save();

            res.json({
                success: true,
                message: 'Package updated successfully',
                data: user,
            });
        } catch (error: any) {
            console.error('Update package error:', error);
            res.status(500).json({ error: 'Failed to update package' });
        }
    }
);

/**
 * PUT /api/admin/users/:id/status
 * Toggle user active status
 */
router.put(
    '/users/:id/status',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            const user = await UserModel.findById(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            user.isActive = isActive;
            await user.save();

            res.json({
                success: true,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
                data: user,
            });
        } catch (error: any) {
            console.error('Update user status error:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    }
);

/**
 * GET /api/admin/generations
 * Get all generations with pagination
 */
router.get('/generations', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, status } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const query: any = {};

        if (status) {
            query.status = status;
        }

        const [generations, total] = await Promise.all([
            GenerationModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('userId', 'email name')
                .populate('templateId', 'name type'),
            GenerationModel.countDocuments(query),
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
        console.error('Get generations error:', error);
        res.status(500).json({ error: 'Failed to get generations' });
    }
});

/**
 * GET /api/admin/generations/:id
 * Get generation details
 */
router.get(
    '/generations/:id',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
        try {
            const { id } = req.params;

            const generation = await GenerationModel.findById(id)
                .populate('userId', 'email name packageType')
                .populate('templateId', 'name type metadata');

            if (!generation) {
                return res.status(404).json({ error: 'Generation not found' });
            }

            res.json({
                success: true,
                data: generation,
            });
        } catch (error: any) {
            console.error('Get generation error:', error);
            res.status(500).json({ error: 'Failed to get generation' });
        }
    }
);

/**
 * GET /api/admin/templates
 * Get all templates
 */
router.get('/templates', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const [templates, total] = await Promise.all([
            TemplateModel.find({ isActive: true })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('createdBy', 'email name'),
            TemplateModel.countDocuments({ isActive: true }),
        ]);

        res.json({
            success: true,
            data: templates,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

export default router;
