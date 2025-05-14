import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined');
        }

        // Try to connect with a short timeout
        await mongoose.connect(process.env.MONGODB_URI, {
            connectTimeoutMS: 5000,
            socketTimeoutMS: 5000,
        });

        // Test the connection
        await mongoose.connection.db.admin().ping();

        return NextResponse.json({
            success: true,
            message: 'Successfully connected to MongoDB',
            database: mongoose.connection.db.databaseName
        });
    } catch (error: any) {
        console.error('MongoDB connection test failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to connect to MongoDB',
            details: error
        }, { status: 500 });
    } finally {
        // Close the connection
        try {
            await mongoose.disconnect();
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }
} 