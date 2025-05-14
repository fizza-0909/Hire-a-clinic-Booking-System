import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Document, WithId } from 'mongodb';

interface BookingStatus {
    date: string;
    roomId: string;
    type: 'none' | 'booked' | 'partial';
    timeSlots: Array<'full' | 'morning' | 'evening'>;
}

interface Booking {
    dates: string[];
    roomId: string;
    timeSlot: 'full' | 'morning' | 'evening';
}

export async function POST(req: Request) {
    try {
        const { db } = await connectToDatabase();
        const { month, year, roomId } = await req.json();

        if (!month || !year) {
            return NextResponse.json(
                { error: 'Month and year are required' },
                { status: 400 }
            );
        }

        // Get start and end dates for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        // Format dates to match our string format (YYYY-MM-DD)
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Find all bookings for the month and specific room if provided
        const query = {
            dates: {
                $elemMatch: {
                    $gte: startDateStr,
                    $lte: endDateStr
                }
            },
            ...(roomId && { roomId: roomId.toString() })
        };

        const bookings = await db.collection('bookings')
            .find(query)
            .toArray() as WithId<Document & Booking>[];

        // Create a map of dates and their booking status per room
        const bookingMap = new Map<string, BookingStatus>();

        bookings.forEach((booking) => {
            booking.dates.forEach((date: string) => {
                const key = `${date}-${booking.roomId}`;
                if (!bookingMap.has(key)) {
                bookingMap.set(key, {
                        date,
                    roomId: booking.roomId,
                        type: 'none',
                        timeSlots: []
                });
                }
                const status = bookingMap.get(key)!;
                status.timeSlots.push(booking.timeSlot);
                status.type = status.timeSlots.includes('full') ? 'booked' : 'partial';
                });
        });

        return NextResponse.json(Array.from(bookingMap.values()));
    } catch (error) {
        console.error('Error fetching booking status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch booking status' },
            { status: 500 }
        );
    }
} 