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
        const pageWidth = pdf.internal.pageSize.width;
        const margin = 20;
        let yPos = 0;
    
        // Colors
        const primaryBlue = [37, 99, 235];
        const softBlue = [240, 247, 255];
        const textGray = [33, 33, 33];
    
        // --- Header Section ---
        pdf.setTextColor(...primaryBlue);
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "bold");
        const titleText = "HIRE A CLINIC";
        const titleWidth = pdf.getTextWidth(titleText);
        pdf.text(titleText, (pageWidth - titleWidth) / 2, 20);
    
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "normal");
        const subtitleText = "Booking Confirmation";
        const subtitleWidth = pdf.getTextWidth(subtitleText);
        pdf.setTextColor(...textGray);
        pdf.text(subtitleText, (pageWidth - subtitleWidth) / 2, 30);
    
        // Divider Line
        pdf.setDrawColor(...primaryBlue);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 35, pageWidth - margin, 35);
    
        yPos = 45;
    
        // --- Booking Info Section ---
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...primaryBlue);
        pdf.text("Booking Information", margin, yPos);
        yPos += 8;
    
        pdf.setFillColor(...softBlue);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 70, 3, 3, 'F');
    
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textGray);
    
        const bookingNumber = `MAO${Date.now().toString(36).toUpperCase().slice(0, 5)}`;
        pdf.text(`Booking Number: ${bookingNumber}`, margin + 6, yPos + 12);
    
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...primaryBlue);
        pdf.text("Customer Details:", margin + 6, yPos + 26);
    
        const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textGray);
        pdf.text(`  Name: ${user ? `${user.firstName} ${user.lastName}` : 'N/A'}`, margin + 6, yPos + 38);
        pdf.text(`  Email: ${user?.email || 'N/A'}`, margin + 6, yPos + 50);
        pdf.text(`  Phone: ${user?.phoneNumber || 'N/A'}`, margin + 6, yPos + 62);
    
        yPos += 80;
    
        // --- Booking Summary ---
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...primaryBlue);
        pdf.text("Booking Summary", margin, yPos);
        yPos += 10;
    
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...textGray);
        const bookingDate = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true
        });
        pdf.text(`Date: ${bookingDate}`, margin, yPos);
        pdf.text(`Type: ${booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1)}`, margin, yPos + 12);
        yPos += 28;
    
        // --- Room Details Header ---
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...primaryBlue);
        pdf.text("Room Details", margin, yPos);
        yPos += 10;
    
        pdf.setFillColor(...softBlue);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 3, 3, 'F');
    
        pdf.setFontSize(11);
        const roomCol = margin + 6;
        const timeCol = margin + 75;
        const dateCol = margin + 150;
    
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...textGray);
        pdf.text("Room", roomCol, yPos + 13);
        pdf.text("Time Slot", timeCol, yPos + 13);
        pdf.text("Date", dateCol, yPos + 13);
        yPos += 24;
    
        // --- Room Entries ---
        pdf.setFont("helvetica", "normal");
        booking.rooms.forEach((room) => {
            if (yPos + 20 > pdf.internal.pageSize.height) {
                pdf.addPage();
                yPos = 20;
            }
    
            const formattedDate = new Date(room.dates[0]).toLocaleDateString('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric'
            });
            pdf.text(`Room ${room.id}`, roomCol, yPos);
            pdf.text(getTimeSlotText(room.timeSlot), timeCol, yPos);
            pdf.text(formattedDate, dateCol, yPos);
            yPos += 14;
        });
    
        yPos += 10;
    
        // --- Payment Section ---
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...primaryBlue);
        pdf.text("Payment Details", margin, yPos);
        yPos += 8;
    
        pdf.setFillColor(...softBlue);
        pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 30, 3, 3, 'F');
    
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(...textGray);
        const total = booking.priceBreakdown.total - booking.priceBreakdown.securityDeposit;
        pdf.text(`Total Amount: $${total.toFixed(2)}`, margin + 6, yPos + 12);
        pdf.text(`Security Deposit: $${booking.priceBreakdown.securityDeposit.toFixed(2)} (Refundable)`, margin + 6, yPos + 24);
    
        return pdf;
    };
     


    // const generatePDF = (booking: BookingDetails): jsPDF => {
    //     const pdf = new jsPDF();
    //     const pageWidth = pdf.internal.pageSize.width;
    //     const margin = 20;
    //     let yPos = 0;

    //     // Header Section with solid blue background
    //     pdf.setFillColor(37, 99, 235);
    //     pdf.rect(0, 0, pageWidth, 50, 'F');

    //     // Header Text
    //     pdf.setTextColor(255, 255, 255);
    //     pdf.setFontSize(24);
    //     pdf.setFont("helvetica", "bold");
    //     const titleText = "HIRE A CLINIC";
    //     const titleWidth = pdf.getTextWidth(titleText);
    //     pdf.text(titleText, (pageWidth - titleWidth) / 2, 25);

    //     // Subtitle
    //     pdf.setFontSize(16);
    //     const subtitleText = "BOOKING CONFIRMATION";
    //     const subtitleWidth = pdf.getTextWidth(subtitleText);
    //     pdf.text(subtitleText, (pageWidth - subtitleWidth) / 2, 40);

    //     // Reset text color for main content
    //     pdf.setTextColor(0, 0, 0);
    //     yPos = 65;

    //     // Booking Information Section
    //     pdf.setFontSize(12);
    //     pdf.setFont("helvetica", "bold");
    //     pdf.text("Booking Information", margin, yPos);
    //     yPos += 10;

    //     // Light blue background for booking info
    //     pdf.setFillColor(240, 247, 255);
    //     pdf.rect(margin, yPos, pageWidth - (margin * 2), 75, 'F');

    //     // Booking details
    //     pdf.setFontSize(11);
    //     pdf.setFont("helvetica", "normal");
    //     const bookingNumber = `MAO${Date.now().toString(36).toUpperCase().slice(0, 5)}`;
    //     pdf.text(`Booking Number: ${bookingNumber}`, margin + 5, yPos + 10);

    //     pdf.text("Customer Details:", margin + 5, yPos + 25);
    //     const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
    //     pdf.text(`    Name: ${user ? `${user.firstName} ${user.lastName}` : 'N/A'}`, margin + 5, yPos + 40);
    //     pdf.text(`    Email: ${user?.email || 'N/A'}`, margin + 5, yPos + 55);
    //     pdf.text(`    Phone: ${user?.phoneNumber || 'N/A'}`, margin + 5, yPos + 70);

    //     yPos += 85;

    //     // Booking Date and Type
    //     const bookingDate = new Date().toLocaleString('en-US', {
    //         year: 'numeric',
    //         month: 'numeric',
    //         day: 'numeric',
    //         hour: 'numeric',
    //         minute: 'numeric',
    //         second: 'numeric',
    //         hour12: true
    //     });
    //     pdf.text(`Booking Date: ${bookingDate}`, margin, yPos);
    //     pdf.text(`Booking Type: ${booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1)}`, margin, yPos + 12);
    //     yPos += 30;

    //     // Room Details Section
    //     pdf.setFontSize(12);
    //     pdf.setFont("helvetica", "bold");
    //     pdf.text("ROOM DETAILS", margin, yPos);
    //     yPos += 10;

    //     // Room Details Table Header
    //     pdf.setFillColor(240, 247, 255);
    //     pdf.rect(margin, yPos, pageWidth - (margin * 2), 20, 'F');
    //     pdf.setFontSize(11);

    //     // Table headers
    //     const roomCol = margin + 5;
    //     const timeCol = margin + 80;
    //     const dateCol = margin + 160;

    //     pdf.text("Room", roomCol, yPos + 13);
    //     pdf.text("Time Slot", timeCol, yPos + 13);
    //     pdf.text("Dates", dateCol, yPos + 13);
    //     yPos += 20;

    //     // Room Details Content
    //     pdf.setFont("helvetica", "normal");
    //     booking.rooms.forEach((room) => {
    //         const formattedDate = new Date(room.dates[0]).toLocaleDateString('en-US', {
    //             year: 'numeric',
    //             month: 'numeric',
    //             day: 'numeric'
    //         });
    //         pdf.text(`Room ${room.id}`, roomCol, yPos + 13);
    //         pdf.text(getTimeSlotText(room.timeSlot), timeCol, yPos + 13);
    //         pdf.text(formattedDate, dateCol, yPos + 13);
    //         yPos += 20;
    //     });
    //     yPos += 5;

    //     // Payment Details Section
    //     pdf.setFontSize(12);
    //     pdf.setFont("helvetica", "bold");
    //     pdf.text("PAYMENT DETAILS", margin, yPos);
    //     yPos += 10;

    //     // Payment Details Box
    //     pdf.setFillColor(240, 247, 255);
    //     pdf.rect(margin, yPos, pageWidth - (margin * 2), 45, 'F');
    //     pdf.setFontSize(11);
    //     pdf.setFont("helvetica", "normal");

    //     const total = booking.priceBreakdown.total - booking.priceBreakdown.securityDeposit;
    //     pdf.text(`Total Amount: $${total.toFixed(2)}`, margin + 5, yPos + 15);
    //     pdf.text(`Security Deposit: $${booking.priceBreakdown.securityDeposit.toFixed(2)} (Refundable)`, margin + 5, yPos + 30);

    //     return pdf;
    // };

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
                    <main className="container mx-auto px-4 py-12">
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
                                <div className="text-center mb-16">
                                    <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-10 shadow-lg transform hover:scale-105 transition-transform duration-200">
                                        <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h1 className="text-4xl font-bold text-gray-800 mb-4">Booking Confirmed!</h1>
                                    <p className="text-lg text-gray-600 mb-2">Your booking has been successfully completed</p>
                                    <p className="text-sm text-gray-500">Booking Date: {formatDate(bookingDetails.bookingDate || new Date().toISOString())}</p>
                                </div>

                                <div className="mb-12">
                                    <h2 className="text-2xl font-semibold border-b border-gray-200 pb-4 mb-8">Booking Details</h2>
                                    {bookingDetails.rooms.map((room) => (
                                        <div key={room.id} className="bg-gray-50 rounded-xl p-6 md:p-8 mb-6 hover:shadow-md transition-shadow duration-200">
                                            <h3 className="text-xl font-semibold mb-6 text-gray-800">{room.name}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="bg-white rounded-lg p-5 shadow-sm">
                                                    <span className="text-gray-600 text-sm block mb-2">Time Slot:</span>
                                                    <p className="font-medium text-gray-800">{getTimeSlotText(room.timeSlot)}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-5 shadow-sm">
                                                    <span className="text-gray-600 text-sm block mb-2">Booking Type:</span>
                                                    <p className="font-medium text-gray-800 capitalize">{bookingDetails.bookingType}</p>
                                                </div>
                                            </div>
                                            <div className="mt-8">
                                                <span className="text-gray-600 text-sm block mb-4">Selected Dates:</span>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {room.dates.map((date) => (
                                                        <div key={date} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                            <span className="text-gray-800">{formatDate(date)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-gray-200 pt-10 mb-12">
                                    <h2 className="text-2xl font-semibold mb-8">Payment Summary</h2>
                                    <div className="bg-blue-50 p-8 rounded-xl shadow-inner">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-medium text-gray-700">Total Amount Paid:</span>
                                            <span className="text-3xl font-bold text-blue-600">${bookingDetails.totalAmount?.toFixed(2) || bookingDetails.priceBreakdown.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-center gap-6 pt-4">
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