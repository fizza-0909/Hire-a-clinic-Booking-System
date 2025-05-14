'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { PRICING, TimeSlot, BookingType } from '@/constants/pricing';
import Header from '@/components/Header';
import { useSession } from 'next-auth/react';
import { loadStripe } from '@stripe/stripe-js';

interface Room {
    id: number;
    timeSlot: TimeSlot;
    dates: string[];
}

interface PriceBreakdown {
    subtotal: number;
    tax: number;
    securityDeposit: number;
    total: number;
}

interface BookingData {
    rooms: Room[];
    bookingType: BookingType;
    totalAmount: number;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const calculatePriceBreakdown = (rooms: Room[], type: BookingType): PriceBreakdown => {
    let subtotal = 0;
    let securityDeposit = 0;

    rooms.forEach(room => {
        if (room.dates.length === 0) return;

        const basePrice = PRICING[type][room.timeSlot];

        if (type === 'daily') {
            subtotal += basePrice * room.dates.length;
        } else {
            subtotal += basePrice;
        }
    });

    if (rooms.some(room => room.dates.length > 0)) {
        securityDeposit = PRICING.securityDeposit;
    }

    const tax = subtotal * PRICING.taxRate;
    const total = subtotal + tax + securityDeposit;

    return {
        subtotal,
        tax,
        securityDeposit,
        total
    };
};

const SummaryPage = () => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
    const [bookingType, setBookingType] = useState<BookingType>('daily');
    const [isProcessing, setIsProcessing] = useState(false);
    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown>({
        subtotal: 0,
        tax: 0,
        securityDeposit: 0,
        total: 0
    });

    useEffect(() => {
        if (status === 'unauthenticated') {
            toast.error('Please login to continue');
            router.push('/login?callbackUrl=/booking/summary');
            return;
        }

        const bookingDataStr = sessionStorage.getItem('bookingData');
        if (!bookingDataStr) {
            toast.error('No booking details found');
            router.push('/booking');
            return;
        }

        try {
            const bookingData = JSON.parse(bookingDataStr) as BookingData;
            setSelectedRooms(bookingData.rooms);
            setBookingType(bookingData.bookingType);

            const priceBreakdownData = calculatePriceBreakdown(bookingData.rooms, bookingData.bookingType);
            setPriceBreakdown(priceBreakdownData);

            const updatedBookingData = {
                ...bookingData,
                totalAmount: priceBreakdownData.total
            };
            sessionStorage.setItem('bookingData', JSON.stringify(updatedBookingData));
        } catch (error) {
            console.error('Error parsing booking data:', error);
            toast.error('Invalid booking data');
            router.push('/booking');
        }
    }, [router, status]);

    const handleRemoveDate = (roomId: number, dateToRemove: string) => {
        if (bookingType !== 'daily') {
            toast.error('Dates cannot be modified for monthly bookings');
            return;
        }

        const updatedRooms = selectedRooms.map(room => {
            if (room.id === roomId) {
                const updatedDates = room.dates.filter(date => date !== dateToRemove);
                return {
                    ...room,
                    dates: updatedDates
                };
            }
            return room;
        }).filter(room => room.dates.length > 0);

        if (updatedRooms.length === 0) {
            toast.error('Cannot remove all dates. Please keep at least one booking.');
            return;
        }

        setSelectedRooms(updatedRooms);
        const newPriceBreakdown = calculatePriceBreakdown(updatedRooms, bookingType);
        setPriceBreakdown(newPriceBreakdown);

        const bookingData = {
            rooms: updatedRooms,
            bookingType,
            totalAmount: newPriceBreakdown.total
        };
        sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
        toast.success('Date removed successfully');
    };

