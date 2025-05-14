import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: Request) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Please log in to view your bookings' },
                { status: 401 }
            );
        }

        // Connect to database
        const { db } = await connectToDatabase();

        // Get user's bookings
        const bookings = await db.collection('bookings')
            .find({
                userId: session.user.id,
                status: { $in: ['pending', 'confirmed'] }
            })
            .sort({ createdAt: -1 })
            .toArray();

        // Group bookings by roomId and date
        const groupedBookings = bookings.reduce((acc: any[], booking) => {
            const existingBooking = acc.find(b =>
                b.roomId === booking.roomId &&
                b.timeSlot === booking.timeSlot &&
                b.status === booking.status &&
                b.paymentDetails.paymentIntentId === booking.paymentDetails.paymentIntentId
            );

            if (existingBooking) {
                existingBooking.dates.push(booking.date);
            } else {
                acc.push({
                    ...booking,
                    dates: [booking.date]
                });
            }
            return acc;
        }, []);

        return NextResponse.json({
            bookings: groupedBookings
        });
    } catch (error) {
        console.error('Failed to fetch bookings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bookings' },
            { status: 500 }
        );
    }
} 