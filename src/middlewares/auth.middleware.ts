import { Request, Response, NextFunction } from 'express';
import { auth } from '../auth/auth.config';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        session: any;
    };
}

export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized - No token provided' });
            return;
        }

        const token = authHeader.substring(7);

        // Verify session using better-auth
        const session = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (!session) {
            res.status(401).json({ error: 'Unauthorized - Invalid session' });
            return;
        }

        (req as AuthRequest).user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            session: session.session,
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
}

export async function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        await requireAuth(req, res, () => { });

        const authReq = req as AuthRequest;
        if (!authReq.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check if user is admin from database
        const { UserModel } = await import('../models/User.model');
        const user = await UserModel.findById(authReq.user.id);

        if (!user || !user.isAdmin) {
            res.status(403).json({ error: 'Forbidden - Admin access required' });
            return;
        }

        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(403).json({ error: 'Forbidden' });
    }
}
