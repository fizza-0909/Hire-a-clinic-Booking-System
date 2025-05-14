import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { WithId, Document } from 'mongodb';

interface Booking {
    _id: string;
    roomId: string;
    dates: string[];
    timeSlot: 'full' | 'morning' | 'evening';
    status: string;
    paymentDetails: {
        status: string;
    };
}

interface BookingStatus {
    date: string;
    roomId: string;
    type: 'none' | 'booked' | 'partial';
    timeSlots: string[];
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
            status: { $in: ['pending', 'confirmed'] }, // Include both pending and confirmed bookings
            ...(roomId && { roomId: roomId.toString() })
        };

        console.log('Fetching bookings with query:', query);

        const bookings = await db.collection('bookings')
            .find(query)
            .toArray() as WithId<Document & Booking>[];

        console.log(`Found ${bookings.length} bookings`);

        // Create a map of dates and their booking status per room
        const bookingMap = new Map<string, BookingStatus>();

        bookings.forEach((booking) => {
            if (!booking.dates) return;

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

                // Check both booking status and payment status
                const isConfirmed = booking.status === 'confirmed' ||
                    booking.paymentDetails?.status === 'succeeded';

                // Only mark slots as taken if the booking is confirmed or pending
                if (booking.timeSlot && (isConfirmed || booking.status === 'pending')) {
                    // Don't add duplicate time slots
                    if (!status.timeSlots.includes(booking.timeSlot)) {
                        status.timeSlots.push(booking.timeSlot);
                    }

                    // Update booking type
                    if (booking.timeSlot === 'full' || status.timeSlots.includes('full')) {
                        status.type = 'booked';
                    } else if (status.timeSlots.length > 0) {
                        status.type = 'partial';
                    }
                }
            });
        });

        // Log the final booking status for debugging
        console.log('Final booking status:', {
            totalDates: bookingMap.size,
            statuses: Array.from(bookingMap.values()).map(s => ({
                date: s.date,
                type: s.type,
                slots: s.timeSlots
            }))
        });

        return NextResponse.json({
            bookings: Array.from(bookingMap.values())
        });
    } catch (error) {
        console.error('Error fetching booking status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch booking status' },
            { status: 500 }
        );
    }
} 