    const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleProceedToPayment = async () => {
        try {
            setIsProcessing(true);
            console.log('Starting payment process...');

            // Validate the data before proceeding
            if (!selectedRooms || selectedRooms.length === 0) {
                throw new Error('No rooms selected');
            }

            // Log the current state
            console.log('Current state:', {
                selectedRooms,
                bookingType,
                priceBreakdown
            });

            // Ensure all rooms have dates
            const invalidRooms = selectedRooms.filter(room => !room.dates || room.dates.length === 0);
            if (invalidRooms.length > 0) {
                throw new Error('Some rooms have no dates selected');
            }

            if (priceBreakdown.total <= 0) {
                throw new Error('Invalid total amount');
            }

            const paymentData = {
                amount: Math.round(priceBreakdown.total * 100), // Convert to cents for Stripe
                bookingData: {
                    rooms: selectedRooms.map(room => ({
                        id: room.id,
                        timeSlot: room.timeSlot,
                        dates: [...room.dates] // Ensure dates are properly copied
                    })),
                    bookingType,
                    totalAmount: priceBreakdown.total
                }
            };

            console.log('Sending payment request:', JSON.stringify(paymentData, null, 2));

            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
            });

            console.log('Response status:', response.status);
            const responseData = await response.json();
            console.log('Response data:', responseData);

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to create payment intent');
            }

            if (!responseData.clientSecret) {
                throw new Error('No client secret received from payment intent creation');
            }

            // Store booking data with consistent structure
            const bookingDataToStore = {
                rooms: selectedRooms.map(room => ({
                    id: room.id,
                    name: `Room ${room.id}`,
                    timeSlot: room.timeSlot,
                    dates: [...room.dates] // Ensure dates are properly copied
                })),
                totalAmount: priceBreakdown.total,
                bookingType,
                bookingDate: new Date().toISOString(),
                priceBreakdown: {
                    subtotal: priceBreakdown.subtotal,
                    tax: priceBreakdown.tax,
                    securityDeposit: priceBreakdown.securityDeposit,
                    total: priceBreakdown.total
                }
            };

            console.log('Storing booking data:', JSON.stringify(bookingDataToStore, null, 2));

            // Clear any existing data first
            sessionStorage.removeItem('bookingData');
            sessionStorage.removeItem('paymentIntent');

            // Store new data
            sessionStorage.setItem('bookingData', JSON.stringify(bookingDataToStore));
            sessionStorage.setItem('paymentIntent', JSON.stringify({
                clientSecret: responseData.clientSecret
            }));

            console.log('Data stored, redirecting to payment page...');
            router.push('/booking/payment');
        } catch (error) {
            console.error('Payment setup error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to setup payment. Please try again.');
            // Log the full error details
            console.error('Full error details:', {
                error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (status === 'loading') {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <Header />

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Calendar
                    </button>

                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-8">Booking Summary</h1>

                        <div className="space-y-6 mb-8">
                            {selectedRooms.map((room) => (
                                <div key={room.id} className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-lg mb-4">Room {room.id}</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <span className="text-gray-600 text-sm">Time Slot:</span>
                                            <p className="font-medium">
                                                {room.timeSlot === 'full' ? 'Full Day (8:00 AM - 5:00 PM)' :
                                                    room.timeSlot === 'morning' ? 'Morning (8:00 AM - 12:00 PM)' :
                                                        'Evening (1:00 PM - 5:00 PM)'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600 text-sm">Booking Type:</span>
                                            <p className="font-medium capitalize">{bookingType}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-gray-600 text-sm">Selected Dates:</span>
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {room.dates.map((date) => (
                                                <div key={date}
                                                    className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                                                    <span className="text-sm">{formatDate(date)}</span>
                                                    {bookingType === 'daily' && (
                                                        <button
                                                            onClick={() => handleRemoveDate(room.id, date)}
                                                            className="text-red-500 hover:text-red-700 ml-2"
                                                            title="Remove date"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-200 pt-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4">Price Breakdown</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>${priceBreakdown.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Tax (3.5%)</span>
                                    <span>${priceBreakdown.tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <div>
                                        <span>Security Deposit</span>
                                        <div className="text-xs text-gray-500">(Refundable)</div>
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

                        <div className="mt-8">
                            <button
                                onClick={handleProceedToPayment}
                                disabled={isProcessing}
                                className={`w-full flex items-center justify-center py-4 px-6 rounded-lg text-white font-medium 
                                    ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                                    transition-colors duration-200`}
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    'Proceed to Payment'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SummaryPage; 