// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
});

// Route configuration
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
};

export async function POST(req: Request) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new NextResponse(null, { 
            status: 200, 
            headers: corsHeaders 
        });
    }

    try {
        console.log('=== Webhook Request Received ===');
        
        // Get raw body
        const body = await req.text();
        const { db } = await connectToDatabase();
        db.collection("WEBHOOK_LOGS").insertOne({
            ...JSON.parse(body),
            createdAt: new Date()
        })
        if (!body) {
            throw new Error('No request body');
        }

        // Verify required environment variables
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not set');
        }

        // Get and verify signature
        const signature = headers().get('stripe-signature') || '';
        if (!signature) {
            throw new Error('Missing stripe-signature header');
        }

        // Verify webhook signature
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(
                body,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
            console.log('Stripe event verified:', { 
                type: event.type, 
                id: event.id 
            });
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return new NextResponse(
                JSON.stringify({ error: 'Webhook signature verification failed' }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Return a response to acknowledge receipt of the event
        return new NextResponse(
            JSON.stringify({ received: true }),
            { status: 200, headers: corsHeaders }
        );

    } catch (error) {
        console.error('Error processing webhook:', error);
        return new NextResponse(
            JSON.stringify({ error: 'Error processing webhook' }),
            { status: 400, headers: corsHeaders }
        );
    }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    console.log('PaymentIntent was successful!', paymentIntent);

    try {
        const bookingIdsRaw = paymentIntent.metadata.bookingIds;
        if (!bookingIdsRaw) {
            console.error('No bookingIds found in payment intent metadata');
            return;
        }

        const bookingIds = bookingIdsRaw.split(',').map(id => new ObjectId(id.trim()));

        const { db } = await connectToDatabase();
        const result = await db.collection('bookings').updateMany(
            { _id: { $in: bookingIds } },
            {
                $set: {
                    status: 'confirmed',
                    paymentStatus: 'succeeded',
                    updatedAt: new Date()
                }
            }
        );

        console.log('Booking update result:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error processing booking confirmation:', errorMessage);
    }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    console.error('Payment failed!', paymentIntent);
    
    try {
        const bookingId = paymentIntent.metadata.bookingId;
        if (!bookingId) {
            console.error('No bookingId found in payment intent metadata');
            return;
        }

        await updateBookingStatus(bookingId, 'failed');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error processing failed payment:', errorMessage);
    }
}

async function updateBookingStatus(bookingId: string, status: string): Promise<void> {
    try {
        const { db } = await connectToDatabase();
        await db.collection('bookings').updateOne(
            { _id: new ObjectId(bookingId) },
            { 
                $set: { 
                    status: status,
                    paymentStatus: status === 'confirmed' ? 'succeeded' : 'failed',
                    updatedAt: new Date()
                } 
            }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating booking status:', errorMessage);
    }
}




















// import Stripe from 'stripe';
// import { headers } from 'next/headers';
// import { connectToDatabase } from '@/lib/mongodb';
// import { ObjectId } from 'mongodb';

// // This is needed to prevent Next.js from parsing the body
// export const dynamic = 'force-dynamic';

// // Initialize Stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//     apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
// });

// // CORS headers
// const corsHeaders = {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Methods': 'POST, OPTIONS',
//     'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
// };

// // Disable Next.js body parser for this route
// export const config = {
//     api: { 
//         bodyParser: false 
//     }
// };

// export async function POST(req: Request) {
//     // Handle CORS preflight
//     if (req.method === 'OPTIONS') {
//         return new Response(null, { 
//             status: 200, 
//             headers: corsHeaders 
//         });
//     }

//     // Log the incoming request
//     console.log('=== Webhook Request Received ===');
//     console.log('Method:', req.method);
//     console.log('URL:', req.url);
    
//     // Get the raw body as text
//     const body = await req.text();
    
//     if (!body) {
//         console.error('No body received in webhook');
//         return new Response(
//             JSON.stringify({ error: 'No body received' }), 
//             { 
//                 status: 400, 
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     }

//     try {
//         console.log('=== Processing Stripe Webhook ===');
        
//         // Verify required environment variables
//         if (!process.env.STRIPE_WEBHOOK_SECRET) {
//             const error = 'STRIPE_WEBHOOK_SECRET is not set';
//             console.error(error);
//             return new Response(
//                 JSON.stringify({ error }), 
//                 { 
//                     status: 400, 
//                     headers: { 
//                         'Content-Type': 'application/json',
//                         ...corsHeaders 
//                     } 
//                 }
//             );
//         }

//         // Get and verify signature
//         const signature = headers().get('stripe-signature');
//         if (!signature) {
//             const error = 'Missing stripe-signature header';
//             console.error(error);
//             return new Response(
//                 JSON.stringify({ error }), 
//                 { 
//                     status: 400, 
//                     headers: { 
//                         'Content-Type': 'application/json',
//                         ...corsHeaders 
//                     } 
//                 }
//             );
//         }

//         // Verify webhook signature
//         let event: Stripe.Event;
//         try {
//             event = stripe.webhooks.constructEvent(
//                 body,
//                 signature,
//                 process.env.STRIPE_WEBHOOK_SECRET
//             );
//             console.log('Stripe event verified:', { 
//                 type: event.type, 
//                 id: event.id 
//             });
//         } catch (err) {
//             const error = `Signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
//             console.error(error);
//             return new Response(
//                 JSON.stringify({ error }), 
//                 { 
//                     status: 400, 
//                     headers: { 
//                         'Content-Type': 'application/json',
//                         ...corsHeaders 
//                     } 
//                 }
//             );
//         }

//         // Handle specific event types
//         switch (event.type) {
//             case 'payment_intent.succeeded':
//                 return await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
//             case 'payment_intent.payment_failed':
//                 return await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
//             default:
//                 console.log(`Unhandled event type: ${event.type}`);
//                 return new Response(
//                     JSON.stringify({ received: true, message: `Unhandled event type: ${event.type}` }), 
//                     { 
//                         status: 200, 
//                         headers: { 
//                             'Content-Type': 'application/json',
//                             ...corsHeaders 
//                         } 
//                     }
//                 );
//         }
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.error('Error processing webhook:', errorMessage);
//         return new Response(
//             JSON.stringify({ 
//                 success: false, 
//                 error: errorMessage 
//             }), 
//             { 
//                 status: 400, 
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     }
// }

