import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
        hasStripePublishable: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        hasMongoUri: !!process.env.MONGODB_URI,
        stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? 'Valid prefix' : 'Invalid prefix',
        mongoUriPrefix: (process.env.MONGODB_URI?.startsWith('mongodb://') || process.env.MONGODB_URI?.startsWith('mongodb+srv://')) ? 'Valid prefix' : 'Invalid prefix'
    });
} 