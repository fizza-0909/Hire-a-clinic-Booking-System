'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import Header from '@/components/Header';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PriceBreakdown {
    subtotal: number;
    tax: number;
    securityDeposit: number;
    total: number;
}

interface PaymentResponse {
    clientSecret: string;
    bookingIds: string[];
}

const PaymentForm = ({ priceBreakdown, clientSecret }: { priceBreakdown: PriceBreakdown; clientSecret: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!stripe) return;

        const query = new URLSearchParams(window.location.search);
        const paymentIntentClientSecret = query.get('payment_intent_client_secret');
        const paymentIntentId = query.get('payment_intent');

        if (paymentIntentClientSecret) {
            stripe.retrievePaymentIntent(paymentIntentClientSecret).then(({ paymentIntent }) => {
                switch (paymentIntent?.status) {
                    case 'succeeded':
                        try {
                            // Move booking data to confirmation data
                            const bookingData = sessionStorage.getItem('bookingData');
                            console.log('Retrieved booking data:', bookingData);

                            if (!bookingData) {
                                console.error('No booking data found in sessionStorage');
                                throw new Error('No booking data found');
                            }

                            // Parse and validate the booking data
                            const parsedBookingData = JSON.parse(bookingData);
                            if (!parsedBookingData.rooms || !parsedBookingData.totalAmount) {
                                console.error('Invalid booking data structure:', parsedBookingData);
                                throw new Error('Invalid booking data structure');
                            }

                            // Store confirmation data first
                            sessionStorage.setItem('confirmationData', bookingData);
                            console.log('Stored confirmation data successfully');

                            // Show success message
                            toast.success('Payment successful! Redirecting to confirmation...');

                            // Clean up booking data
                            sessionStorage.removeItem('bookingData');
                            sessionStorage.removeItem('paymentIntent');
                            console.log('Cleaned up session storage');

                            // Navigate to confirmation page after a short delay
                            setTimeout(() => {
                                router.replace('/booking/confirmation');
                            }, 1000);
                        } catch (error) {
                            console.error('Error handling payment success:', error);
                            toast.error('Error processing payment confirmation. Please check your bookings page.');

                            // In case of error, redirect to bookings page
                            router.replace('/my-bookings');
                        }
                        break;
                    case 'processing':
                        toast.loading('Payment is processing...');
                        break;
                    case 'requires_payment_method':
                        toast.error('Your payment was not successful, please try again.');
                        break;
                    default:
                        toast.error('Something went wrong with the payment.');
                        break;
                }
            });
        }
    }, [stripe, router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        setError(null);

        try {
            const { error: submitError } = await elements.submit();
            if (submitError) {
                throw new Error(submitError.message);
            }

            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/booking/confirmation`,
                    payment_method_data: {
                        billing_details: {
                            address: {
                                country: 'US',
                            },
                        },
                    },
                },
            });

            // This point will only be reached if there is an immediate error when
            // confirming the payment. For any other error, the customer will be redirected to
            // the return_url.
            if (error) {
                throw new Error(error.message);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Payment failed';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                    {error}
                </div>
            )}
            <button
                type="submit"
                disabled={!stripe || processing}
                className={`w-full py-3 px-4 rounded-lg text-white font-medium 
                    ${!stripe || processing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {processing ? (
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        Processing...
                    </div>
                ) : (
                    `Pay $${priceBreakdown.total.toFixed(2)}`
                )}
            </button>
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
        total: 0
    });

    useEffect(() => {
        const initializePage = async () => {
            try {
                // Get booking details from sessionStorage
                const bookingData = sessionStorage.getItem('bookingData');
                const paymentIntent = sessionStorage.getItem('paymentIntent');

                if (!bookingData || !paymentIntent) {
                    throw new Error('No booking details found');
                }

                const parsedData = JSON.parse(bookingData);
                const { clientSecret } = JSON.parse(paymentIntent);

                // Validate booking data
                if (!parsedData.rooms || !Array.isArray(parsedData.rooms) || parsedData.rooms.length === 0) {
                    throw new Error('Invalid booking data: No rooms selected');
                }

                if (!parsedData.totalAmount || parsedData.totalAmount <= 0) {
                    throw new Error('Invalid booking data: Invalid amount');
                }

                // Use the price breakdown directly from the stored data
                if (parsedData.priceBreakdown) {
                    setPriceBreakdown(parsedData.priceBreakdown);
                } else {
                    // Fallback calculation if priceBreakdown is not available
                    setPriceBreakdown({
                        subtotal: parsedData.totalAmount * 0.93,
                        tax: parsedData.totalAmount * 0.035,
                        securityDeposit: 250,
                        total: parsedData.totalAmount
                    });
                }

                setClientSecret(clientSecret);
            } catch (error) {
                console.error('Error processing booking data:', error);
                const errorMessage = error instanceof Error ? error.message : 'Invalid booking data';
                setError(errorMessage);
                toast.error(errorMessage);
                router.push('/booking');
            } finally {
                setIsLoading(false);
            }
        };

        initializePage();
    }, [router]);

    const handleBackClick = () => {
        setError(null);
        router.push('/summary');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <header className="sticky top-0 left-0 right-0 z-50 bg-white shadow-md">
                <Header />
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={handleBackClick}
                        className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Summary
                    </button>

                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-8">Payment Details</h1>

                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                                <strong className="font-bold">Error: </strong>
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}

                        {/* Price Summary */}
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
                                <div className="flex justify-between text-gray-600">
                                    <div>
                                        <span>Security Deposit</span>
                                        <div className="text-xs text-gray-500">($250 per room, refundable)</div>
                                    </div>
                                    <span>${priceBreakdown.securityDeposit.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between font-semibold">
                                        <span>Total</span>
                                        <span className="text-blue-600">${priceBreakdown.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stripe Payment Form */}
                        {clientSecret ? (
                            <Elements stripe={stripePromise} options={{ clientSecret }}>
                                <PaymentForm priceBreakdown={priceBreakdown} clientSecret={clientSecret} />
                            </Elements>
                        ) : error ? (
                            <div className="text-center py-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
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