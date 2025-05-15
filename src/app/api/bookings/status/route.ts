import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { WithId, Document } from 'mongodb';

interface Booking {
    _id: string;
    roomId: string;
    date: string;
    timeSlot: 'full' | 'morning' | 'evening';
    status: string;
    createdAt: Date;
    paymentDetails: {
        status: 'succeeded' | 'rejected';
    };
}

interface BookingStatus {
    date: string;
    roomId: string;
    type: 'none' | 'booked' | 'partial';
    timeSlots: string[];
}

export async function POST(req: Request) {
    console.log('Received booking status request');

    try {
        // Validate request body
        const body = await req.json();
        const { month, year, roomId } = body;

        console.log('Request parameters:', { month, year, roomId });

        if (!month || !year || !roomId) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Get start and end dates for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        console.log('Connecting to database...');
        const { db } = await connectToDatabase();

        // Find all bookings for the room in the specified month
        const bookings = await db.collection('bookings')
            .find({
                roomId: roomId,
                date: {
                    $gte: startDate.toISOString().split('T')[0],
                    $lte: endDate.toISOString().split('T')[0]
                },
                'paymentDetails.status': 'succeeded'
            })
            .toArray();

        console.log(`Found ${bookings.length} bookings for room ${roomId}`);

        // Transform bookings into the required format
        const formattedBookings = bookings.map(booking => ({
            date: booking.date,
            roomId: booking.roomId,
            timeSlots: Array.isArray(booking.timeSlot) ? booking.timeSlot : [booking.timeSlot]
        }));

        console.log('Formatted bookings:', formattedBookings);

        return NextResponse.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching booking status:', error);

        // Check if it's a connection error
        if (error instanceof Error && error.message.includes('ECONNRESET')) {
            return NextResponse.json(
                { error: 'Database connection error. Please try again.' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch booking status' },
            { status: 500 }
        );
    }
} 