'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import Header from '@/components/Header';
import { useSession } from 'next-auth/react';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Stripe appearance object
const appearance: Appearance = {
    theme: 'stripe',
    variables: {
        colorPrimary: '#635BFF',
        colorBackground: '#ffffff',
        colorText: '#30313d',
        colorDanger: '#df1b41',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
    },
};

interface PriceBreakdown {
    subtotal: number;
    tax: number;
    securityDeposit: number;
    total: number;
    isVerified: boolean;
}

interface PaymentResponse {
    clientSecret: string;
    bookingIds: string[];
}

interface RoomData {
    id: number;
    name: string;
    timeSlot: 'full' | 'morning' | 'evening';
    dates: string[];
}

interface BookingData {
    rooms: RoomData[];
    bookingType: 'daily' | 'monthly';
    totalAmount: number;
}

interface TransformedBookingData {
    rooms: {
        roomId: string;
        name: string;
        timeSlot: 'full' | 'morning' | 'evening';
        dates: {
            date: string;
            startTime: string;
            endTime: string;
        }[];    
    }[];
    bookingType: 'daily' | 'monthly';
    totalAmount: number;
    status: 'pending';
    paymentStatus: 'pending';
}

const PaymentForm = ({ priceBreakdown, clientSecret }: { priceBreakdown: PriceBreakdown; clientSecret: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const { update: updateSession } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            console.error('Stripe.js has not loaded');
            setError('Payment system is not ready. Please try again.');
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const { error: submitError } = await elements.submit();
            if (submitError) {
                throw submitError;
            }

            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/booking/confirmation`,
                },
            });

            if (result.error) {
                throw result.error;
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            setError(error.message || 'An error occurred during payment. Please try again.');
            toast.error(error.message || 'Payment failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-red-800">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || processing}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white 
                    ${processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {processing ? (
                    <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing Payment...
                    </div>
                ) : (
                    'Pay Now'
                )}
            </button>

            <p className="mt-2 text-sm text-gray-500 text-center">
                Your payment is secure and encrypted. You will not be charged until you confirm.
            </p>
        </form>
    );
};

const PaymentPage = () => {
    const router = useRouter();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown>({
        subtotal: 0,
        tax: 0,
        securityDeposit: 0,
        total: 0,
        isVerified: false
    });

    const handleProceedToPayment = async () => {
        try {
            const bookingData = sessionStorage.getItem('bookingData');
            if (!bookingData) {
                throw new Error('No booking data found');
            }

            const parsedData = JSON.parse(bookingData) as BookingData;
            if (!parsedData.rooms || !Array.isArray(parsedData.rooms)) {
                throw new Error('Invalid booking data structure');
            }

            // Transform the booking data to match the schema
            const transformedBookingData: TransformedBookingData = {
                rooms: parsedData.rooms.map((room: RoomData) => ({
                    roomId: room.id.toString(),
                    name: room.name,
                    timeSlot: room.timeSlot,
                    dates: room.dates.map((date: string) => ({
                        date: date,
                        startTime: room.timeSlot === 'morning' ? '08:00' : room.timeSlot === 'evening' ? '14:00' : '08:00',
                        endTime: room.timeSlot === 'morning' ? '13:00' : room.timeSlot === 'evening' ? '19:00' : '19:00'
                    }))
                })),
                bookingType: parsedData.bookingType,
                totalAmount: parsedData.totalAmount,
                status: 'pending',
                paymentStatus: 'pending'
            };

            // Create payment intent
            const response = await fetch('/api/payment/intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: Math.round(parsedData.totalAmount * 100), // Convert to cents for Stripe
                    bookingData: transformedBookingData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create payment intent');
            }

            const { clientSecret } = await response.json();
            if (!clientSecret) {
                throw new Error('No client secret received');
            }

            // Store the transformed booking data
            sessionStorage.setItem('bookingData', JSON.stringify(transformedBookingData));
            sessionStorage.setItem('paymentIntent', JSON.stringify({ clientSecret }));

            router.push('/booking/payment');
        } catch (error) {
            console.error('Error creating payment intent:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create payment intent');
        }
    };

    useEffect(() => {
        const initializePage = async () => {
            try {
                // Get booking data and payment intent from session storage
                const bookingDataStr = sessionStorage.getItem('bookingData');
                const paymentIntentStr = sessionStorage.getItem('paymentIntent');

                if (!bookingDataStr || !paymentIntentStr) {
                    setError('No booking details found');
                    return;
                }

                const bookingData = JSON.parse(bookingDataStr);
                const { clientSecret } = JSON.parse(paymentIntentStr);

                if (!bookingData.rooms || !Array.isArray(bookingData.rooms) || bookingData.rooms.length === 0) {
                    setError('Invalid booking data: No rooms selected');
                    return;
                }

                if (!bookingData.totalAmount || bookingData.totalAmount <= 0) {
                    setError('Invalid booking data: Invalid amount');
                    return;
                }

                // Set the client secret for Stripe
                setClientSecret(clientSecret);

                // Set price breakdown from booking data
                setPriceBreakdown({
                    subtotal: bookingData.priceBreakdown?.subtotal || 0,
                    tax: bookingData.priceBreakdown?.tax || 0,
                    securityDeposit: bookingData.priceBreakdown?.securityDeposit || 0,
                    total: bookingData.totalAmount,
                    isVerified: bookingData.priceBreakdown?.isVerified || false
                });

                setIsLoading(false);
            } catch (error) {
                console.error('Error initializing payment page:', error);
                setError('Failed to load payment details');
                setIsLoading(false);
            }
        };

        initializePage();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Error</h1>
                            <p className="text-gray-600 mb-8">{error}</p>
                            <div className="space-y-4">
                                <button
                                    onClick={() => router.push('/booking')}
                                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-200 transition-colors"
                                >
                                    Return to Home
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => router.push('/summary')}
                        className="mb-6 flex items-center text-blue-600 hover:text-blue-800"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Summary
                    </button>

                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-8">Payment Details</h1>

                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                                <strong className="font-bold">Error: </strong>
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}

                        <div className="mb-8">
                            <h2 className="text-xl font-semibold mb-4">Price Summary</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>${priceBreakdown.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Tax (3.5%)</span>
                                    <span>${priceBreakdown.tax.toFixed(2)}</span>
                                </div>
                                {!priceBreakdown.isVerified && (
                                    <div className="flex justify-between text-gray-600">
                                        <div>
                                            <span>Membership Fee</span>
                                            <div className="text-xs text-gray-500">
                                                (Required for first booking - refundable)
                                            </div>
                                        </div>
                                        <span>${priceBreakdown.securityDeposit.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between font-semibold">
                                        <span>Total</span>
                                        <span className="text-blue-600">${priceBreakdown.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {clientSecret && (
                            <>
                                <Elements
                                    stripe={stripePromise}
                                    options={{
                                        clientSecret,
                                        appearance,
                                    }}
                                >
                                    <PaymentForm priceBreakdown={priceBreakdown} clientSecret={clientSecret} />
                                </Elements>

                                <div className="mt-8 flex items-center justify-center space-x-2 text-gray-500 text-sm">
                                    <span>Powered by</span>
                                    <svg className="h-6" viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                        <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.1 1.03a4.7 4.7 0 0 1 3.28-1.29c3.28 0 5.52 3.33 5.52 7.52 0 4.7-2.25 7.47-5.62 7.47zM40 8.95c-.9 0-1.81.37-2.28.93l.02 7.43c.44.5 1.3.93 2.26.93 1.76 0 2.98-1.84 2.98-4.64 0-2.84-1.24-4.65-2.98-4.65zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.8 2.2 2.84 3.72 2.84v3.75c-2.15 0-4.31-.23-5.89-1.66-1.7-1.57-1.95-3.71-1.95-5.73V3.51l4.12-.88v4.01h3.72v3.35h-3.72v4.26zm-8.61-4.72v9.79H2.64V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86z" fillRule="evenodd"></path>
                                    </svg>
                                </div>
                            </>
                        )}

                        {!clientSecret && !error && (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PaymentPage; 