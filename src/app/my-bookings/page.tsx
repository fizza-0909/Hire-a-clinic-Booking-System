'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
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

interface Booking {
    _id: string;
    rooms: BookingRoom[];
    status: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    priceBreakdown: {
        subtotal: number;
        tax: number;
        securityDeposit: number;
        total: number;
    };
}

const formatTimeSlot = (timeSlot?: string) => {
    if (!timeSlot) return 'N/A';
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

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const MyBookingsPage = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const response = await fetch('/api/bookings/user');
                if (!response.ok) {
                    throw new Error('Failed to fetch bookings');
                }
                const data = await response.json();
                setBookings(data.bookings);
            } catch (error) {
                console.error('Error fetching bookings:', error);
                toast.error('Failed to load bookings');
            } finally {
                setLoading(false);
            }
        };

        if (status === 'authenticated') {
            fetchBookings();
        }
    }, [status]);

    const handleDownloadConfirmation = async (booking: Booking) => {
        try {
            // Format the booking data for PDF generation
            debugger
            const bookingDetails = {
                customerName: session?.user?.name || 'Guest',
                email: session?.user?.email || '',
                bookingNumber: booking?._id,
                bookingType: 'Daily', // This would need to be dynamic if you have different types
                bookingDate: new Date(booking?.createdAt).toLocaleDateString(),
                roomDetails: booking?.rooms?.map(room => ({
                    roomNumber: room?.roomId,
                    timeSlot: formatTimeSlot(room?.timeSlot),
                    dates: room?.dates?.map(date => 
                        new Date(date?.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })
                    )
                })),
                paymentDetails: {
                    subtotal: booking?.priceBreakdown?.subtotal,
                    tax: booking?.priceBreakdown?.tax,
                    securityDeposit: booking?.priceBreakdown?.securityDeposit,
                    totalAmount: booking?.priceBreakdown?.total
                }
            };
            console.log(bookingDetails);
            // Generate and download PDF
            const doc = generateBookingPDF(bookingDetails);
            doc.save(`booking-confirmation-${booking._id}.pdf`);
            
            toast.success('Booking confirmation downloaded as PDF');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error(`${error?.message} ${error?.stack}` || 'Failed to generate PDF');
        }
    };

    const renderPriceBreakdown = (booking: Booking) => {
        const { subtotal, tax, securityDeposit, total } = booking.priceBreakdown || {
            subtotal: booking.totalAmount - (booking?.paymentDetails?.securityDeposit || 0),
            tax: (booking.totalAmount - (booking?.paymentDetails?.securityDeposit || 0)) * 0.035,
            securityDeposit: booking?.paymentDetails?.securityDeposit || 0,
            total: booking.totalAmount
        };

        return (
            <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-lg font-semibold">
                        ${subtotal?.toFixed(2)}
                    </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 mb-2">
                    <span>Tax (3.5%):</span>
                    <span>${tax?.toFixed(2)}</span>
                </div>
                {securityDeposit > 0 && (
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <span className="text-gray-600">Security Deposit</span>
                            <span className="ml-1 text-xs text-blue-600">(Refundable)</span>
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                            ${securityDeposit?.toFixed(2)}
                        </span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="text-lg font-semibold text-blue-600">
                        ${total?.toFixed(2)}
                    </span>
                </div>
                {securityDeposit > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                        *The security deposit will be refunded after your booking is completed successfully
                    </p>
                )}
            </div>
        );
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
                            <button
                                onClick={() => router.push('/booking')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                            >
                                New Booking
                            </button>
                        </div>

                        {bookings.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-600 mb-4">You haven't made any bookings yet.</p>
                                <button
                                    onClick={() => router.push('/booking')}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Make Your First Booking
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {bookings.map((booking) => (
                                    <div
                                        key={booking._id}
                                        className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {/* Left Column - Booking Overview */}
                                            <div className="md:w-2/3 space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-800 mb-1">Booking #{booking._id.slice(-6).toUpperCase()}</h3>
                                                        <p className="text-gray-600">
                                                            Booked on {new Date(booking.createdAt).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                                                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                        </span>
                                                        <button
                                                            onClick={() => {handleDownloadConfirmation(booking)}}
                                                            className="p-2 rounded-full hover:bg-gray-100 text-blue-600 hover:text-blue-800 transition-colors"
                                                            title="Download Confirmation"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Rooms Grid */}
                                                <div className="grid grid-cols-1 gap-4">
                                                    {booking.rooms?.map((room, roomIndex) => (
                                                        <div 
                                                            key={`${booking._id}-${room.roomId}-${roomIndex}`}
                                                            className={`p-4 rounded-lg ${
                                                                room.timeSlot === 'morning' 
                                                                    ? 'bg-gradient-to-r from-blue-50 to-white' 
                                                                    : room.timeSlot === 'evening'
                                                                    ? 'bg-gradient-to-r from-blue-100 to-white'
                                                                    : 'bg-blue-50'
                                                            }`}
                                                        >
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-500">Room</p>
                                                                    <p className="font-semibold text-lg">Room {room.roomId}</p>
                                                                    <p className="text-sm text-gray-600">{room.name}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-500">Time Slot</p>
                                                                    <p className="font-semibold">{formatTimeSlot(room.timeSlot)}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-500">Dates ({room.dates?.length})</p>
                                                                    <div className="space-y-1 mt-1">
                                                                        {room.dates?.slice(0, 2).map((date, i) => (
                                                                            <p key={i} className="text-sm">
                                                                                {formatDate(date.date)}: {date.startTime} - {date.endTime}
                                                                            </p>
                                                                        ))}
                                                                        {room.dates?.length > 2 && (
                                                                            <p className="text-xs text-blue-600">+{room.dates.length - 2} more dates</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Right Column - Price Summary */}
                                            <div className="md:w-1/3">
                                                <div className="bg-gray-50 p-4 rounded-lg h-full">
                                                    <h4 className="font-semibold text-lg mb-4 pb-2 border-b border-gray-200">Price Summary</h4>
                                                    {renderPriceBreakdown(booking)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MyBookingsPage;