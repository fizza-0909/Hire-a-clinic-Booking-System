import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';
import User from '@/models/User';
import dbConnect from '@/lib/mongoose';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clientSecret } = await req.json();
        if (!clientSecret) {
            return NextResponse.json(
                { error: 'Client secret is required' },
                { status: 400 }
            );
        }

        // Extract payment intent ID from client secret
        const paymentIntentId = clientSecret.split('_secret_')[0];

        // Retrieve payment intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // If payment was successful, check if this is user's first successful payment
        if (paymentIntent.status === 'succeeded') {
            await dbConnect();
            const user = await User.findById(session.user.id);

            if (user && !user.isVerified) {
                // Check if this payment includes security deposit (first payment)
                const metadata = paymentIntent.metadata || {};
                if (metadata.includesSecurityDeposit === 'true') {
                    user.isVerified = true;
                    await user.save();
                }
            }
        }

        // Return payment status and any error information
        return NextResponse.json({
            status: paymentIntent.status,
            message: paymentIntent.last_payment_error?.message,
            code: paymentIntent.last_payment_error?.code,
            decline_code: paymentIntent.last_payment_error?.decline_code,
            isVerified: paymentIntent.status === 'succeeded'
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return NextResponse.json(
            { error: 'Failed to verify payment status' },
            { status: 500 }
        );
    }
} 