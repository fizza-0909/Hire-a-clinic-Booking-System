import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Update user's verification status
        const user = await User.findById(session.user.id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        user.isVerified = true;
        await user.save();

        // Return the updated user data
        return NextResponse.json({
            message: 'User verified successfully',
            user: {
                ...session.user,
                isVerified: true
            }
        });
    } catch (error) {
        console.error('Error verifying user:', error);
        return NextResponse.json(
            { error: 'Failed to verify user' },
            { status: 500 }
        );
    }
} 