'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';

interface PaymentError {
    message: string;
    code?: string;
    decline_code?: string;
}

interface Booking {
    _id: string;
    roomId: string;
    timeSlot: 'full' | 'morning' | 'evening';
    dates: string[];
    status: 'pending' | 'confirmed' | 'failed';
    totalAmount: number;
    paymentDetails: {
        status: string;
        createdAt: string;
        paymentIntentId?: string;
        confirmedAt?: string;
        error?: PaymentError;
    };
    createdAt: string;
}

const MyBookingsPage = () => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            toast.error('Please login to view your bookings');
            router.push('/login?callbackUrl=/my-bookings');
            return;
        }

        const fetchBookings = async () => {
            try {
                const response = await fetch('/api/bookings');
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to fetch bookings');
                }

                const data = await response.json();
                setBookings(data.bookings);
            } catch (error) {
                console.error('Error fetching bookings:', error);
                toast.error(error instanceof Error ? error.message : 'Failed to fetch bookings');
            } finally {
                setIsLoading(false);
            }
        };

        if (status === 'authenticated') {
            fetchBookings();
        }
    }, [status, router]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getTimeSlotText = (timeSlot: 'full' | 'morning' | 'evening') => {
        switch (timeSlot) {
            case 'full':
                return '8:00 AM - 5:00 PM';
            case 'morning':
                return '8:00 AM - 12:00 PM';
            case 'evening':
                return '1:00 PM - 5:00 PM';
        }
    };

    const getPaymentStatusText = (status: string | undefined) => {
        switch (status) {
            case 'succeeded':
                return 'Paid';
            case 'rejected':
                return 'Payment Rejected';
            default:
                return 'Payment Rejected';
        }
    };

    const getPaymentStatusColor = (status: string | undefined) => {
        switch (status) {
            case 'succeeded':
                return 'bg-green-100 text-green-800';
            case 'rejected':
            default:
                return 'bg-red-100 text-red-800';
        }
    };

    const handleViewDetails = (booking: Booking) => {
        // Base prices
        const fullDayPrice = 300;
        const halfDayPrice = 160;

        // Determine base price based on time slot
        let basePrice;
        if (booking.timeSlot === 'full') {
            basePrice = fullDayPrice;
        } else {
            // Both morning and evening slots are half-day prices
            basePrice = halfDayPrice;
        }

        const subtotal = basePrice * booking.dates.length;
        const tax = subtotal * 0.035; // 3.5% tax

        // Check if this is the user's first booking
        const isFirstBooking = bookings.every(b =>
            new Date(booking.createdAt) <= new Date(b.createdAt)
        );

        // Only apply security deposit for first booking
        const securityDeposit = isFirstBooking ? 250 : 0;

        // Round to 2 decimal places
        const total = Math.round((subtotal + tax + securityDeposit) * 100) / 100;

        // Store booking data for confirmation page
        const confirmationData = {
            rooms: [{
                id: parseInt(booking.roomId),
                name: `Room ${booking.roomId}`,
                timeSlot: booking.timeSlot,
                dates: booking.dates
            }],
            totalAmount: total,
            bookingType: 'daily', // Always set to daily for individual bookings
            bookingDate: booking.createdAt,
            priceBreakdown: {
                subtotal: subtotal,
                tax: tax,
                securityDeposit: securityDeposit,
                total: total,
                isFirstBooking: isFirstBooking
            }
        };

        // Store in session storage
        sessionStorage.setItem('confirmationData', JSON.stringify(confirmationData));
        router.push('/booking/confirmation');
    };

    // Helper function to calculate total amount
    const calculateTotalAmount = (booking: Booking): number => {
        // Base prices
        const fullDayPrice = 300;
        const halfDayPrice = 160;

        // Determine base price based on time slot
        let basePrice;
        if (booking.timeSlot === 'full') {
            basePrice = fullDayPrice;
        } else {
            // Both morning and evening slots are half-day prices
            basePrice = halfDayPrice;
        }

        const subtotal = basePrice * booking.dates.length;
        const tax = subtotal * 0.035; // 3.5% tax

        // Check if this is the user's first booking by comparing creation dates
        const isFirstBooking = bookings.every(b =>
            new Date(booking.createdAt) <= new Date(b.createdAt)
        );

        // Only apply security deposit for first booking
        const securityDeposit = isFirstBooking ? 250 : 0;

        // Round to 2 decimal places
        return Math.round((subtotal + tax + securityDeposit) * 100) / 100;
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
            <Header />

            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800">My Bookings</h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Home
                        </button>
                        <button
                            onClick={() => router.push('/booking')}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Make New Booking
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto">
                    {bookings.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                            <h2 className="text-xl font-semibold text-gray-700 mb-4">No Bookings Found</h2>
                            <p className="text-gray-600 mb-6">You haven't made any bookings yet.</p>
                            <button
                                onClick={() => router.push('/booking')}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                            >
                                Make a Booking
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {bookings.map((booking) => (
                                <div key={booking._id} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Left Section - Room Info */}
                                        <div className="w-full md:w-1/4 bg-gray-50 p-6 flex flex-col justify-between">
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-800">Room {booking.roomId}</h2>
                                                <p className="text-gray-600 mt-2">{getTimeSlotText(booking.timeSlot)}</p>
                                                <div className={`mt-4 inline-flex px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(booking.paymentDetails?.status)}`}>
                                                    {getPaymentStatusText(booking.paymentDetails?.status)}
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-sm text-gray-500">Booked on:</p>
                                                <p className="text-sm font-medium">{new Date(booking.createdAt).toLocaleDateString()}</p>
                                                {booking.paymentDetails?.confirmedAt && (
                                                    <div className="mt-2">
                                                        <p className="text-sm text-green-600">Payment confirmed:</p>
                                                        <p className="text-sm font-medium text-green-700">
                                                            {new Date(booking.paymentDetails.confirmedAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Middle Section - Dates */}
                                        <div className="w-full md:w-2/4 p-6 border-t md:border-t-0 md:border-l md:border-r border-gray-200">
                                            <h3 className="text-sm font-medium text-gray-600 mb-4">Selected Dates:</h3>
                                            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2">
                                                {booking.dates.map((date) => (
                                                    <div key={date} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
                                                        {formatDate(date)}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Payment Error Section */}
                                            {booking.paymentDetails?.status === 'rejected' && (
                                                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <h3 className="text-sm font-medium text-red-800 mb-2">Payment Failed</h3>
                                                    <p className="text-sm text-red-700">{booking.paymentDetails.error?.message || 'Payment was rejected'}</p>
                                                    {booking.paymentDetails.error?.code && (
                                                        <p className="text-xs text-red-600 mt-1">Error Code: {booking.paymentDetails.error.code}</p>
                                                    )}
                                                    {booking.paymentDetails.error?.decline_code && (
                                                        <p className="text-xs text-red-600 mt-1">Decline Code: {booking.paymentDetails.error.decline_code}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Section - Price and Actions */}
                                        <div className="w-full md:w-1/4 p-6 bg-gray-50">
                                            <div className="h-full flex flex-col justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Amount:</p>
                                                    <p className="text-2xl font-bold text-blue-600 mb-4">
                                                        ${calculateTotalAmount(booking).toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Includes tax and applicable security deposit
                                                    </p>
                                                </div>
                                                <div className="mt-6">
                                                    {booking.paymentDetails?.status === 'rejected' ? (
                                                        <button
                                                            onClick={() => router.push('/booking')}
                                                            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                                                        >
                                                            Try New Booking
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleViewDetails(booking)}
                                                            className="w-full bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                                                        >
                                                            View Details
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyBookingsPage; 