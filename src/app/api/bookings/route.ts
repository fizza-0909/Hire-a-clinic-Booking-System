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

        // Get user's bookings with payment status
        const bookings = await db.collection('bookings')
            .find({
                userId: session.user.id
            })
            .sort({ createdAt: -1 })
            .toArray();

        // Group bookings by roomId and payment intent
        const groupedBookings = bookings.reduce((acc: any[], booking) => {
            const existingBooking = acc.find(b =>
                b.roomId === booking.roomId &&
                b.timeSlot === booking.timeSlot &&
                b.paymentDetails?.paymentIntentId === booking.paymentDetails?.paymentIntentId
            );

            // Format the creation date
            const createdDate = booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Date not available';

            if (existingBooking) {
                existingBooking.dates = [...(existingBooking.dates || []), booking.date].sort();
            } else {
                // Determine the real payment status
                const paymentStatus = booking.paymentDetails?.status;
                const bookingStatus = paymentStatus === 'succeeded' ? 'confirmed' : 'pending';

                acc.push({
                    ...booking,
                    dates: [booking.date],
                    status: bookingStatus,
                    createdAt: createdDate,
                    paymentStatus: paymentStatus
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