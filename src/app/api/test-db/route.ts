import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

// Make this route public by exporting a config object
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        // Log environment variables (excluding sensitive data)
        console.log('Environment check:', {
            hasMongoUri: !!process.env.MONGODB_URI,
            hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
            nodeEnv: process.env.NODE_ENV,
            hasDbName: !!process.env.MONGODB_DB
        });

        console.log('Testing database connection...');
        const startTime = Date.now();
        const { db } = await connectToDatabase();
        const connectionTime = Date.now() - startTime;
        console.log(`Database connection established in ${connectionTime}ms`);

        // Test database connection
        const pingStart = Date.now();
        const result = await db.command({ ping: 1 });
        const pingTime = Date.now() - pingStart;
        console.log(`Database ping completed in ${pingTime}ms:`, result);

        // Try to count users
        const countStart = Date.now();
        const userCount = await db.collection('users').countDocuments();
        const countTime = Date.now() - countStart;
        console.log(`User count completed in ${countTime}ms. Found ${userCount} users`);

        return NextResponse.json({
            status: 'success',
            message: 'Database connection successful',
            timing: {
                connection: connectionTime,
                ping: pingTime,
                count: countTime
            },
            userCount,
            environmentCheck: {
                hasMongoUri: !!process.env.MONGODB_URI,
                hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
                nodeEnv: process.env.NODE_ENV,
                hasDbName: !!process.env.MONGODB_DB
            }
        });
    } catch (error) {
        console.error('Database test failed:', {
            error: error instanceof Error ? {
                message: error.message,
                name: error.name,
                stack: error.stack
            } : error
        });

        return NextResponse.json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Database connection failed',
            error: error instanceof Error ? {
                name: error.name,
                message: error.message
            } : 'Unknown error'
        }, { status: 500 });
    }
} 