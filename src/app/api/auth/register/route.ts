import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { User } from '@/models/User';

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
        if (!firstName || !lastName || !email || !password) {
            console.log('Missing required fields:', {
                firstName: !!firstName,
                lastName: !!lastName,
                email: !!email,
                password: !!password
            });
            return NextResponse.json(
                { error: 'Missing required fields' },
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