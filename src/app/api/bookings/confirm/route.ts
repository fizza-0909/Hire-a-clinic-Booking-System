import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Booking from '@/models/Booking';
import User from '@/models/User';
import { sendEmail, getBookingConfirmationEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const body = await req.json();

        // Create the booking
        const booking = await Booking.create({
            ...body,
            userId: session.user.id,
            status: 'confirmed'
        });

        // Get user details
        const user = await User.findById(session.user.id);

        // Send confirmation email if user has email notifications enabled
        if (user?.preferences?.emailNotifications) {
            try {
                const { subject, html } = getBookingConfirmationEmail({
                    ...body,
                    customerName: `${user.firstName} ${user.lastName}`,
                    bookingId: booking._id
                });

                await sendEmail({
                    to: user.email,
                    subject,
                    html
                });

                console.log('Booking confirmation email sent successfully');
            } catch (error) {
                console.error('Failed to send booking confirmation email:', error);
                // Don't throw error here, as booking is still successful
            }
        }

        return NextResponse.json({
            message: 'Booking confirmed successfully',
            booking
        });
    } catch (error) {
        console.error('Error confirming booking:', error);
        return NextResponse.json(
            { error: 'Failed to confirm booking' },
            { status: 500 }
        );
    }
} 