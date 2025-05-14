import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

interface BookingRoom {
    id: number;
    timeSlot: string;
    dates: string[];
}

interface BookingData {
    rooms: BookingRoom[];
    bookingType: 'daily' | 'monthly';
    totalAmount: number;
}

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    typescript: true,
});

export async function POST(req: Request) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        console.log('Session check:', {
            hasSession: !!session,
            hasUserId: !!session?.user?.id
        });

        if (!session?.user?.id) {
            console.error('Payment intent creation failed: No authenticated user');
            return NextResponse.json(
                { error: 'Please log in to continue with payment' },
                { status: 401 }
            );
        }

        let requestData;
        try {
            requestData = await req.json();
            console.log('Received payment intent request:', {
                amount: requestData.amount,
                hasBookingData: !!requestData.bookingData,
                roomCount: requestData.bookingData?.rooms?.length,
                totalAmount: requestData.bookingData?.totalAmount
            });
        } catch (e) {
            console.error('Payment intent creation failed: Invalid JSON data', e);
            return NextResponse.json(
                { error: 'Invalid request format' },
                { status: 400 }
            );
        }

        const { amount, bookingData } = requestData as { amount: number; bookingData: BookingData };

        // Validate amount matches booking data
        const expectedAmount = Math.round(bookingData.totalAmount * 100); // Convert to cents
        if (amount !== expectedAmount) {
            console.error('Payment amount mismatch:', {
                providedAmount: amount,
                expectedAmount,
                difference: amount - expectedAmount
            });
            return NextResponse.json(
                { error: 'Payment amount does not match booking total' },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            console.error('Payment intent creation failed: Invalid amount', { amount });
            return NextResponse.json(
                { error: 'Please provide a valid payment amount' },
                { status: 400 }
            );
        }

        if (!bookingData || !bookingData.rooms || bookingData.rooms.length === 0) {
            console.error('Payment intent creation failed: Invalid booking data', { bookingData });
            return NextResponse.json(
                { error: 'Please select at least one room to book' },
                { status: 400 }
            );
        }

        console.log('Connecting to database...');
        const { db } = await connectToDatabase();
        console.log('Database connection successful');

        // Create pending bookings first
        console.log('Creating pending bookings...', {
            userId: session.user.id,
            roomCount: bookingData.rooms.length,
            amount,
            bookingType: bookingData.bookingType
        });

        try {
            const bookingPromises = bookingData.rooms.map(room => {
                return db.collection('bookings').insertOne({
                    userId: session.user.id,
                    roomId: room.id.toString(),
                    dates: room.dates,
                    timeSlot: room.timeSlot,
                    status: 'pending',
                    totalAmount: amount / 100, // Convert back to dollars
                    paymentDetails: {
                        status: 'pending',
                        createdAt: new Date()
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });

            const bookingResults = await Promise.all(bookingPromises);
            const bookingIds = bookingResults.map(result => result.insertedId.toString());

            console.log('Successfully created pending bookings', { bookingIds });

            // Create a PaymentIntent with the order amount and currency
            console.log('Creating Stripe payment intent...', {
                amount: Math.round(amount),
                userId: session.user.id
            });

            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount),
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: {
                    userId: session.user.id,
                    bookingIds: bookingIds.join(',')
                }
            });

            console.log('Successfully created payment intent', {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount
            });

            // Update bookings with payment intent ID
            await db.collection('bookings').updateMany(
                {
                    _id: { $in: bookingResults.map(result => result.insertedId) }
                },
                {
                    $set: {
                        'paymentDetails.paymentIntentId': paymentIntent.id
                    }
                }
            );

            console.log('Successfully updated bookings with payment intent ID');

            return NextResponse.json({
                clientSecret: paymentIntent.client_secret,
                bookingIds
            });
        } catch (dbError) {
            console.error('Database operation failed:', dbError);
            return NextResponse.json(
                { error: 'Failed to process booking. Please try again.' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Payment intent creation failed:', error);
        // Check if it's a Stripe error
        if (error instanceof Stripe.errors.StripeError) {
            return NextResponse.json(
                { error: `Payment service error: ${error.message}` },
                { status: error.statusCode || 500 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create payment intent. Please try again.' },
            { status: 500 }
        );
    }
} 