// async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
//     try {
//         console.log('PaymentIntent succeeded:', {
//             id: paymentIntent.id,
//             amount: paymentIntent.amount,
//             currency: paymentIntent.currency,
//             metadata: paymentIntent.metadata
//         });

//         // Process booking confirmation if bookingId exists in metadata
//         if (paymentIntent.metadata.bookingId) {
//             await processBookingConfirmation(paymentIntent.metadata.bookingId);
//         }

//         return new Response(
//             JSON.stringify({ 
//                 success: true,
//                 message: 'Payment processed successfully',
//                 paymentIntentId: paymentIntent.id,
//                 amount: paymentIntent.amount,
//                 currency: paymentIntent.currency
//             }),
//             { 
//                 status: 200,
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.error('Error handling successful payment:', errorMessage);
//         return new Response(
//             JSON.stringify({ 
//                 success: false,
//                 error: `Failed to process payment: ${errorMessage}`
//             }),
//             { 
//                 status: 500,
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     }
// }

// async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
//     try {
//         const error = paymentIntent.last_payment_error?.message || 'Unknown error';
//         console.error('PaymentIntent failed:', {
//             id: paymentIntent.id,
//             error: error
//         });

//         // Update booking status to failed if needed
//         if (paymentIntent.metadata.bookingId) {
//             await updateBookingStatus(paymentIntent.metadata.bookingId, 'failed');
//         }

//         return new Response(
//             JSON.stringify({ 
//                 success: false,
//                 error: `Payment failed: ${error}`
//             }),
//             { 
//                 status: 400,
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.error('Error handling failed payment:', errorMessage);
//         return new Response(
//             JSON.stringify({ 
//                 success: false,
//                 error: `Failed to process payment failure: ${errorMessage}`
//             }),
//             { 
//                 status: 500,
//                 headers: { 
//                     'Content-Type': 'application/json',
//                     ...corsHeaders 
//                 } 
//             }
//         );
//     }
// }

// async function processBookingConfirmation(bookingId: string): Promise<void> {
//     try {
//         console.log('Processing booking confirmation for:', bookingId);
        
//         // Connect to database
//         const { db } = await connectToDatabase();
        
//         // Update booking status
//         const result = await db.collection('bookings').updateOne(
//             { _id: new ObjectId(bookingId) },
//             { 
//                 $set: { 
//                     status: 'confirmed',
//                     paymentStatus: 'succeeded',
//                     updatedAt: new Date()
//                 } 
//             }
//         );

//         console.log('Booking update result:', {
//             matchedCount: result.matchedCount,
//             modifiedCount: result.modifiedCount
//         });
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.error('Error processing booking confirmation:', errorMessage);
//         // Don't fail the webhook for booking processing errors
//     }
// }

// async function updateBookingStatus(bookingId: string, status: string): Promise<void> {
//     try {
//         const { db } = await connectToDatabase();
//         await db.collection('bookings').updateOne(
//             { _id: new ObjectId(bookingId) },
//             { 
//                 $set: { 
//                     status: status,
//                     paymentStatus: 'failed',
//                     updatedAt: new Date()
//                 } 
//             }
//         );
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//         console.error('Error updating booking status:', errorMessage);
//     }
// }
