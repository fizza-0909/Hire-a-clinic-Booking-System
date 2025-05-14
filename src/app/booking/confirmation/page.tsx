'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import jsPDF from 'jspdf';

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
    const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);

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
        let yPos = 20;
        const lineHeight = 6;
        const margin = 20;
        const pageWidth = pdf.internal.pageSize.width;
        const pageHeight = pdf.internal.pageSize.height;
        const contentWidth = pageWidth - (margin * 2);

        // Add blue header bar
        pdf.setFillColor(37, 99, 235); // Blue-600
        pdf.rect(0, 0, pageWidth, 35, 'F');

        // Header text in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont("helvetica", "bold");
        const titleText = 'HIRE A CLINIC';
        const titleWidth = pdf.getTextWidth(titleText);
        pdf.text(titleText, (pageWidth - titleWidth) / 2, 20);

        pdf.setFontSize(14);
        const subtitleText = 'BOOKING CONFIRMATION';
        const subtitleWidth = pdf.getTextWidth(subtitleText);
        pdf.text(subtitleText, (pageWidth - subtitleWidth) / 2, 30);

        // Reset text color for rest of content
        pdf.setTextColor(0, 0, 0);
        yPos = 45;

        // Booking Information Section
        pdf.setFillColor(239, 246, 255); // Light blue background
        pdf.rect(margin, yPos - 5, contentWidth, 35, 'F');

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text('Booking Information', margin, yPos);
        pdf.setFont("helvetica", "normal");
        yPos += 8;

        const bookingNumber = Date.now().toString(36).toUpperCase();
        const user = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')!) : null;

        pdf.text(`Booking Number: ${bookingNumber}`, margin, yPos);
        yPos += lineHeight;
        pdf.text(`Customer Name: ${user ? user.firstName + ' ' + user.lastName : 'N/A'}`, margin, yPos);
        yPos += lineHeight;
        pdf.text(`Booking Date: ${new Date().toLocaleString()}`, margin, yPos);
        yPos += lineHeight;
        pdf.text(`Booking Type: ${booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1)}`, margin, yPos);
        yPos += 12;

        // Room Details Section with Chart
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text('ROOM DETAILS', margin, yPos);
        yPos += 8;

        // Table Header
        pdf.setFillColor(239, 246, 255);
        pdf.rect(margin, yPos - 5, contentWidth, 10, 'F');
        pdf.setFontSize(10);
        pdf.text('Room', margin + 5, yPos);
        pdf.text('Time Slot', margin + 60, yPos);
        pdf.text('Dates', margin + 120, yPos);
        yPos += 8;

        // Table Content
        pdf.setFont("helvetica", "normal");
        booking.rooms.forEach((room, index) => {
            const timeSlotText = room.timeSlot === 'full' ? '8:00 AM - 5:00 PM' :
                room.timeSlot === 'morning' ? '8:00 AM - 12:00 PM' :
                    '1:00 PM - 5:00 PM';

            if (index % 2 === 0) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, yPos - 5, contentWidth, 15, 'F');
            }

            pdf.text(`Room ${room.id}`, margin + 5, yPos);
            pdf.text(timeSlotText, margin + 60, yPos);

            // Handle dates with wrapping
            const dates = room.dates.map(date => new Date(date).toLocaleDateString());
            let dateText = dates.join(', ');
            const splitDates = pdf.splitTextToSize(dateText, contentWidth - 125);
            pdf.text(splitDates, margin + 120, yPos);

            yPos += Math.max(15, splitDates.length * 6);
        });

        // Payment Details
        yPos += 8;
        pdf.setFillColor(239, 246, 255);
        pdf.rect(margin, yPos - 5, contentWidth, 30, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text('PAYMENT DETAILS', margin, yPos);
        yPos += 8;
        pdf.setFont("helvetica", "normal");
        pdf.text(`Total Amount: $${booking.totalAmount?.toFixed(2) || booking.priceBreakdown.total.toFixed(2)}`, margin, yPos);
        yPos += lineHeight;
        pdf.text('Security Deposit: $250.00 (Refundable)', margin, yPos);

        // Contact Information at the bottom
        const contactY = pageHeight - 50;
        pdf.setFillColor(239, 246, 255);
        pdf.rect(margin, contactY - 5, contentWidth, 35, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.text('Contact Information', margin, contactY);
        pdf.setFont("helvetica", "normal");
        pdf.text('Email: test@gmail.com', margin, contactY + 8);
        pdf.text('Phone: +1 (234) 567 8900', margin, contactY + 16);

        // Footer
        const footerY = pageHeight - 10;
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(10);
        const footerText = 'Thank you for choosing Hire a Clinic!';
        const footerWidth = pdf.getTextWidth(footerText);
        pdf.text(footerText, (pageWidth - footerWidth) / 2, footerY);

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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            {/* Header */}
            <header className="sticky top-0 left-0 right-0 z-50 bg-white shadow-md">
                <Header />
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
                        <div className="text-center mb-12">
                            <div className="w-28 h-28 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg transform hover:scale-105 transition-transform duration-200">
                                <svg className="w-14 h-14 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-4xl font-bold text-gray-800 mb-3">Booking Confirmed!</h1>
                            <p className="text-lg text-gray-600 mb-1">Your booking has been successfully completed</p>
                            <p className="text-sm text-gray-500 mt-2">Booking Date: {formatDate(bookingDetails.bookingDate || new Date().toISOString())}</p>
                        </div>

                        <div className="mb-10">
                            <h2 className="text-2xl font-semibold border-b border-gray-200 pb-3 mb-6">Booking Details</h2>
                            {bookingDetails.rooms.map((room) => (
                                <div key={room.id} className="bg-gray-50 rounded-xl p-6 md:p-8 mt-4 hover:shadow-md transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold mb-4 text-gray-800">{room.name}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white rounded-lg p-4 shadow-sm">
                                            <span className="text-gray-600 text-sm block mb-1">Time Slot:</span>
                                            <p className="font-medium text-gray-800">{getTimeSlotText(room.timeSlot)}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 shadow-sm">
                                            <span className="text-gray-600 text-sm block mb-1">Booking Type:</span>
                                            <p className="font-medium text-gray-800 capitalize">{bookingDetails.bookingType}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <span className="text-gray-600 text-sm block mb-3">Selected Dates:</span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {room.dates.map((date) => (
                                                <div key={date} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                                    <span className="text-gray-800">{formatDate(date)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-200 pt-8 mb-10">
                            <h2 className="text-2xl font-semibold mb-6">Payment Summary</h2>
                            <div className="bg-blue-50 p-6 rounded-xl shadow-inner">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-medium text-gray-700">Total Amount Paid:</span>
                                    <span className="text-2xl font-bold text-blue-600">${bookingDetails.totalAmount?.toFixed(2) || bookingDetails.priceBreakdown.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className={`inline-flex items-center justify-center px-8 py-4 rounded-xl text-white text-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 ${isDownloading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {isDownloading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white mr-3"></div>
                                        Downloading...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Confirmation
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="inline-flex items-center justify-center px-8 py-4 bg-gray-100 text-gray-700 rounded-xl text-lg font-medium hover:bg-gray-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                            >
                                Back to Main Page
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ConfirmationPage; 