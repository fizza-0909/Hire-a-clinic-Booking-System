import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Booking from '@/models/Booking';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Fetch all bookings for the user with full details
        const bookings = await Booking.find({ userId: session.user.id })
            .sort({ createdAt: -1 })
            .lean(); // Use lean() for better performance

        // Map the bookings to include all necessary fields
        const formattedBookings = bookings.map(booking => ({
            _id: booking._id.toString(),
            roomId: booking.roomId,
            timeSlot: booking.timeSlot,
            dates: booking.dates,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            totalAmount: booking.paymentDetails?.amount || 0,
            createdAt: booking.createdAt,
            paymentDetails: {
                amount: booking.paymentDetails?.amount || 0,
                securityDeposit: booking.paymentDetails?.securityDeposit || 0
            }
        }));

        return NextResponse.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bookings' },
            { status: 500 }
        );
    }
} 