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


    rooms.forEach(room => {
        let basePrice;
        if (room?.customPricing && room?.customPricing[bookingType]) {
            basePrice = room?.customPricing[bookingType][room.timeSlot];
        } else {
            basePrice = PRICING[bookingType][room.timeSlot];
        }


        if (bookingType === 'monthly') {
            subtotal += basePrice;
        } else {
            subtotal += basePrice * room.dates.length;
        }
    });


    const tax = subtotal * 0.035;
    const securityDeposit = !isVerified ? PRICING.securityDeposit : 0;


    return {
        subtotal,
        tax,
        securityDeposit,
        total: subtotal + tax + securityDeposit
    };
};


const calculateTotalAmount = (bookingData: any) => {
    let subtotal = 0;


    bookingData.rooms.forEach((room: any) => {
        const timeSlot = room.timeSlot as TimeSlot;
        let basePrice;


        if (room.customPricing && room.customPricing[bookingData.bookingType]) {
            basePrice = room.customPricing[bookingData.bookingType][timeSlot];
        } else {
            basePrice = PRICING[bookingData.bookingType][timeSlot];
        }


        if (bookingData.bookingType === 'monthly') {
            const monthRanges = new Map<string, { start: number, end: number }>();


            room.dates.forEach((date: any) => {
                const d = new Date(date.date || date);
                const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
                const dayOfMonth = d.getDate();


                if (!monthRanges.has(monthKey)) {
                    monthRanges.set(monthKey, { start: dayOfMonth, end: dayOfMonth });
                } else {
                    const range = monthRanges.get(monthKey)!;
                    range.start = Math.min(range.start, dayOfMonth);
                    range.end = Math.max(range.end, dayOfMonth);
                }
            });


            monthRanges.forEach((range, month) => {
                const [year, monthNum] = month.split('-').map(Number);
                const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
                const daysBooked = range.end - range.start + 1;


                if (daysBooked > 15) {
                    subtotal += basePrice;
                } else {
                    let dailyRate;
                    if (room.customPricing && room.customPricing.daily) {
                        dailyRate = room.customPricing.daily[timeSlot];
                    } else {
                        dailyRate = PRICING.daily[timeSlot];
                    }
                    subtotal += dailyRate * daysBooked;
                }
            });
        } else {
            const numberOfDates = room.dates.length;
            let dailyRate;
            if (room.customPricing && room.customPricing.daily) {
                dailyRate = room.customPricing.daily[timeSlot];
            } else {
                dailyRate = PRICING.daily[timeSlot];
            }
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

// TermsModal for summary page
interface TermsModalProps {
    open: boolean;
    onClose: () => void;
}
function TermsModal({ open, onClose }: TermsModalProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <h2 className="text-xl font-bold mb-4 text-center">Medical Office Use Agreement & Terms of Use</h2>
                <div className="text-sm text-gray-700 space-y-4">
                    {/* <p>This Agreement is made and entered into by and between <strong>Hire a Clinic</strong>, a (name of legal entity type – e.g., LLC, PLLC) ("Licensor"), and the undersigned individual or entity ("Licensee" or "Booking Party").</p> */}
                    <p>By booking, reserving, or using a medical office suite or space through <strong>Hire a Clinic</strong>, the Licensee agrees to be bound by the terms below.</p>
                    <h3 className="font-semibold mt-4">1. LICENSE TO USE PREMISES</h3>
                    <p><strong>1.1. Non-Exclusive License.</strong> Licensor grants Licensee a limited, revocable, non-transferable license to use specified medical office space at designated times, for lawful professional purposes only.</p>
                    <p><strong>1.2. No Lease or Tenancy Created.</strong> This Agreement is not a lease. It does not create a landlord-tenant relationship. It is a license for temporary use of space.</p>
                    <h3 className="font-semibold mt-4">2. LICENSEE REPRESENTATIONS & REQUIREMENTS</h3>
                    <p><strong>2.1. Licensee affirms that they are:</strong></p>
                    <ul className="list-disc pl-5">
                        <li>A duly licensed and credentialed healthcare provider;</li>
                        <li>Authorized to provide care in the jurisdiction where the office is located;</li>
                        <li>Carrying all required professional liability (malpractice) insurance and general liability insurance, and will provide proof upon request.</li>
                    </ul>
                    <p><strong>2.2. Licensee is fully responsible for:</strong></p>
                    <ul className="list-disc pl-5">
                        <li>Their own patients, services rendered, and compliance with all local, state, and federal laws (including HIPAA);</li>
                        <li>Bringing, securing, and maintaining their own medical records, forms, and supplies;</li>
                        <li>Ensuring they do not prescribe, store, or dispense controlled substances on the premises without proper licensing and safeguards.</li>
                    </ul>
                    <h3 className="font-semibold mt-4">3. USE OF PREMISES</h3>
                    <p><strong>3.1.</strong> Licensee shall use the premises only for consultations, evaluations, and services within the scope of their professional license.</p>
                    <p><strong>3.2.</strong> Licensee shall not:</p>
                    <ul className="list-disc pl-5">
                        <li>Alter, damage, or misuse the premises;</li>
                        <li>Conduct any illegal or unethical activity;</li>
                        <li>Solicit patients or staff of Hire a Clinic for unrelated business;</li>
                        <li>Leave personal items unattended or overnight unless explicitly permitted.</li>
                    </ul>
                    <p><strong>3.3.</strong> Shared amenities (e.g., waiting room, Wi-Fi, front desk, cleaning) are provided “as-is” and subject to availability.</p>
                    <h3 className="font-semibold mt-4">4. NO ENDORSEMENT OR SUPERVISION</h3>
                    <p><strong>4.1.</strong> Licensor does not supervise, endorse, or participate in the medical care provided by Licensee.</p>
                    <p><strong>4.2.</strong> Licensee acts entirely independently, and no employment, agency, or partnership is created by this agreement.</p>
                    <h3 className="font-semibold mt-4">5. FEES & PAYMENTS</h3>
                    <p><strong>5.1.</strong> Fees for room use are due at the time of booking and are non-refundable.</p>
                    <h3 className="font-semibold mt-4">6. INDEMNIFICATION & LIABILITY WAIVER</h3>
                    <p><strong>6.1.</strong> Licensee shall indemnify, defend, and hold harmless Hire a Clinic, its owners, officers, employees, and affiliates from:</p>
                    <ul className="list-disc pl-5">
                        <li>Any claims, demands, damages, lawsuits, or liabilities arising out of or related to Licensee’s use of the premises;</li>
                        <li>Any malpractice claims, patient complaints, or injuries occurring during or after Licensee’s use of the space;</li>
                        <li>Any violations of law or professional regulations by Licensee.</li>
                    </ul>
                    <p><strong>6.2.</strong> Licensor shall not be liable for:</p>
                    <ul className="list-disc pl-5">
                        <li>Any damages to personal property;</li>
                        <li>Business interruptions;</li>
                        <li>Lost income, reputational harm, or indirect damages.</li>
                    </ul>
                    <h3 className="font-semibold mt-4">7. INSURANCE REQUIREMENTS</h3>
                    <p>Licensee agrees to carry and maintain:</p>
                    <ul className="list-disc pl-5">
                        <li>Professional liability insurance with a minimum coverage of $1,000,000 per incident;</li>
                        <li>General liability insurance covering premises use;</li>
                        <li>Any other insurance required by applicable law.</li>
                    </ul>
                    <p>Proof of insurance must be furnished upon request.</p>
                    <h3 className="font-semibold mt-4">8. TERMINATION</h3>
                    <p><strong>8.1.</strong> Licensor reserves the right to revoke access or cancel any booking at its sole discretion for:</p>
                    <ul className="list-disc pl-5">
                        <li>Breach of this Agreement;</li>
                        <li>Unethical conduct;</li>
                        <li>Risk to property, staff, or patients.</li>
                    </ul>
                    <p><strong>8.2.</strong> Any violations may result in permanent banning from using Hire a Clinic services.</p>
                    <h3 className="font-semibold mt-4">9. DISPUTES & GOVERNING LAW</h3>
                    <p><strong>9.1.</strong> This Agreement is governed by the laws of the State of <strong>Texas</strong>.</p>
                    {/* <p><strong>9.2.</strong> All disputes shall be resolved through binding arbitration in <strong>[Insert County/City]</strong>, and not through court litigation.</p> */}
                    <p><strong>9.2.</strong> Attorneys’ fees and costs incurred by Hire a Clinic to enforce this agreement may be recoverable.</p>
                    <h3 className="font-semibold mt-4">10. MISCELLANEOUS</h3>
                    <ul className="list-disc pl-5">
                        <li><strong>Entire Agreement:</strong> This document represents the full agreement between the parties.</li>
                        <li><strong>No Waiver:</strong> Failure to enforce any provision does not waive future enforcement.</li>
                        <li><strong>Severability:</strong> If any provision is found unenforceable, the rest remains in effect.</li>
                        <li><strong>Electronic Acceptance:</strong> Use of the space constitutes agreement to these terms. A digital or physical signature is enforceable.</li>
                    </ul>
                    <hr className="my-4" />
                    <p className="text-center font-semibold"><p>

                    </p> By clicking <strong>“I Agree”,</strong> registering or booking a room, you acknowledge and agree that your submission serves as your consent and signature to comply with all applicable rules, policies, and regulations.</p>
                </div>
                <div className="flex justify-center mt-6">
                    <button
                        className="px-6 py-2 rounded bg-blue-600 text-white font-semibold"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

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
    const [showTermsModal, setShowTermsModal] = useState(false);

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
            debugger
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
                                                <span>Membership Fee</span>
                                                <div className="ml-2 group relative">
                                                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                                                        Membership fee is only charged for your first booking. It will be refunded according to our policy.
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
                                            *Membership fee of $250 is included in the total as this is your first booking
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms and Conditions Section */}
                    <div className="border-t border-gray-200 pt-6 mb-8">
                        <h2 className="text-xl font-semibold mb-4">Terms and Conditions</h2>

                        {/* Terms Acceptance Checkbox */}
                        <div className="flex items-center mt-6">
                            <input
                                id="terms-checkbox"
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={e => setAcceptedTerms(e.target.checked)}
                                className="mr-2"
                                required
                            />
                            <label htmlFor="terms-checkbox" className="text-sm">
                                By clicking "I Agree", I confirm acceptance of the Medical Office Use {' '}
                                <span
                                    className="text-blue-600 underline cursor-pointer"
                                    onClick={() => setShowTermsModal(true)}
                                >
                                    Terms and Conditions
                                </span>

                            </label>
                        </div>
                        <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
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
            </main >
        </div >
    );
};

export default SummaryPage; 