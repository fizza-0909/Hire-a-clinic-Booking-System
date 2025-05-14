import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';

export async function GET() {
    try {
        // Test database connection
        await dbConnect();
        console.log('MongoDB Connection Status:', mongoose.connection.readyState);

        // Get list of collections
        const collections = await mongoose.connection.db.collections();
        const collectionNames = collections.map(c => c.collectionName);

        // Get database name
        const dbName = mongoose.connection.db.databaseName;

        return NextResponse.json({
            status: 'success',
            connection: {
                readyState: mongoose.connection.readyState,
                dbName: dbName,
                collections: collectionNames
            },
            env: {
                hasMongoUri: !!process.env.MONGODB_URI,
                hasMongoDb: !!process.env.MONGODB_DB,
                hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
                nodeEnv: process.env.NODE_ENV
            }
        });
    } catch (error) {
        console.error('Database connection test failed:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message,
            env: {
                hasMongoUri: !!process.env.MONGODB_URI,
                hasMongoDb: !!process.env.MONGODB_DB,
                hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
                nodeEnv: process.env.NODE_ENV
            }
        }, { status: 500 });
    }
} 