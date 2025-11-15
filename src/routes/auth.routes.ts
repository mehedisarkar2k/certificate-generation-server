import { Router, Request } from 'express';
import { auth } from '../auth/auth.config';

const router = Router();

// Mount better-auth handlers
router.all('/*', async (req: Request, res) => {
    // Better-auth handles Express Request directly
    return auth.handler(req as any);
});

export default router;
