'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';

interface Booking {
    _id: string;
    roomId: string;
    timeSlot: 'full' | 'morning' | 'evening';
    dates: string[];
    status: 'pending' | 'confirmed';
    totalAmount: number;
    paymentDetails: {
        status: string;
        createdAt: string;
        paymentIntentId?: string;
        confirmedAt?: string;
        failureMessage?: string;
    };
    createdAt: string;
    paymentStatus: string;
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
            case 'pending':
                return 'Payment Pending';
            case 'failed':
                return 'Payment Failed';
            default:
                return 'Payment Information Not Available';
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
            bookingType: booking.dates.length > 1 ? 'monthly' : 'daily',
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

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-8">My Bookings</h1>

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
                        <div className="space-y-6">
                            {bookings.map((booking) => (
                                <div key={booking._id} className="bg-white rounded-2xl shadow-xl p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-800">Room {booking.roomId}</h2>
                                            <p className="text-gray-600">{getTimeSlotText(booking.timeSlot)}</p>
                                            <p className="text-sm text-gray-500 mt-1">Booked on: {booking.createdAt}</p>
                                            {booking.paymentDetails?.confirmedAt && (
                                                <p className="text-sm text-green-600 mt-1">
                                                    Payment confirmed on: {new Date(booking.paymentDetails.confirmedAt).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${booking.paymentDetails?.status === 'succeeded'
                                                ? 'bg-green-100 text-green-800'
                                                : booking.paymentDetails?.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : booking.paymentDetails?.status === 'failed'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {getPaymentStatusText(booking.paymentDetails?.status)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-600 mb-2">Dates:</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {booking.dates.map((date) => (
                                                    <div key={date} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
                                                        {formatDate(date)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                                            <div>
                                                <p className="text-sm text-gray-600">Total Amount:</p>
                                                <p className="text-lg font-semibold text-blue-600">
                                                    ${calculateTotalAmount(booking).toFixed(2)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleViewDetails(booking)}
                                                className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MyBookingsPage; 