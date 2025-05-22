import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { Booking } from '@/models/Booking';

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
        const formattedBookings = bookings.map((booking: any) => ({
            _id: booking._id.toString(),
            rooms: booking.rooms.map((room: any) => ({
                roomId: room.roomId,
                name: room.name,
                timeSlot: room.timeSlot,
                dates: room.dates
            })),
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            totalAmount: booking.totalAmount,
            createdAt: booking.createdAt,
            paymentDetails: booking.paymentDetails || {
                amount: booking.totalAmount,
                status: booking.paymentStatus,
                confirmedAt: booking.status === 'confirmed' ? booking.updatedAt : null
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