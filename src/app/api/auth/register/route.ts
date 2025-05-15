import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import { sendEmail, getRegistrationConfirmationEmail } from '@/lib/email';

export async function POST(req: Request) {
    console.log('Starting registration process...');

    // Connect to MongoDB
    try {
        await dbConnect();
        console.log('Successfully connected to MongoDB');
    } catch (dbError) {
        console.error('MongoDB connection error:', dbError);
        return NextResponse.json(
            { error: 'Database connection failed' },
            { status: 500 }
        );
    }

    // Parse request body
    let body;
    try {
        body = await req.json();
        console.log('Received registration data:', { ...body, password: '[REDACTED]' });
    } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return NextResponse.json(
            { error: 'Invalid request format' },
            { status: 400 }
        );
    }

    try {
        const { firstName, lastName, email, phoneNumber, password } = body;

        // Validate input
        if (!firstName || !lastName || !email || !password || !phoneNumber) {
            console.log('Missing required fields:', {
                firstName: !!firstName,
                lastName: !!lastName,
                email: !!email,
                password: !!password,
                phoneNumber: !!phoneNumber
            });
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('Invalid email format:', email);
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate phone number format
        const phoneRegex = /^\+?1?\d{9,15}$/;
        if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
            console.log('Invalid phone number format:', phoneNumber);
            return NextResponse.json(
                { error: 'Invalid phone number format. Please enter a valid phone number.' },
                { status: 400 }
            );
        }

        // Validate password strength
        if (password.length < 8) {
            console.log('Password too short');
            return NextResponse.json(
                { error: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            console.log('Email already registered:', email);
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Create user using Mongoose model
        console.log('Creating new user...');
        const user = await User.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phoneNumber: phoneNumber?.trim(),
            password,
            hasBookings: false
        });

        // Send welcome email
        try {
            const { subject, html } = getRegistrationConfirmationEmail({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            });

            await sendEmail({
                to: user.email,
                subject,
                html
            });

            console.log('Registration confirmation email sent successfully');
        } catch (error) {
            console.error('Failed to send registration confirmation email:', error);
            // Don't throw error here as registration is still successful
        }

        console.log('User created successfully:', user._id.toString());
        return NextResponse.json({
            success: true,
            message: 'User registered successfully',
            userId: user._id.toString()
        });
    } catch (error: any) {
        console.error('Registration error:', error);

        // Handle duplicate email error
        if (error.code === 11000) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map((err: any) => err.message);
            return NextResponse.json(
                { error: validationErrors.join(', ') },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to register user' },
            { status: 500 }
        );
    }
}