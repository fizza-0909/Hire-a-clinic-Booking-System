'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

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
    paymentDetails?: {
        amount: number;
        securityDeposit?: number;
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

    const handleDownloadConfirmation = (booking: Booking) => {
        try {
            // Create booking summary text
            const summary = [
                '=== HIRE A CLINIC - BOOKING CONFIRMATION ===',
                '',
                `Booking ID: ${booking._id}`,
                'Rooms:',
                ...booking.rooms.map(room => [
                    `  Room ${room.roomId}:`,
                    `  Time Slot: ${formatTimeSlot(room.timeSlot)}`,
                    '  Dates:',
                    ...room.dates.map(date => `    - ${formatDate(date.date)} (${date.startTime} - ${date.endTime})`)
                ]).flat(),
                '',
                `Amount Paid: $${booking.totalAmount.toFixed(2)}`,
                booking.paymentDetails?.securityDeposit ? `Security Deposit: $${booking.paymentDetails.securityDeposit.toFixed(2)}` : '',
                `Booking Date: ${new Date(booking.createdAt).toLocaleString()}`,
                '',
                '=== ADDITIONAL INFORMATION ===',
                'For any queries, please contact our support team.',
                '',
                '=== TERMS AND CONDITIONS ===',
                '1. Please arrive 15 minutes before your scheduled time',
                '2. Cancellations must be made 48 hours in advance',
                '3. Please follow all clinic safety protocols',
                '4. Keep this confirmation for your records'
            ].filter(Boolean).join('\n');

            // Create blob and download
            const blob = new Blob([summary], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `booking-${booking._id}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Booking confirmation downloaded successfully');
        } catch (error) {
            console.error('Error downloading confirmation:', error);
            toast.error('Failed to download confirmation');
        }
    };

    const renderPriceBreakdown = (booking: Booking) => {
        const subtotal = booking.totalAmount - (booking.paymentDetails?.securityDeposit || 0);
        const tax = subtotal * 0.035; // 3.5% tax
        const securityDeposit = booking.paymentDetails?.securityDeposit || 0;
        const total = booking.totalAmount;

        return (
            <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-lg font-semibold">
                        ${subtotal.toFixed(2)}
                    </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 mb-2">
                    <span>Tax (3.5%):</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                {securityDeposit > 0 && (
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <span className="text-gray-600">Security Deposit</span>
                            <span className="ml-1 text-xs text-blue-600">(Refundable)</span>
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                            ${securityDeposit.toFixed(2)}
                        </span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="text-lg font-semibold text-blue-600">
                        ${total.toFixed(2)}
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
                                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold">
                                                    {booking.rooms?.map((room, index) => (
                                                        <span key={room.roomId}>
                                                            {`Room ${room.roomId}`}
                                                            {index < (booking.rooms?.length ?? 0) - 1 ? ', ' : ''}
                                                        </span>
                                                    )) ?? 'No rooms'}
                                                </h3>
                                                <p className="text-gray-600">
                                                    Booked on {new Date(booking.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                                                    {booking.status}
                                                </span>
                                                <button
                                                    onClick={() => handleDownloadConfirmation(booking)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Download Confirmation"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {booking.rooms?.map((room, roomIndex) => (
                                            <div 
                                                key={`${booking._id}-${room.roomId}-${roomIndex}`} 
                                                className={`p-4 rounded-lg mb-4 ${
                                                    room.timeSlot === 'morning' 
                                                        ? 'bg-gradient-to-b from-blue-100 to-white' 
                                                        : room.timeSlot === 'evening'
                                                        ? 'bg-gradient-to-t from-blue-100 to-white'
                                                        : 'bg-blue-50'
                                                }`}
                                            >
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Room</p>
                                                        <p className="font-medium">Room {room.roomId}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Time Slot</p>
                                                        <p className="font-medium">{formatTimeSlot(room.timeSlot)}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-sm text-gray-600">Dates</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                                            {room.dates?.map((date, i) => (
                                                                <p key={`${room.roomId}-${date.date}-${i}`} className="font-medium">
                                                                    {formatDate(date.date)} ({date.startTime} - {date.endTime})
                                                                </p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {renderPriceBreakdown(booking)}
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