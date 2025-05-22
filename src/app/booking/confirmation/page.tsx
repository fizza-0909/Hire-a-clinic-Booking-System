'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { formatDate } from '@/lib/utils';
import { generateBookingPDF } from '@/utils/pdfGenerator';

interface BookingDate {
    date: string;
    startTime: string;
    endTime: string;
}

interface BookingRoom {
    roomId: string;
    name: string;
    timeSlot: 'full' | 'morning' | 'evening';
    dates: BookingDate[];
}

interface BookingDetails {
    _id: string;
    rooms: BookingRoom[];
    status: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    paymentDetails?: {
        amount: number;
        securityDeposit?: number;
    };
}

interface ConfirmationResponse {
    message: string;
    bookings: BookingDetails[];
    paymentStatus: string;
}

const formatTimeSlot = (timeSlot: string): string => {
    switch (timeSlot) {
        case 'full':
            return '8:00 AM - 5:00 PM';
        case 'morning':
            return '8:00 AM - 12:00 PM';
        case 'evening':
            return '1:00 PM - 5:00 PM';
        default:
            return timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1);
    }
};

const getTimeSlotStyle = (timeSlot: string): string => {
    switch (timeSlot) {
        case 'full':
            return 'bg-blue-600';
        case 'morning':
            return 'bg-green-600';
        case 'evening':
            return 'bg-purple-600';
        default:
            return 'bg-gray-600';
    }
};

interface BookingConfirmation {
    customerName: string;
    email: string;
    bookingNumber: string;
    bookingType: string;
    bookingDate: string;
    roomDetails: Array<{
        roomNumber: string;
        timeSlot: string;
        dates: string[];
    }>;
    paymentDetails: {
        subtotal: number;
        tax: number;
        securityDeposit: number;
        totalAmount: number;
    };
}

const BookingConfirmationPage = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const [bookingDetails, setBookingDetails] = useState<BookingConfirmation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookingDetails = async () => {
            try {
                const bookingDataStr = sessionStorage.getItem('bookingData');
                const paymentIntentStr = sessionStorage.getItem('paymentIntent');

                if (!bookingDataStr || !paymentIntentStr) {
                    throw new Error('Booking data not found');
                }

                const bookingData = JSON.parse(bookingDataStr);
                const paymentIntent = JSON.parse(paymentIntentStr);

                // Format the booking details
                const confirmation: BookingConfirmation = {
                    customerName: `${session?.user?.firstName} ${session?.user?.lastName}`,
                    email: session?.user?.email || '',
                    bookingNumber: `BK${Date.now().toString().slice(-6)}`,
                    bookingType: bookingData.bookingType,
                    bookingDate: new Date().toLocaleDateString(),
                    roomDetails: bookingData.rooms.map((room: any) => ({
                        roomNumber: room.roomId,
                        timeSlot: room.timeSlot === 'morning' ? '8:00 AM - 12:00 PM' :
                                 room.timeSlot === 'evening' ? '1:00 PM - 5:00 PM' :
                                 '8:00 AM - 5:00 PM',
                        dates: room.dates.map((date: any) => 
                            new Date(date.date || date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })
                        )
                    })),
                    paymentDetails: {
                        subtotal: bookingData.totalAmount,
                        tax: bookingData.totalAmount * 0.035, // 3.5% tax
                        securityDeposit: !session?.user?.isVerified ? 250 : 0,
                        totalAmount: bookingData.totalAmount + (bookingData.totalAmount * 0.035) + (!session?.user?.isVerified ? 250 : 0)
                    }
                };

                setBookingDetails(confirmation);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching booking details:', error);
                toast.error('Failed to load booking details');
                router.push('/booking');
            }
        };

        fetchBookingDetails();
    }, [session, router]);

    const handleDownloadPDF = () => {
        if (!bookingDetails) return;

        try {
            const doc = generateBookingPDF(bookingDetails);
            doc.save(`booking-confirmation-${bookingDetails.bookingNumber}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Booking Confirmed!</h1>
                        <p className="text-gray-600">Thank you for your booking. Your confirmation details are below.</p>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Customer Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-gray-600">Name</p>
                                <p className="font-medium">{bookingDetails?.customerName}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Email</p>
                                <p className="font-medium">{bookingDetails?.email}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Booking Number</p>
                                <p className="font-medium">{bookingDetails?.bookingNumber}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Booking Type</p>
                                <p className="font-medium capitalize">{bookingDetails?.bookingType}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Room Details</h2>
                        {bookingDetails?.roomDetails.map((room, index) => (
                            <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-gray-600">Room Number</p>
                                        <p className="font-medium">{room.roomNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Time Slot</p>
                                        <p className="font-medium">{room.timeSlot}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-gray-600 mb-2">Dates</p>
                                    <ul className="list-disc list-inside">
                                        {room.dates.map((date, dateIndex) => (
                                            <li key={dateIndex} className="text-gray-800">{date}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">${bookingDetails?.paymentDetails.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tax (3.5%)</span>
                                <span className="font-medium">${bookingDetails?.paymentDetails.tax.toFixed(2)}</span>
                            </div>
                            {(bookingDetails?.paymentDetails?.securityDeposit ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Security Deposit (Refundable)</span>
                                    <span className="font-medium">${bookingDetails?.paymentDetails.securityDeposit.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between font-semibold">
                                    <span>Total Amount</span>
                                    <span className="text-blue-600">${bookingDetails?.paymentDetails.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center mt-8">
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Confirmation PDF
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default BookingConfirmationPage; 