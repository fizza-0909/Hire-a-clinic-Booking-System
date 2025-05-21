import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Booking from '@/models/Booking';
import User from '@/models/User';
import Stripe from 'stripe';
import { sendEmail, getBookingConfirmationEmail } from '@/lib/email';
import { Document, Types } from 'mongoose';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-04-30.basil'
});

interface Room {
    roomId: string;
    timeSlot: string;
    dates: Array<{
        date: string;
        startTime: string;
        endTime: string;
    }>;
}

interface BookingWithRooms extends Document {
    _id: Types.ObjectId;
    rooms: Room[];
    paymentDetails: {
        amount: number;
        securityDeposit?: number;
    };
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const body = await req.json();
        const { paymentIntentId } = body;

        if (!paymentIntentId) {
            return NextResponse.json(
                { error: 'Missing payment intent ID' },
                { status: 400 }
            );
        }

        console.log('Processing booking confirmation:', {
            userId: session.user.id,
            paymentIntentId
        });

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (!paymentIntent) {
            throw new Error('Payment intent not found');
        }

        const paymentStatus = paymentIntent.status;
        const bookingIds = paymentIntent.metadata.bookingIds?.split(',') || [];

        // Get user details
        const user = await User.findById(session.user.id);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if this is the user's first booking and they're not verified
        const isFirstBooking = !user.isVerified;
        const securityDeposit = isFirstBooking ? 250 : 0; // $250 security deposit for first-time unverified users

        // Update all bookings associated with this payment
        const updatePromises = bookingIds.map(bookingId =>
            Booking.findByIdAndUpdate(
                bookingId,
                {
                    $set: {
                        status: paymentStatus === 'succeeded' ? 'confirmed' : 'pending',
                        paymentStatus,
                        paymentDetails: {
                            paymentIntentId,
                            amount: (paymentIntent.amount - (isFirstBooking ? 25000 : 0)) / 100, // Convert from cents to dollars and subtract security deposit
                            securityDeposit: isFirstBooking ? 250 : 0,
                            currency: paymentIntent.currency,
                            status: paymentStatus,
                            lastUpdated: new Date()
                        },
                        updatedAt: new Date()
                    }
                },
                { new: true }
            ).populate('userId', 'firstName lastName email preferences')
        );

        const updatedBookings = await Promise.all(updatePromises);
        const validBookings = updatedBookings.filter(booking => booking !== null);

        if (validBookings.length === 0) {
            throw new Error('No bookings found to update');
        }

        // Update user verification status if this is their first successful booking
        if (paymentStatus === 'succeeded' && isFirstBooking) {
            await User.findByIdAndUpdate(
                session.user.id,
                {
                    $set: {
                        isVerified: true,
                        verifiedAt: new Date(),
                        updatedAt: new Date()
                    }
                }
            );
            console.log('Updated user verification status');

            // Update session data
            const freshUser = await User.findById(session.user.id).lean();
            if (freshUser) {
                // The session will be automatically updated on the next request
                // due to our session callback in auth.ts
                console.log('User verification status updated in database');
            }
        }

        // Send confirmation email
        if (validBookings.length > 0) {
            try {
                const booking = validBookings[0];
                const user = await User.findById(booking.userId);
                
                if (user && user.email) {
                    const emailData = {
                        to: user.email,
                        ...getBookingConfirmationEmail({
                            ...booking.toObject(),
                            paymentDetails: {
                                amount: booking.totalAmount,
                                securityDeposit: isFirstBooking ? 250 : 0
                            }
                        })
                    };

                    await sendEmail(emailData);
                    console.log('Confirmation email sent successfully');
                }
            } catch (error) {
                console.error('Error sending confirmation email:', error);
            }
        }

        return NextResponse.json({
            message: 'Booking processed successfully',
            bookings: validBookings.map(booking => ({
                _id: booking._id,
                rooms: booking.rooms,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                totalAmount: booking.totalAmount,
                createdAt: booking.createdAt,
                paymentDetails: {
                    amount: booking.totalAmount - (isFirstBooking ? 250 : 0),
                    securityDeposit: isFirstBooking ? 250 : 0
                }
            })),
            paymentStatus,
            isFirstBooking,
            securityDeposit: isFirstBooking ? 250 : 0
        });
    } catch (error) {
        console.error('Error confirming booking:', error);
        return NextResponse.json(
            {
                error: 'Failed to confirm booking',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 