'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import jsPDF from 'jspdf';
import { useSession } from 'next-auth/react';

interface BookingDetails {
    rooms: Array<{
        id: number;
        name: string;
        timeSlot: 'full' | 'morning' | 'evening';
        dates: string[];
    }>;
    totalAmount?: number;
    bookingType: 'daily' | 'monthly';
    bookingDate?: string;
    priceBreakdown: {
        subtotal: number;
        tax: number;
        securityDeposit: number;
        total: number;
    };
}

const PRICING = {
    daily: {
        full: 300,
        half: 160
    },
    monthly: {
        full: 2000,
        half: 1000
    }
}

const ConfirmationPage = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

    // Define user information
    const userName = session?.user ? `${session.user.firstName} ${session.user.lastName}` : 'N/A';
    const userEmail = session?.user?.email || 'N/A';
    const userPhone = session?.user?.phoneNumber || 'N/A';

    useEffect(() => {
        try {
            // Check for Stripe payment status in URL
            const params = new URLSearchParams(window.location.search);
            const paymentIntentId = params.get('payment_intent');
            const paymentIntentClientSecret = params.get('payment_intent_client_secret');

            // First try to get confirmation data
            const confirmationData = sessionStorage.getItem('confirmationData');

            // If we have confirmation data, use it
            if (confirmationData) {
                try {
                    const parsedData = JSON.parse(confirmationData);
                    setBookingDetails(parsedData);
                    setIsLoading(false);
                    return;
                } catch (error) {
                    console.error('Error parsing confirmation data:', error);
                }
            }

            // If we don't have confirmation data but have payment intent, try to get booking data
            if (paymentIntentId && paymentIntentClientSecret) {
                const bookingData = sessionStorage.getItem('bookingData');
                console.log('Retrieved booking data:', bookingData);

                if (!bookingData) {
                    console.error('No booking data found in sessionStorage');
                    toast.error('No booking confirmation found');
                    router.push('/booking');
                    return;
                }

                try {
                    // Parse and validate the data
                    const parsedData = JSON.parse(bookingData);

                    // Validate required fields
                    if (!parsedData.rooms || !Array.isArray(parsedData.rooms) || parsedData.rooms.length === 0) {
                        throw new Error('Invalid booking data: No rooms found');
                    }

                    if (!parsedData.bookingType) {
                        throw new Error('Invalid booking data: No booking type found');
                    }

                    // Store confirmation data
                    sessionStorage.setItem('confirmationData', bookingData);
                    console.log('Stored confirmation data successfully');

                    // Set the booking details
                    setBookingDetails(parsedData);
                    setIsLoading(false);

                    // Clean up booking data only after successful setup
                    sessionStorage.removeItem('bookingData');
                    sessionStorage.removeItem('paymentIntent');
                } catch (error) {
                    console.error('Error processing booking data:', error);
                    toast.error('Error processing booking data');
                    router.push('/booking');
                }
            } else {
                // No payment intent and no confirmation data
                console.error('No payment intent or confirmation data found');
                toast.error('No booking confirmation found');
                router.push('/booking');
            }
        } catch (error) {
            console.error('Error in confirmation page:', error);
            toast.error('Failed to load booking confirmation');
            router.push('/booking');
        }
    }, [router]);

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

    const generatePDF = (booking: BookingDetails): jsPDF => {
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.width;
        const margin = 20;
        let yPos = 0;

        // Colors
        const primaryBlue = [37, 99, 235] as [number, number, number];
        const softBlue = [240, 247, 255] as [number, number, number];
        const textGray = [33, 33, 33] as [number, number, number];

        // --- Header Section ---
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "bold");
        const titleText = "HIRE A CLINIC";
        const titleWidth = pdf.getTextWidth(titleText);
        pdf.text(titleText, (pageWidth - titleWidth) / 2, 20);

        pdf.setFontSize(14);
        pdf.setFont("helvetica", "normal");
        const subtitleText = "Booking Confirmation";
        const subtitleWidth = pdf.getTextWidth(subtitleText);
        pdf.setTextColor(textGray[0], textGray[1], textGray[2]);
        pdf.text(subtitleText, (pageWidth - subtitleWidth) / 2, 30);

        // Divider Line
        pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 35, pageWidth - margin, 35);

        yPos = 45;

        // --- Customer Details Section ---
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.text("Customer Details", margin, yPos);
        yPos += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(textGray[0], textGray[1], textGray[2]);
        pdf.text(`Name: ${userName}`, margin, yPos + 8);
        pdf.text(`Email: ${userEmail}`, margin, yPos + 16);
        pdf.text(`Phone: ${userPhone || 'N/A'}`, margin, yPos + 24);
        pdf.text(`Booking Number: MAO${Date.now().toString(36).toUpperCase().slice(0, 5)}`, margin, yPos + 32);

        yPos += 50;

        // --- Booking Summary Section ---
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.text("Booking Summary", margin, yPos);
        yPos += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(textGray[0], textGray[1], textGray[2]);
        pdf.text(`Booking Type: Daily`, margin, yPos + 8);
        pdf.text(`Booking Date: ${formatDate(new Date().toISOString())}`, margin, yPos + 16);

        yPos += 34;

        // --- Room Details Section ---
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.text("Room Details", margin, yPos);
        yPos += 8;

        booking.rooms.forEach((room) => {
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(textGray[0], textGray[1], textGray[2]);
            pdf.text(`Room ${room.name}`, margin, yPos + 8);
            pdf.text(`Time Slot: ${getTimeSlotText(room.timeSlot)}`, margin, yPos + 16);
            pdf.text(`Dates: ${room.dates.map(date => formatDate(date)).join(', ')}`, margin, yPos + 24);
            yPos += 32;
        });

        // --- Payment Details Section ---
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.text("Payment Details", margin, yPos);
        yPos += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(textGray[0], textGray[1], textGray[2]);
        pdf.text(`Subtotal: $${booking.priceBreakdown.subtotal.toFixed(2)}`, margin, yPos + 8);
        pdf.text(`Tax: $${booking.priceBreakdown.tax.toFixed(2)}`, margin, yPos + 16);
        pdf.text(`Security Deposit (Refundable): $${booking.priceBreakdown.securityDeposit.toFixed(2)}`, margin, yPos + 24);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Total Amount: $${booking.priceBreakdown.total.toFixed(2)}`, margin, yPos + 36);

        yPos += 50;

        // Check if we need a new page for Terms and Conditions
        if (yPos > pdf.internal.pageSize.height - 100) {
            pdf.addPage();
            yPos = 20;
        }

        // --- Terms and Conditions Section ---
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        pdf.text("Terms and Conditions", margin, yPos);
        yPos += 12;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(textGray[0], textGray[1], textGray[2]);

        const terms = [
            "• Payments are non-refundable. Only the security deposit is refundable as per policy.",
            "• Renters are responsible for the equipment and space during their booked time slot.",
            "• Clinic owners must maintain a safe and professional environment.",
            "• Renters must respect booking times. If a renter arrives late, extra time will not be provided or compensated.",
            "• Any damages or misuse of the clinic will be deducted from the security deposit.",
            "• All users must follow platform policies regarding cancellations and conduct."
        ];

        terms.forEach((term) => {
            if (yPos > pdf.internal.pageSize.height - 20) {
                pdf.addPage();
                yPos = 20;
            }
            const lines = pdf.splitTextToSize(term, pageWidth - (margin * 2));
            pdf.text(lines, margin, yPos);
            yPos += (lines.length * 6) + 6;
        });

        return pdf;
    };

    const handleDownload = () => {
        if (!bookingDetails) return;
        setIsDownloading(true);

        try {
            const pdf = generatePDF(bookingDetails);
            pdf.save(`booking-confirmation-${new Date().getTime()}.pdf`);
            toast.success('Booking confirmation downloaded successfully');
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to download booking confirmation');
        } finally {
            setIsDownloading(false);
        }
    };

    const getDisplayAmount = (details: BookingDetails | null): string => {
        if (!details) return '0.00';

        // Try the direct total amount first
        if (details.totalAmount) {
            return details.totalAmount.toFixed(2);
        }

        // Fall back to price breakdown total if available
        if (details.priceBreakdown?.total) {
            return details.priceBreakdown.total.toFixed(2);
        }

        // Calculate from price breakdown components if available
        if (details.priceBreakdown) {
            const { subtotal = 0, tax = 0, securityDeposit = 0 } = details.priceBreakdown;
            return (subtotal + tax + securityDeposit).toFixed(2);
        }

        // Default fallback
        return '0.00';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!bookingDetails) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">No Booking Found</h1>
                    <p className="text-gray-600 mb-6">We couldn't find your booking confirmation.</p>
                    <button
                        onClick={() => router.push('/booking')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                        Make a New Booking
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/booking')}
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Booking
                </button>

                <h1 className="text-3xl font-bold text-center text-blue-600">HIRE A CLINIC</h1>
                <h2 className="text-xl text-center text-gray-700 mb-8">Booking Confirmation</h2>

                {isLoading ? (
                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : bookingDetails ? (
                    <div className="space-y-8">
                        {/* Customer Details Section */}
                        <section className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-blue-600 mb-4">Customer Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Name</p>
                                    <p className="font-medium">{userName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Email</p>
                                    <p className="font-medium">{userEmail}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Phone</p>
                                    <p className="font-medium">{userPhone || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Booking Number</p>
                                    <p className="font-medium">{'MAO' + Date.now().toString(36).toUpperCase().slice(0, 5)}</p>
                                </div>
                            </div>
                        </section>

                        {/* Booking Summary Section */}
                        <section className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-blue-600 mb-4">Booking Summary</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-600">Booking Type</p>
                                    <p className="font-medium capitalize">{bookingDetails.bookingType}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Booking Date</p>
                                    <p className="font-medium">{formatDate(new Date().toISOString())}</p>
                                </div>
                            </div>
                        </section>

                        {/* Room Details Section */}
                        <section className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-blue-600 mb-4">Room Details</h3>
                            <div className="space-y-4">
                                {bookingDetails.rooms.map((room, index) => (
                                    <div key={index} className="border-b pb-4 last:border-b-0">
                                        <p className="font-medium">Room {room.name}</p>
                                        <p className="text-sm text-gray-600">Time Slot: {getTimeSlotText(room.timeSlot)}</p>
                                        <p className="text-sm text-gray-600">
                                            Dates: {room.dates.map(date => formatDate(date)).join(', ')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Payment Details Section */}
                        <section className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-blue-600 mb-4">Payment Details</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span>${bookingDetails.priceBreakdown.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Tax</span>
                                    <span>${bookingDetails.priceBreakdown.tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Security Deposit (Refundable)</span>
                                    <span>${bookingDetails.priceBreakdown.securityDeposit.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                                    <span>Total Amount</span>
                                    <span>${bookingDetails.priceBreakdown.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </section>

                        {/* Download Button */}
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                            >
                                {isDownloading ? 'Generating PDF...' : 'Download Confirmation'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-600">
                        No booking details found
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfirmationPage; 