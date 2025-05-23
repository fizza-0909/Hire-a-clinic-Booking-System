'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { loadStripe } from '@stripe/stripe-js';
import Header from '@/components/Header';
import {
    BookingRoom,
    BookingData,
    BookingType,
    TimeSlot,
    PRICING,
    PriceBreakdown
} from '@/types/booking';
import {
    formatDisplayDate,
    validateBookingDates,
    getTimeSlotDetails
} from '@/utils/dateUtils';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const calculatePriceBreakdown = (rooms: BookingRoom[], bookingType: BookingType, isVerified: boolean): PriceBreakdown => {
    let subtotal = 0;

    // Calculate subtotal based on room selections
    rooms.forEach(room => {
        const basePrice = PRICING[bookingType][room.timeSlot];
        const daysCount = room.dates.length;
        subtotal += basePrice * daysCount;
    });

    // Calculate tax (3.5%)
    const tax = subtotal * PRICING.tax;

    // Only add security deposit if user is not verified
    const securityDeposit = isVerified ? 0 : PRICING.securityDeposit;

    // Calculate total
    const total = Math.round((subtotal + tax + securityDeposit) * 100) / 100;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        securityDeposit,
        total
    };
};

const calculateTotalAmount = (bookingData: any) => {
    let subtotal = 0;

    // Count number of months selected
    const uniqueMonths = new Set(
        bookingData.rooms[0].dates.map((date: any) => {
            const d = new Date(date.date || date);
            return `${d.getFullYear()}-${d.getMonth()}`;
        })
    );
    const numberOfMonths = uniqueMonths.size;

    bookingData.rooms.forEach((room: any) => {
        const timeSlot = room.timeSlot as TimeSlot;
        
        if (bookingData.bookingType === 'monthly') {
            // For monthly bookings, use fixed rate × number of months
            const monthlyRate = PRICING.monthly[timeSlot];
            subtotal += monthlyRate * numberOfMonths;
        } else {
            // For daily bookings
            const numberOfDates = room.dates.length;
            const dailyRate = PRICING.daily[timeSlot];
            subtotal += dailyRate * numberOfDates;
        }
    });

    const tax = subtotal * PRICING.tax;
    const total = subtotal + tax;

    return {
        subtotal,
        tax,
        total
    };
};

