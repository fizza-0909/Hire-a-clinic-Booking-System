import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { firstName, lastName, email, password, phoneNumber } = await req.json();

        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Connect to database
        await dbConnect();

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Create new user (password will be hashed by the model's pre-save hook)
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password, // No need to hash here, the model will do it
            phoneNumber,
            isVerified: false,
            isEmailVerified: false,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Generate verification token
        const verificationToken = await bcrypt.hash(user._id.toString() + Date.now().toString(), 12);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

        // Save verification token and code
        user.verificationToken = verificationToken;
        user.verificationCode = verificationCode;
        await user.save();

        // Send verification email with detailed timing
        const emailStartTime = Date.now();
        console.log(`[${new Date().toISOString()}] Starting email send to: ${user.email}`);
        
        try {
            const emailResult = await sendVerificationEmail(
                user.email,
                verificationToken,
                verificationCode
            ) as { success: boolean; error?: string; details?: any };
            
            const emailDuration = Date.now() - emailStartTime;
            console.log(`[${new Date().toISOString()}] Email send completed in ${emailDuration}ms`, {
                success: emailResult.success,
                messageId: emailResult.details?.messageId,
                attempt: emailResult.details?.attemptNumber
            });
            
            if (!emailResult.success) {
            const errorDetails = {
                email: user.email,
                error: emailResult.error,
                details: emailResult.details,
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                vercel: process.env.VERCEL ? 'yes' : 'no',
                region: process.env.VERCEL_REGION || 'local'
            };
            
                console.error('Failed to send verification email:', errorDetails);
                
                // In production, you might want to:
                // 1. Queue the email for retry
                // 2. Notify admins about the failure
                // 3. Log to an error tracking service
                
                // For now, we'll just log it and continue with registration
                console.warn('User registered but verification email failed to send. Verification code:', verificationCode);
            } else {
                console.log('Verification email sent successfully to:', user.email);
            }
        } catch (emailError) {
            const errorDuration = Date.now() - emailStartTime;
            console.error(`[${new Date().toISOString()}] Email sending failed after ${errorDuration}ms`, {
                error: emailError instanceof Error ? emailError.message : 'Unknown error',
                stack: emailError instanceof Error ? emailError.stack : undefined,
                email: user.email,
                timestamp: new Date().toISOString()
            });
            console.warn('User registered but verification email failed to send. Verification code:', verificationCode);
        }

        // Remove sensitive data from response
        const userResponse = {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isVerified: user.isVerified,
            role: user.role
        };

        return NextResponse.json({
            message: 'User registered successfully',
            user: userResponse
        }, { status: 201 });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { 
                error: 'Registration failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}