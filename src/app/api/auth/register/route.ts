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

        // Send verification email
        try {
            console.log('Attempting to send verification email to:', user.email);
            await sendVerificationEmail(
                user.email,
                verificationToken,
                verificationCode
            );
            console.log('Verification email sent successfully to:', user.email);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            console.error('Error details:', {
                name: emailError instanceof Error ? emailError.name : 'Unknown',
                message: emailError instanceof Error ? emailError.message : String(emailError),
                stack: emailError instanceof Error ? emailError.stack : undefined
            });
            // Don't fail registration if email fails, but log it
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