import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;

        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        if (!dbName) {
            throw new Error('DB_NAME is not defined in environment variables');
        }

        await mongoose.connect(mongoUri, {
            dbName,
        });

        console.log(`✅ Connected to MongoDB database: ${dbName}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

export async function disconnectDatabase(): Promise<void> {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ MongoDB disconnection error:', error);
        throw error;
    }
}

// Handle connection events
mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
});
