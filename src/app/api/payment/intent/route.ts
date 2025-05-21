import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { Booking } from '@/models/Booking';
import User from '@/models/User';
import { sendEmail, getBookingConfirmationEmail } from '@/lib/email';

interface BookingDate {
    date: string;
    startTime: string;
    endTime: string;
}

interface BookingRoom {    roomId: string;    name: string;    timeSlot: 'full' | 'morning' | 'evening';    dates: BookingDate[];}

interface BookingData {
    rooms: BookingRoom[];
    bookingType: 'daily' | 'monthly';
    totalAmount: number;
    includesSecurityDeposit: boolean;
}

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-04-30.basil'
});

// Helper function to validate date string
const isValidDate = (dateStr: string): boolean => {
    try {
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    } catch {
        return false;
    }
};

// Helper function to validate time string
const isValidTime = (timeStr: string): boolean => {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

// Helper function to validate booking date object
const isValidBookingDate = (bookingDate: BookingDate): boolean => {
    return (
        isValidDate(bookingDate.date) &&
        isValidTime(bookingDate.startTime) &&
        isValidTime(bookingDate.endTime)
    );
};

export async function POST(req: Request) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.error('Unauthorized access attempt:', { session });
            return NextResponse.json(
                { error: 'Please login to continue with payment' },
                { status: 401 }
            );
        }

        // Parse and validate request body
        let amount: number, bookingData: BookingData;
        try {
            const body = await req.json();
            amount = body.amount;
            bookingData = body.bookingData;

            if (!amount || typeof amount !== 'number' || amount <= 0) {
                throw new Error('Invalid amount');
            }

            if (!bookingData?.rooms || !Array.isArray(bookingData.rooms) || bookingData.rooms.length === 0) {
                throw new Error('Invalid booking data');
            }

            // Validate dates in booking data
            const hasInvalidDates = bookingData.rooms.some(room => 
                room.dates.some(date => !isValidBookingDate(date))
            );

            if (hasInvalidDates) {
                throw new Error('Invalid dates in booking data');
            }
        } catch (error) {
            console.error('Request validation error:', error);
            return NextResponse.json(
                { error: 'Invalid request data' },
                { status: 400 }
            );
        }

        await dbConnect();
        console.log('Connected to database');

        // Get user details and check verification status
        const user = await User.findById(session.user.id);
        if (!user) {
            console.error('User not found:', session.user.id);
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check security deposit requirement
        const requiresSecurityDeposit = !user.isVerified;
        if (requiresSecurityDeposit && !bookingData.includesSecurityDeposit) {
            console.error('Security deposit required but not included');
            return NextResponse.json(
                { error: 'Security deposit is required for unverified users' },
                { status: 400 }
            );
        }

        // Create or retrieve Stripe customer
        let stripeCustomerId = user.stripeCustomerId;
        if (!stripeCustomerId) {
            console.log('Creating new Stripe customer for user');
            try {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: {
                        userId: user._id.toString(),
                        isVerified: user.isVerified ? 'true' : 'false'
                    }
                });
                stripeCustomerId = customer.id;

                // Save Stripe customer ID to user
                await User.findByIdAndUpdate(user._id, {
                    stripeCustomerId: customer.id
                });
                console.log('Saved Stripe customer ID to user');
            } catch (error) {
                console.error('Error creating Stripe customer:', error);
                return NextResponse.json(
                    { error: 'Failed to create payment profile' },
                    { status: 500 }
                );
            }
        }

        // Create pending bookings
        const bookingPromises = bookingData.rooms.map(room => 
            Booking.create({
                userId: session.user.id,
                rooms: [{
                    roomId: room.roomId,
                    name: room.name,
                    timeSlot: room.timeSlot,
                    dates: room.dates
                }],
                bookingType: bookingData.bookingType,
                status: 'pending',
                paymentStatus: 'pending',
                totalAmount: amount / 100, // Store in dollars
                createdAt: new Date(),
                updatedAt: new Date()
            })
        );

        const bookings = await Promise.all(bookingPromises);
        const bookingIds = bookings.map(booking => booking._id.toString());

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            customer: stripeCustomerId,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: session.user.id,
                bookingIds: bookingIds.join(','),
                bookingType: bookingData.bookingType,
                roomCount: bookingData.rooms.length.toString(),
                includesSecurityDeposit: requiresSecurityDeposit ? 'true' : 'false'
            }
        });

        // Update bookings with payment intent ID
        await Booking.updateMany(
            { _id: { $in: bookingIds } },
            {
                $set: {
                    'paymentDetails.paymentIntentId': paymentIntent.id,
                    updatedAt: new Date()
                }
            }
        );

        // Send confirmation email
        const emailData = {
            customerName: `${user.firstName} ${user.lastName}`,
            bookingNumber: bookingIds[0], // Use first booking ID as reference
            roomDetails: bookingData.rooms.map(room => ({
                roomNumber: room.roomId,
                timeSlot: room.timeSlot === 'morning' ? '8:00 AM - 12:00 PM' :
                         room.timeSlot === 'evening' ? '1:00 PM - 5:00 PM' :
                         '8:00 AM - 5:00 PM',
                dates: room.dates.map(date => 
                    new Date(date.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                )
            })),
            paymentDetails: {
                subtotal: amount / 100 - (requiresSecurityDeposit ? 250 : 0),
                tax: (amount / 100) * 0.035,
                securityDeposit: requiresSecurityDeposit ? 250 : 0,
                totalAmount: amount / 100
            }
        };

        const emailTemplate = getBookingConfirmationEmail(emailData);
        await sendEmail({
            to: user.email,
            ...emailTemplate
        });

        console.log('Created payment intent:', {
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            status: paymentIntent.status,
            bookingIds,
            includesSecurityDeposit: requiresSecurityDeposit
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            bookingIds,
            requiresSecurityDeposit
        });
    } catch (error) {
        console.error('Payment intent creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create payment intent. Please try again.' },
            { status: 500 }
        );
    }
} 