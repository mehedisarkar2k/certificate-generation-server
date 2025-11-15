import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import mongoose from 'mongoose';

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
    if (!authInstance) {
        if (!mongoose.connection.readyState) {
            throw new Error('Database must be connected before initializing auth');
        }

        authInstance = betterAuth({
            database: mongodbAdapter(mongoose.connection.getClient().db()),
            emailAndPassword: {
                enabled: true,
            },
            session: {
                expiresIn: 60 * 60 * 24 * 7, // 7 days
                updateAge: 60 * 60 * 24, // 1 day
            },
            trustedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        });
    }

    return authInstance;
}

// For backwards compatibility
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
    get(target, prop) {
        return getAuth()[prop as keyof ReturnType<typeof betterAuth>];
    },
});

export type Session = ReturnType<typeof getAuth> extends { $Infer: { Session: infer S } } ? S : never;