// Helper function to get next 23 working days
const getNext23WorkingDays = async (startDate: Date, roomId: string) => {
    const workingDays: Date[] = [];
    const currentDate = new Date(startDate);
    
    // Get booked dates for the room
    const response = await fetch(`/api/bookings/availability/${roomId}`);
    const bookedDates = await response.json();
    
    while (workingDays.length < 23) {
        // Skip weekends
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            // Check if date is not already booked
            const dateStr = currentDate.toISOString().split('T')[0];
            if (!bookedDates.some((booking: any) => booking.date === dateStr)) {
                workingDays.push(new Date(currentDate));
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
};

const handleBookingTypeChange = async (type: BookingType, selectedRooms: BookingRoom[]) => {
    if (type === 'monthly') {
        // For monthly booking, automatically select next 23 working days
        const updatedRooms = await Promise.all(selectedRooms.map(async (room) => {
            const startDate = new Date(); // Start from today
            const workingDays = await getNext23WorkingDays(startDate, room.roomId);
            
            return {
                ...room,
                dates: workingDays.map(date => ({
                    date: date.toISOString().split('T')[0],
                    startTime: room.timeSlot === 'morning' ? '08:00' : '13:00',
                    endTime: room.timeSlot === 'morning' ? '12:00' : '17:00'
                }))
            };
        }));

        setSelectedRooms(updatedRooms);
    }
    setBookingType(type);
};

const SummaryPage = () => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [selectedRooms, setSelectedRooms] = useState<BookingRoom[]>([]);
    const [bookingType, setBookingType] = useState<BookingType>('daily');
    const [isProcessing, setIsProcessing] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown>({
        subtotal: 0,
        tax: 0,
        securityDeposit: 0,
        total: 0
    });
    const [bookingData, setBookingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            const currentPath = '/booking/summary';
            router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
            return;
        }

        const bookingDataStr = sessionStorage.getItem('bookingData');
        if (!bookingDataStr) {
            toast.error('No booking data found');
            router.push('/booking');
            return;
        }

        try {
            const bookingData = JSON.parse(bookingDataStr) as BookingData;
            
            // Validate the booking data
            if (!bookingData.rooms || !Array.isArray(bookingData.rooms) || bookingData.rooms.length === 0) {
                throw new Error('Invalid booking data: no rooms selected');
            }

            // Validate dates for each room
            const hasInvalidDates = bookingData.rooms.some(room => 
                !validateBookingDates(room.dates.map(d => d.date))
            );
            if (hasInvalidDates) {
                throw new Error('Invalid dates found in booking data');
            }

            setSelectedRooms(bookingData.rooms);
            setBookingType(bookingData.bookingType);

            const isVerified = session?.user?.isVerified ?? false;
            const priceBreakdownData = calculatePriceBreakdown(
                bookingData.rooms,
                bookingData.bookingType,
                isVerified
            );
            setPriceBreakdown(priceBreakdownData);

            const updatedBookingData = {
                ...bookingData,
                totalAmount: priceBreakdownData.total,
                priceBreakdown: priceBreakdownData
            };
            sessionStorage.setItem('bookingData', JSON.stringify(updatedBookingData));

            const amounts = calculateTotalAmount(updatedBookingData);
            setBookingData({
                ...updatedBookingData,
                subtotal: amounts.subtotal,
                tax: amounts.tax,
                totalAmount: amounts.total
            });
        } catch (error) {
            console.error('Error processing booking data:', error);
            toast.error('Invalid booking data');
            router.push('/booking');
        }
        setLoading(false);
    }, [router, status, session?.user?.isVerified]);

    const handleRemoveDate = (roomId: string, dateToRemove: string) => {
        if (bookingType !== 'daily') {
            toast.error('Dates cannot be modified for monthly bookings');
            return;
        }

        const updatedRooms = selectedRooms.map(room => {
            if (room.roomId === roomId) {
                const updatedDates = room.dates.filter(d => d.date !== dateToRemove);
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
        const newPriceBreakdown = calculatePriceBreakdown(
            updatedRooms, 
            bookingType, 
            session?.user?.isVerified || false
        );
        setPriceBreakdown(newPriceBreakdown);

        const bookingData = {
            rooms: updatedRooms,
            bookingType,
            totalAmount: newPriceBreakdown.total,
            isVerified: session?.user?.isVerified
        };
        sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
        toast.success('Date removed successfully');
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Invalid date';

        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            return new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date);
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    };

    const validateDates = (dates: string[]): boolean => {
        if (!Array.isArray(dates)) return false;
        return dates.every(dateStr => {
            if (!dateStr) return false;
            try {
                const [year, month, day] = dateStr.split('-').map(Number);
                if (!year || !month || !day) return false;
                const date = new Date(year, month - 1, day);
                return !isNaN(date.getTime());
            } catch {
                return false;
            }
        });
    };

    const handleProceedToPayment = async () => {
        try {
            if (!acceptedTerms) {
                toast.error('Please accept the terms and conditions');
                return;
            }

            setIsProcessing(true);

            // Get booking data from session storage
            const bookingDataStr = sessionStorage.getItem('bookingData');
            if (!bookingDataStr) {
                throw new Error('No booking data found');
            }

            const parsedData = JSON.parse(bookingDataStr);

            // Transform booking data to match API expectations
            const transformedBookingData = {
                rooms: parsedData.rooms.map((room: any) => ({
                    roomId: room.roomId,
                    name: room.name,
                    timeSlot: room.timeSlot,
                    dates: room.dates.map((date: any) => ({
                        date: date.date || date,
                        startTime: room.timeSlot === 'morning' ? '08:00' : '13:00',
                        endTime: room.timeSlot === 'morning' ? '12:00' : '17:00'
                    }))
                })),
                bookingType: parsedData.bookingType,
                totalAmount: parsedData.totalAmount,
                includesSecurityDeposit: !session?.user?.isVerified,
                priceBreakdown: parsedData.priceBreakdown // Include the price breakdown
            };

            const paymentData = {
                amount: Math.round(parsedData.totalAmount * 100), // Convert to cents for Stripe
                bookingData: transformedBookingData
            };

            const response = await fetch('/api/payment/intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    toast.error('Please log in to continue');
                    router.push('/login?callbackUrl=' + encodeURIComponent('/booking/summary'));
                    return;
                }
                throw new Error(errorData.error || 'Failed to create payment intent');
            }

            const responseData = await response.json();
            if (!responseData.clientSecret) {
                throw new Error('No client secret received from payment intent creation');
            }

            sessionStorage.setItem('paymentIntent', JSON.stringify({
                clientSecret: responseData.clientSecret,
                requiresSecurityDeposit: responseData.requiresSecurityDeposit
            }));

            router.push('/booking/payment');
        } catch (error) {
            console.error('Error creating payment intent:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to process payment');
        } finally {
            setIsProcessing(false);
        }
    };

    // Show loading state while checking authentication
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    // Show unauthorized message if not authenticated
    if (status === 'unauthenticated') {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <header className="sticky top-0 left-0 right-0 z-50 bg-white shadow-md">
                <Header />
                <div className="container mx-auto px-4 py-4 mt-6">
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Calendar
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-8">Booking Summary</h1>

                        <div className="space-y-6 mb-8">
                            {selectedRooms.map((room) => (
                                <div key={room.roomId} className="bg-gray-50 rounded-xl p-6">
                                    <h3 className="font-semibold text-lg mb-4">Room {room.roomId}</h3>
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
                                                <div key={date.date}
                                                    className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                                                    <span className="text-sm">{formatDate(date.date)}</span>
                                                    {bookingType === 'daily' && (
                                                        <button
                                                            onClick={() => handleRemoveDate(room.roomId, date.date)}
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
                                {!session?.user?.isVerified && (
                                    <div className="flex justify-between text-gray-600">
                                        <div className="flex-1">
                                            <div className="flex items-center">
                                                <span>Security Deposit</span>
                                                <div className="ml-2 group relative">
                                                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                                                        Security deposit is only charged for your first booking. It will be refunded according to our policy.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-blue-600 font-medium">First Booking Only - Refundable</div>
                                        </div>
                                        <span>${priceBreakdown.securityDeposit.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between font-semibold">
                                        <span>Total</span>
                                        <span className="text-blue-600">${priceBreakdown.total.toFixed(2)}</span>
                                    </div>
                                    {!session?.user?.isVerified && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            *Security deposit of $250 is included in the total as this is your first booking
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Terms and Conditions Section */}
                        <div className="border-t border-gray-200 pt-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4">Terms and Conditions</h2>
                            <div className="space-y-3 text-sm text-gray-700 mb-6">
                                <p className="mb-2">• Payments are non-refundable. Only the security deposit is refundable as per policy.</p>
                                <p className="mb-2">• Renters are responsible for the equipment and space during their booked time slot.</p>
                                <p className="mb-2">• Clinic owners must maintain a safe and professional environment.</p>
                                <p className="mb-2">• Renters must respect booking times. If a renter arrives late, extra time will not be provided or compensated.</p>
                                <p className="mb-2">• Any damages or misuse of the clinic will be deducted from the security deposit.</p>
                                <p className="mb-2">• All users must follow platform policies regarding cancellations and conduct.</p>
                            </div>

                            {/* Terms Acceptance Checkbox */}
                            <div className="flex items-start space-x-3 mb-6">
                                <input
                                    type="checkbox"
                                    id="acceptTerms"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="acceptTerms" className="text-sm text-gray-700">
                                    By confirming this booking, I acknowledge that I have read and agree to all the above Terms and Conditions.
                                </label>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={handleProceedToPayment}
                                disabled={isProcessing || !acceptedTerms}
                                className={`w-full flex items-center justify-center py-4 px-6 rounded-lg text-white font-medium 
                                    ${(isProcessing || !acceptedTerms) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
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