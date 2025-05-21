import { NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function GET() {
    console.log('Starting email configuration test...');

    // First, verify all required environment variables
    const requiredEnvVars = {
        EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
        EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
        EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
        EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    };

    const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        console.error('Missing required environment variables:', missingVars);
        return NextResponse.json({
            success: false,
            error: `Missing required environment variables: ${missingVars.join(', ')}`
        }, { status: 500 });
    }

    console.log('Email configuration found:', {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        user: process.env.EMAIL_SERVER_USER,
        from: process.env.EMAIL_FROM,
        appUrl: process.env.NEXT_PUBLIC_APP_URL
    });

    try {
        // Generate a verification code (6 digits)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Generate a verification token
        const verificationToken = crypto.createHash('sha256')
            .update(verificationCode + Date.now().toString())
            .digest('hex');

        await sendVerificationEmail(
            'fizanayab5548@gmail.com',
            verificationToken
        );

        console.log('Test verification email sent successfully');
        return NextResponse.json({
            success: true,
            message: 'Test verification email sent successfully',
            verificationCode,
            verificationToken
        });
    } catch (error) {
        console.error('Error sending test email:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            details: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        }, { status: 500 });
    }
} 