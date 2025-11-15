import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase } from './config/database';
import { getAuth } from './auth/auth.config';
import authRoutes from './routes/auth.routes';
import templateRoutes from './routes/template.routes';
import fontRoutes from './routes/font.routes';
import certificateRoutes from './routes/certificate.routes';
import adminRoutes from './routes/admin.routes';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/fonts', fontRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await connectDatabase();

        // Initialize auth after database connection
        getAuth();
        console.log('✅ Better-auth initialized');

        // Import worker to start processing (after DB connection)
        await import('./queue/certificate.worker');
        console.log('✅ Certificate worker initialized');

        // Start listening
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📝 Health check: http://localhost:${PORT}/health`);
            console.log(`📜 API Base: http://localhost:${PORT}/api`);
            console.log(`🔐 Auth: http://localhost:${PORT}/api/auth`);
            console.log(`📋 Templates: http://localhost:${PORT}/api/templates`);
            console.log(`🔤 Fonts: http://localhost:${PORT}/api/fonts`);
            console.log(`📜 Certificates: http://localhost:${PORT}/api/certificates`);
            console.log(`👤 Admin: http://localhost:${PORT}/api/admin`);
            console.log(`⚙️  Worker: Certificate generation queue active`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}; startServer();

export default app;
