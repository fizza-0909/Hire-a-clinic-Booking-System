import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';

// Check for required environment variables
const requiredEnvVars = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
};

// Only initialize Stripe if configuration is available
const stripe = requiredEnvVars.STRIPE_SECRET_KEY ? new Stripe(requiredEnvVars.STRIPE_SECRET_KEY, {
    typescript: true,
}) : null;

export async function POST(req: Request) {
    // Check if Stripe is properly configured
    if (!stripe || !requiredEnvVars.STRIPE_WEBHOOK_SECRET) {
        console.error('Stripe configuration is incomplete. Required environment variables are missing.');
        return NextResponse.json(
            { error: 'Stripe is not properly configured' },
            { status: 503 }
        );
    }

    const body = await req.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
        return NextResponse.json(
            { error: 'No signature found' },
            { status: 400 }
        );
    }

    try {
        const event = stripe.webhooks.constructEvent(
            body,
            signature,
            requiredEnvVars.STRIPE_WEBHOOK_SECRET
        );

        const { db } = await connectToDatabase();

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                // Update booking status
                if (paymentIntent.metadata?.bookingIds) {
                    const bookingIds = paymentIntent.metadata.bookingIds.split(',');
                    await db.collection('bookings').updateMany(
                        { _id: { $in: bookingIds } },
                        {
                            $set: {
                                status: 'confirmed',
                                'paymentDetails.status': 'paid',
                                'paymentDetails.paidAt': new Date(),
                                updatedAt: new Date()
                            }
                        }
                    );
                }
                break;
            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                if (failedPayment.metadata?.bookingIds) {
                    const bookingIds = failedPayment.metadata.bookingIds.split(',');
                    await db.collection('bookings').updateMany(
                        { _id: { $in: bookingIds } },
                        {
                            $set: {
                                status: 'failed',
                                'paymentDetails.status': 'failed',
                                'paymentDetails.failedAt': new Date(),
                                updatedAt: new Date()
                            }
                        }
                    );
                }
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 400 }
        );
    }
} 