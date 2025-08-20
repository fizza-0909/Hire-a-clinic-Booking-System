'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { PRICING } from '@/constants/pricing';
import Header from '@/components/Header';
import {
    RoomBooking,
    BookingData,
    BookingType,
    TimeSlot,
    Room,
    BookingStatus
} from '@/types/booking';
import {
    formatDateToString,
    parseDateString,
    formatDisplayDate,
    isDateInPast,
    isWeekend,
    getTimeSlotDetails,
    validateBookingDates,
    generateMonthlyBookingDates
} from '@/utils/dateUtils';

interface StoredRoomBooking extends Omit<RoomBooking, 'dates'> {
    dates: string[];
    customPricing?: typeof PRICING;
}

interface UserData {
    profileImage?: string;
    firstName: string;
    lastName: string;
    hasBookings: boolean;
}

interface BookingResponse {
    date: string;
    roomId: string;
    timeSlots: TimeSlot[];
}

const CalendarPage: React.FC = () => {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [bookingType, setBookingType] = useState<BookingType>('daily');
    const [showTimeSlots, setShowTimeSlots] = useState(false);
    const [bookingStatus, setBookingStatus] = useState<BookingStatus[]>([]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [selectedRooms, setSelectedRooms] = useState<StoredRoomBooking[]>([]);
    const [showHalfDayOptions, setShowHalfDayOptions] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);

    useEffect(() => {
        if (status === 'unauthenticated') {
            toast.error('Please login to continue');
            router.push('/login?callbackUrl=/booking/calendar');
            return;
        }

        // Get stored booking data from sessionStorage
        const storedRooms = sessionStorage.getItem('selectedRooms');
        const storedBookingType = sessionStorage.getItem('bookingType');

        if (!storedRooms || !storedBookingType) {
            toast.error('Please select rooms before proceeding to calendar');
            router.push('/booking');
            return;
        }

        try {
            const parsedRooms = JSON.parse(storedRooms);
            // Ensure custom pricing for Room 3 if missing (backward compatibility)
            const normalizedRooms = parsedRooms.map((r: any) => (
                r && Number(r.id) === 4 && !r.customPricing
                    ? {
                        ...r,
                        customPricing: {
                            daily: { full: 400, morning: 200, evening: 200 },
                            monthly: { full: 2500, morning: 1500, evening: 1500 },
                            securityDeposit: 250,
                            taxRate: 0.035
                        }
                    }
                    : r
            ));
            setSelectedRooms(normalizedRooms);
            setBookingType(storedBookingType as BookingType);
        } catch (error) {
            console.error('Error parsing stored data:', error);
            toast.error('Error loading booking data');
            router.push('/booking');
        }
    }, [status, router]);

    // Add new useEffect to fetch booking status when month or selected rooms change
    useEffect(() => {
        if (selectedRooms.length > 0) {
            fetchBookingStatus();
        }
    }, [currentMonth, selectedRooms, bookingType]);

    // Add useEffect to refetch when component mounts
    useEffect(() => {
        if (selectedRooms.length > 0) {
            console.log('Initial fetch of booking status');
            fetchBookingStatus();
        }
    }, []);

    // Add polling mechanism to refresh booking status
    useEffect(() => {
        const pollInterval = 10000; // Poll every 10 seconds
        const currentTime = Date.now();

        // Only poll if more than 10 seconds have passed since last fetch
        if (currentTime - lastFetchTime >= pollInterval) {
            fetchBookingStatus();
            setLastFetchTime(currentTime);
        }

        const intervalId = setInterval(() => {
            fetchBookingStatus();
            setLastFetchTime(Date.now());
        }, pollInterval);

        return () => clearInterval(intervalId);
    }, [currentMonth, selectedRooms, lastFetchTime]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/');
    };

    const fetchBookingStatus = async () => {
        try {
            // Add delay between requests to prevent rate limiting
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            console.log('Starting to fetch booking status for rooms:', selectedRooms.map(r => r.id));

            // Fetch booking status for each selected room
            const promises = selectedRooms.map(async (room, index) => {
                try {
                    // Add small delay between requests
                    await delay(index * 100);

                    const roomId = room.id.toString();
                    console.log(`Fetching booking status for room ${roomId}...`);

                    const response = await fetch('/api/bookings/status', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            month: currentMonth.getMonth() + 1,
                            year: currentMonth.getFullYear(),
                            roomId
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error(`Server error for room ${roomId}:`, {
                            status: response.status,
                            statusText: response.statusText,
                            error: errorData
                        });
                        throw new Error(`Failed to fetch booking status for room ${roomId}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log(`Successfully fetched bookings for room ${roomId}:`, data);

                    if (!data.bookings || !Array.isArray(data.bookings)) {
                        console.error(`Invalid booking data for room ${roomId}:`, data);
                        return [];
                    }

                    // Validate each booking has required fields
                    const validBookings = data.bookings.filter((booking: any): booking is BookingResponse =>
                        booking &&
                        typeof booking === 'object' &&
                        'date' in booking &&
                        'roomId' in booking &&
                        'timeSlots' in booking &&
                        Array.isArray(booking.timeSlots)
                    );

                    console.log(`Valid bookings for room ${roomId}:`, validBookings);
                    return validBookings;
                } catch (error) {
                    console.error(`Error fetching status for room ${room.id}:`, error);
                    toast.error(`Failed to load availability for room ${room.id}`);
                    return [];
                }
            });

            console.log('Waiting for all booking status promises to resolve...');
            const results = await Promise.all(promises);

            console.log('Processing booking results...');
            const allBookings = results.flat();

            console.log('Final processed bookings:', allBookings);
            setBookingStatus(allBookings);
        } catch (error) {
            console.error('Failed to fetch booking status:', error);
            toast.error('Failed to load booking availability. Please try refreshing the page.');
            setBookingStatus([]);
        }
    };

    

    const handleDateSelection = (date: Date, roomId: number) => {
        if (isDateInPast(date)) {
            toast.error('Cannot select past dates');
            return;
        }

        if (isWeekend(date)) {
            toast.error('Weekend dates are not available');
            return;
        }

        const dateStr = formatDateToString(date);
        const room = selectedRooms.find(r => r.id === roomId);
        if (!room) return;

        let updatedRooms = [...selectedRooms];

        // Handle monthly booking
        if (bookingType === 'monthly') {
            // Clear any existing dates for this room
            updatedRooms = selectedRooms.map(r => {
                if (r.id === roomId) {
                    return { ...r, dates: [] };
                }
                return r;
            });

            // Generate monthly booking dates
            const dates = generateMonthlyBookingDates(date);

            if (dates.length === 0) {
                toast.error('No available dates found starting from the selected date');
                return;
            }

            updatedRooms = updatedRooms.map(r => {
                if (r.id === roomId) {
                    return { ...r, dates };
                }
                return r;
            });

            toast.success(`Selected ${dates.length} days starting from ${formatDisplayDate(dates[0])}`);
        } else {
            // Handle daily booking
            if (!isTimeSlotAvailable(date, roomId, room.timeSlot)) {
                if (room.timeSlot === 'full') {
                    toast.error('This date is not available for full day booking');
                } else {
                    toast.error(`This ${room.timeSlot} slot is already booked`);
                }
                return;
            }

            const dateIndex = room.dates?.indexOf(dateStr) ?? -1;
            updatedRooms = selectedRooms.map(r => {
                if (r.id === roomId) {
                    let newDates;
                    if (dateIndex === -1) {
                        // Adding new date
                        newDates = [...(r.dates || []), dateStr].sort();
                    } else {
                        // Removing date
                        newDates = r.dates?.filter(d => d !== dateStr) || [];
                    }
                    return { ...r, dates: newDates };
                }
                return r;
            });

            if (dateIndex === -1) {
                toast.success(`Selected ${room.timeSlot} slot for ${formatDisplayDate(dateStr)}`);
            } else {
                toast.success(`Removed ${room.timeSlot} slot for ${formatDisplayDate(dateStr)}`);
            }
        }

        setSelectedRooms(updatedRooms);

        // Calculate total amount and save booking data
        const totalAmount = calculateTotalAmount(updatedRooms);
        const bookingData: BookingData = {
            rooms: updatedRooms.map(r => ({
                roomId: r.id.toString(),
                name: r.name,
                timeSlot: r.timeSlot,
                dates: r.dates.map(date => {
                    const { startTime, endTime } = getTimeSlotDetails(r.timeSlot);
                    return {
                        date,
                        startTime,
                        endTime
                    };
                })
            })),
            bookingType,
            totalAmount
        };

        // Save to session storage
        sessionStorage.setItem('selectedRooms', JSON.stringify(updatedRooms));
        sessionStorage.setItem('bookingType', bookingType);
        sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
    };

    const handleTimeSlotChange = (roomId: number, timeSlot: TimeSlot) => {
        const room = selectedRooms.find(r => r.id === roomId);
        if (!room) return;

        // Keep track of compatible dates
        const compatibleDates = room.dates?.filter(dateStr => {
            const date = new Date(dateStr);
            return !isDateBooked(date, roomId, timeSlot);
        }) || [];

        // Keep track of incompatible dates
        const incompatibleDates = room.dates?.filter(dateStr => {
            const date = new Date(dateStr);
            return isDateBooked(date, roomId, timeSlot);
        }) || [];

        // Update the room's time slot and dates
        setSelectedRooms(prev =>
            prev.map(r => {
                if (r.id === roomId) {
                    return {
                        ...r,
                        timeSlot,
                        dates: compatibleDates // Keep only compatible dates
                    };
                }
                return r;
            })
        );

        // Show half-day options if half day is selected
        if (timeSlot === 'morning' || timeSlot === 'evening') {
            setShowHalfDayOptions(true);
        } else {
            setShowHalfDayOptions(false);
        }

        // Save to sessionStorage
        const updatedRooms = selectedRooms.map(r => {
            if (r.id === roomId) {
                return {
                    ...r,
                    timeSlot,
                    dates: compatibleDates
                };
            }
            return r;
        });
        sessionStorage.setItem('selectedRooms', JSON.stringify(updatedRooms));

        // Show appropriate toast message
        const timeSlotText = getTimeSlotText(timeSlot);
        if (incompatibleDates.length > 0) {
            toast((t) => (
                <div>
                    <p>Some dates were removed due to conflicts with {timeSlotText} slot</p>
                    <p className="text-sm mt-1 text-yellow-500">
                        {incompatibleDates.length} date(s) were incompatible
                    </p>
                    {compatibleDates.length > 0 && (
                        <p className="text-sm mt-1 text-green-500">
                            {compatibleDates.length} compatible date(s) preserved
                        </p>
                    )}
                </div>
            ), { duration: 5000 });
        } else {
            toast.success(`Changed to ${timeSlotText}`);
        }
    };

    const calculateTotalAmount = (rooms: RoomBooking[]) => {
        let total = 0;
        rooms.forEach(room => {
            const pricing = (room as StoredRoomBooking).customPricing ?? PRICING;
            const basePrice = pricing[bookingType][room.timeSlot];
            // For monthly bookings, use flat rate. For daily, multiply by days
            if (bookingType === 'monthly') {
                total += basePrice; // Flat monthly rate
            } else {
                total += basePrice * room.dates.length; // Daily rate * number of days
            }
        });
        return total;
    };

    const getterRoom = () => {
        if (typeof window !== 'undefined') {
            const storedRoom = sessionStorage.getItem('selectedRooms');
            const parseRoom = storedRoom ? JSON.parse(storedRoom) : {};
            return parseRoom[0].id === 4;
        }
        return false;
    };

    const getTimeSlotText = (timeSlot: TimeSlot): string => {
        switch (timeSlot) {
            case 'full':
                return 'Full Day (8:00 AM - 5:00 PM)';
            case 'morning':
                return 'Morning (8:00 AM - 12:00 PM)';
            case 'evening':
                return 'Evening (1:00 PM - 5:00 PM)';
            default:
                return timeSlot;
        }
    };

    const isTimeSlotAvailable = (date: Date | null, roomId: number, timeSlot: TimeSlot): boolean => {
        if (!date) return false;

        try {
            const dateStr = date.toISOString().split('T')[0];
            const roomIdStr = roomId.toString();

            // Ensure bookingStatus is an array and contains valid entries
            if (!Array.isArray(bookingStatus)) {
                console.log('No booking status data available');
                return true;
            }

            const status = bookingStatus.find(b =>
                b &&
                typeof b === 'object' &&
                'date' in b &&
                'roomId' in b &&
                b.date === dateStr &&
                b.roomId === roomIdStr
            );

            if (!status || !Array.isArray(status.timeSlots)) {
                console.log('No booking status found for this date/room');
                return true;
            }

            // If full day is booked, no slots are available
            if (status.timeSlots.includes('full')) {
                return false;
            }

            switch (timeSlot) {
                case 'full':
                    // For full day booking, both morning and evening must be free
                    return !status.timeSlots.includes('morning') && !status.timeSlots.includes('evening');
                case 'morning':
                    // For morning booking, only morning slot must be free
                    return !status.timeSlots.includes('morning');
                case 'evening':
                    // For evening booking, only evening slot must be free
                    return !status.timeSlots.includes('evening');
                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking time slot availability:', error);
            return false;
        }
    };

    const calculatePrice = () => {
        let subtotal = 0;

        // Calculate price for each room
        selectedRooms.forEach(room => {
            const pricing = (room as StoredRoomBooking).customPricing ?? PRICING;
            const basePrice = pricing[bookingType][room.timeSlot];
            
            // For monthly bookings, use flat rate. For daily, multiply by days
            if (bookingType === 'monthly') {
                subtotal += basePrice; // Flat monthly rate
            } else {
                subtotal += basePrice * room.dates.length; // Daily rate * number of days
            }
        });

        // Calculate tax (3.5%)
        const tax = subtotal * 0.035;

        // Calculate security deposit - only for unverified users
        const securityDeposit = !session?.user?.isVerified ? PRICING.securityDeposit : 0;

        // Return all price components
        return {
            subtotal,
            tax,
            securityDeposit,
            total: subtotal + tax + securityDeposit
        };
    };

    const renderPriceBreakdown = () => {
        const { subtotal, tax, securityDeposit, total } = calculatePrice();
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Price Breakdown</h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-lg font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Tax (3.5%):</span>
                        <span>+ ${tax.toFixed(2)}</span>
                    </div>
                    {!session?.user?.isVerified && (
                        <div className="flex justify-between items-center text-sm text-gray-600">
                            <div className="flex-1">
                                <span>Membership Fee</span>
                            </div>
                            <span>+ ${securityDeposit.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="pt-2 mt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total:</span>
                            <span className="text-blue-600">${total.toFixed(2)}</span>
                        </div>
                        {!session?.user?.isVerified && (
                            <p className="text-xs text-gray-500 mt-1">
                                *A refundable membership fee of $250 will be charged as this is your first booking
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleRemoveRoom = (roomId: number) => {
        const updatedRooms = selectedRooms.filter(r => r.id !== roomId);
        setSelectedRooms(updatedRooms);
        localStorage.setItem('selectedRooms', JSON.stringify(updatedRooms));
    };

    const handleRemoveDate = (roomId: number, dateToRemove: string) => {
        if (bookingType !== 'daily') {
            toast.error('Dates cannot be modified for monthly bookings');
            return;
        }

        setSelectedRooms(prev =>
            prev.map(r => {
                if (r.id === roomId) {
                    const newDates = r.dates?.filter(d => d !== dateToRemove) || [];
                    return { ...r, dates: newDates };
                }
                return r;
            }).filter(r => r.dates && r.dates.length > 0)
        );
        toast.success('Date removed successfully');
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();

        const days = [];
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            // Set time to noon to avoid timezone issues
            const dayDate = new Date(year, month, i);
            dayDate.setHours(12, 0, 0, 0);
            days.push(dayDate);
        }

        return days;
    };

    const days = getDaysInMonth(currentMonth);
    const isDateSelected = (date: Date): boolean => {
        const dateStr = date.toISOString().split('T')[0];
        return selectedRooms.some(room => room.dates?.includes(dateStr) || false);
    };

    const isWeekend = (date: Date | null): boolean => {
        if (!date) return false;
        const day = date.getDay();
        return day === 0 || day === 6;
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const isDateBooked = (date: Date | null, roomId: number, timeSlot: TimeSlot): boolean => {
        if (!date) return false;

        try {
            const dateStr = date.toISOString().split('T')[0];
            const roomIdStr = roomId.toString();

            console.log('Checking booking status for:', {
                date: dateStr,
                roomId: roomIdStr,
                timeSlot,
                bookingStatus
            });

            // Find the booking status for this date and room
            const status = bookingStatus.find(b =>
                b.date === dateStr &&
                b.roomId === roomIdStr
            );

            if (!status || !Array.isArray(status.timeSlots)) {
                console.log('No booking status found for this date/room');
                return false;
            }

            console.log('Found booking status:', status);

            // For full day booking, check if full day is booked
            if (timeSlot === 'full') {
                const isBooked = status.timeSlots.includes('full') || 
                               (status.timeSlots.includes('morning') && status.timeSlots.includes('evening'));
                console.log('Full day booking check:', isBooked);
                return isBooked;
            }

            // For half-day bookings, check if either full day is booked or the specific slot
            const isBooked = status.timeSlots.includes('full') || status.timeSlots.includes(timeSlot);
            console.log(`${timeSlot} booking check:`, isBooked);
            return isBooked;
        } catch (error) {
            console.error('Error checking if date is booked:', error);
            return false;
        }
    };

    const getDateClassName = (date: Date | null, room: RoomBooking) => {
        if (!date) return 'bg-gray-100';
        
        const baseClasses = 'w-full h-full flex items-center justify-center rounded-lg transition-colors';
        const isSelected = room.dates.includes(date.toISOString().split('T')[0]);
        const isBooked = isDateBooked(date, room.id, room.timeSlot);
        const isPast = isDateInPast(date);
        const isWeekendDay = isWeekend(date);

        let className = '';

        // First check if date is in past or weekend
        if (isPast || isWeekendDay) {
            className = 'bg-gray-100 text-gray-400 cursor-not-allowed';
        }
        // Then check if date is booked
        else if (isBooked) {
            if (room.timeSlot === 'morning') {
                className = 'bg-gradient-to-b from-red-100 via-red-100 to-white cursor-not-allowed';
            } else if (room.timeSlot === 'evening') {
                className = 'bg-gradient-to-t from-red-100 via-red-100 to-white cursor-not-allowed';
            } else {
                className = 'bg-red-100 text-red-800 cursor-not-allowed hover:bg-red-100';
            }
        }
        // Then check if date is selected
        else if (isSelected) {
            if (room.timeSlot === 'morning') {
                className = 'bg-gradient-to-b from-blue-500 via-blue-500 to-white text-white';
            } else if (room.timeSlot === 'evening') {
                className = 'bg-gradient-to-t from-blue-500 via-blue-500 to-white text-white';
            } else {
                className = 'bg-blue-500 text-white hover:bg-blue-600';
            }
        }
        // Finally, style available dates
        else {
            if (room.timeSlot === 'morning') {
                className = 'cursor-pointer hover:bg-gradient-to-b hover:from-blue-100 hover:via-blue-100 hover:to-white';
            } else if (room.timeSlot === 'evening') {
                className = 'cursor-pointer hover:bg-gradient-to-t hover:from-blue-100 hover:via-blue-100 hover:to-white';
            } else {
                className = 'cursor-pointer hover:bg-blue-100';
            }
        }

        return className;
    };

    const handleProceed = async () => {
        if (!session) {
            toast.error('Please login to continue');
            router.push('/');
            return;
        }

        // Filter rooms that have dates selected
        const roomsWithDates = selectedRooms.filter(room => room.dates && room.dates.length > 0);

        // Check if at least one room has dates
        if (roomsWithDates.length === 0) {
            toast.error('Please select dates for at least one room');
            return;
        }

        try {
            // Validate dates for each room
            const hasInvalidDates = roomsWithDates.some(room => !validateBookingDates(room.dates));
            if (hasInvalidDates) {
                toast.error('Some selected dates are invalid. Please check your selection.');
                return;
            }
            //qasim
            // Format booking data
            const bookingData: BookingData = {
                rooms: roomsWithDates.map(room => ({
                    roomId: room.id.toString(),
                    name: room.name,
                    timeSlot: room.timeSlot,
                    dates: room.dates.map(date => {
                        const { startTime, endTime } = getTimeSlotDetails(room.timeSlot);
                        return {
                            date,
                            startTime,
                            endTime
                        };
                    })
                })),
                bookingType,
                totalAmount: calculateTotalAmount(roomsWithDates),
                isVerified: session.user.isVerified
            };

            // Store booking data in session storage
            sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
            sessionStorage.setItem('bookingType', bookingType);

            // Navigate to summary page
            router.push('/booking/summary');
        } catch (error) {
            console.error('Error processing booking:', error);
            toast.error('Failed to process booking. Please try again.');
        }
    };

    const renderTimeSlotButtons = (room: StoredRoomBooking) => {
        // Check for dates that would conflict with full day booking
        const conflictingDates = room.dates?.filter(dateStr => {
            const date = new Date(dateStr);
            return !isTimeSlotAvailable(date, room.id, 'full');
        }) || [];

        const hasConflictingDates = conflictingDates.length > 0;
        const formattedConflictingDates = conflictingDates.map(date =>
            new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            })
        ).join('\n');

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="relative group">
                    <button
                        onClick={() => handleTimeSlotChange(room.id, 'full')}
                        disabled={hasConflictingDates}
                        className={`w-full p-6 rounded-xl border-2 transition-all duration-300 
                            ${room.timeSlot === 'full'
                                ? 'border-blue-500 bg-blue-50 shadow-lg'
                                : hasConflictingDates
                                    ? 'border-red-200 bg-red-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                            }`}
                    >
                        <div className="flex flex-col items-center">
                            <h3 className="font-semibold text-xl mb-2">Full Day</h3>
                            <p className="text-gray-600">8:00 AM - 5:00 PM</p>
                            <div className="text-blue-600 font-bold mt-2">
                                ${(room.customPricing ?? PRICING)[bookingType]?.full}/{bookingType === 'daily' ? 'day' : 'month'}
                            </div>
                            {hasConflictingDates && (
                                <div className="mt-3 p-2 bg-red-100 rounded-lg border border-red-200 text-red-600 text-sm font-medium">
                                    Please unselect conflicting dates
                                </div>
                            )}
                        </div>
                    </button>
                    {/* Tooltip for conflicting dates */}
                    {hasConflictingDates && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute z-50 w-80 p-4 mt-2 bg-white rounded-lg shadow-xl border border-red-200 text-sm">
                            <div className="font-semibold text-red-600 mb-2">Cannot switch to Full Day:</div>
                            <div className="text-gray-700">
                                <p className="mb-2">The following dates have conflicting bookings:</p>
                                {conflictingDates.map((date, index) => (
                                    <div key={date} className="ml-2 mb-1 p-1 bg-red-50 rounded">
                                        {new Date(date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                ))}
                                <p className="mt-2 text-sm text-red-600 font-medium">
                                    Please unselect these dates before switching to Full Day.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {room.id == 4 ? <button
                    onClick={() => {
                        setShowHalfDayOptions(true);
                        handleTimeSlotChange(room.id, 'morning');
                    }}
                    className={`p-6 rounded-xl border-2 transition-all duration-300 
                        ${room.timeSlot !== 'full'
                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                        }`}
                >
                    <div className="flex flex-col items-center">
                        <h3 className="font-semibold text-xl mb-2">Half Day</h3>
                        <p className="text-gray-600">Morning or Evening</p>
                        <div className="text-blue-600 font-bold mt-2">
                            ${(room.customPricing ?? PRICING)[bookingType].morning}/{bookingType === 'daily' ? 'day' : 'month'}
                        </div>
                    </div>
                </button>:""}
            </div>
        );
    };

    // Show loading state while checking authentication
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // If not authenticated, the useEffect will handle redirection
    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            {/* Header */}
            <header className="sticky top-0 left-0 right-0 z-50 bg-white shadow-md">
                <Header />
                {/* Navigation Buttons */}
                <div className="container mx-auto px-4 py-4 mt-6 flex justify-between items-center">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Back to Home
                    </button>
                    <button
                        onClick={() => router.push('/booking')}
                        className="flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Make New Booking
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-7xl mx-auto">
                    {selectedRooms.length === 0 && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                            <div className="flex items-center justify-center text-red-600 mb-2">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="font-medium">Please Select a Room</span>
                            </div>
                            <p className="text-red-500">You must select at least one room before proceeding with the booking.</p>
                        </div>
                    )}

                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Room Selection
                    </button>

                    <div className="text-center mb-12">
                        <h1 className="text-5xl font-bold text-gray-800 mb-4">Select Dates for Your Rooms</h1>
                        <p className="text-xl text-gray-600">Choose dates and time slots for each selected room</p>
                    </div>

                    {/* Calendar Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            {selectedRooms.map(room => (
                                <div key={room.id} className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                                    <h2 className="text-3xl font-semibold mb-6">Select Time Slot for {room.name}</h2>
                                    {renderTimeSlotButtons(room)}

                                    {showHalfDayOptions && (
                                        <div className="mt-6 space-y-4">
                                            <h3 className="text-xl font-semibold mb-4">Select Half-Day Time Slot</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => handleTimeSlotChange(room.id, 'morning')}
                                                    disabled={room.dates?.some(dateStr => {
                                                        const status = bookingStatus.find(b =>
                                                            b.date === dateStr &&
                                                            b.roomId === room.id.toString()
                                                        );
                                                        return status && status.timeSlots.includes('morning');
                                                    })}
                                                    className={`p-6 rounded-xl border-2 transition-all duration-300 
                                                        ${room.timeSlot === 'morning'
                                                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                                                            : room.dates?.some(dateStr => {
                                                                const status = bookingStatus.find(b =>
                                                                    b.date === dateStr &&
                                                                    b.roomId === room.id.toString()
                                                                );
                                                                return status && status.timeSlots.includes('morning');
                                                            })
                                                                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                                                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <h3 className="font-semibold text-xl mb-2">Morning</h3>
                                                        <p className="text-gray-600">8:00 AM - 12:00 PM</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => handleTimeSlotChange(room.id, 'evening')}
                                                    disabled={room.dates?.some(dateStr => {
                                                        const status = bookingStatus.find(b =>
                                                            b.date === dateStr &&
                                                            b.roomId === room.id.toString()
                                                        );
                                                        return status && status.timeSlots.includes('evening');
                                                    })}
                                                    className={`p-6 rounded-xl border-2 transition-all duration-300 
                                                        ${room.timeSlot === 'evening'
                                                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                                                            : room.dates?.some(dateStr => {
                                                                const status = bookingStatus.find(b =>
                                                                    b.date === dateStr &&
                                                                    b.roomId === room.id.toString()
                                                                );
                                                                return status && status.timeSlots.includes('evening');
                                                            })
                                                                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                                                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <h3 className="font-semibold text-xl mb-2">Evening</h3>
                                                        <p className="text-gray-600">1:00 PM - 5:00 PM</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Calendar */}
                                    <div className="mt-8">
                                        <div className="flex items-center justify-between mb-8">
                                            <h2 className="text-3xl font-semibold">
                                                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                            </h2>
                                            <div className="flex space-x-4">
                                                <button
                                                    onClick={handlePrevMonth}
                                                    className="p-2 rounded-full hover:bg-gray-100"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={handleNextMonth}
                                                    className="p-2 rounded-full hover:bg-gray-100"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-7 gap-2 mb-4">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                <div key={day} className="text-center font-semibold text-gray-600">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-7 gap-2">
                                            {getDaysInMonth(currentMonth).map((date, index) => {
                                                const isBooked = date && isDateBooked(date, room.id, room.timeSlot);
                                                const isWeekendDay = date && isWeekend(date);
                                                const isPastDay = date && isDateInPast(date);
                                                const canSelect = date && !isWeekendDay && !isBooked && !isPastDay;

                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => canSelect && handleDateSelection(date, room.id)}
                                                        disabled={!canSelect}
                                                        className={`aspect-square p-2 rounded-lg text-center transition-all duration-200 ${getDateClassName(date, room)}`}
                                                        title={
                                                            !date ? "" :
                                                            isWeekendDay ? "Weekend is not available" :
                                                            isPastDay ? "Past dates cannot be selected" :
                                                            isBooked ? `This time slot (${room.timeSlot}) is already booked` :
                                                            ""
                                                        }
                                                    >
                                                        {date?.getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-6 space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                                <span>Selected Date</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-red-100 rounded"></div>
                                                <span>Fully Booked</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-gradient-to-b from-red-100 from-50% to-white to-50% rounded"></div>
                                                <span>Morning Booked</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-gradient-to-b from-white from-50% to-red-100 to-50% rounded"></div>
                                                <span>Evening Booked</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-4 h-4 bg-gray-100 rounded"></div>
                                                <span>Weekend/Unavailable</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Right Column - Summary */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-xl p-8 sticky top-8">
                                <h2 className="text-2xl font-semibold mb-6">Booking Summary</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Booking Type:</span>
                                        <span className="font-medium capitalize">{bookingType}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Selected Dates:</span>
                                        <span className="font-medium">{selectedRooms.reduce((total, room) => total + (room.dates?.length || 0), 0)} days</span>
                                    </div>

                                    {/* Selected Rooms Section */}
                                    <div className="border-t border-gray-200 pt-4">
                                        <h3 className="text-lg font-semibold mb-3">Selected Rooms</h3>
                                        <div className="space-y-4">
                                            {selectedRooms.map(room => (
                                                <div key={room.id} className="bg-gray-50 p-4 rounded-lg">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="font-medium">{room.name}</span>
                                                            <div className="text-sm text-gray-600">
                                                                {room.timeSlot === 'full' ? 'Full Day' : room.timeSlot === 'morning' ? 'Morning' : 'Evening'}
                                                            </div>
                                                            <div className="text-sm text-blue-600">
                                                                ${(room.customPricing ?? PRICING)[bookingType][room.timeSlot]}/{bookingType === 'daily' ? 'day' : 'month'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Show dates separately */}
                                                    <div className="mt-2 space-y-2">
                                                        {room.dates?.map((date) => (
                                                            <div key={date} className="flex justify-between items-center bg-white p-2 rounded-md text-sm">
                                                                <span>{formatDisplayDate(date)}</span>
                                                                {bookingType === 'daily' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedRooms(prev =>
                                                                                prev.map(r =>
                                                                                    r.id === room.id
                                                                                        ? { ...r, dates: (r.dates || []).filter(d => d !== date) }
                                                                                        : r
                                                                                ).filter(r => r.dates && r.dates.length > 0)
                                                                            );
                                                                            toast.success('Date removed');
                                                                        }}
                                                                        className="text-red-500 hover:text-red-700 p-1"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 my-4"></div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>Price per room:</span>
                                            {/* <span>${PRICING[bookingType][selectedRooms[0]?.timeSlot || 'full']}/{bookingType === 'daily' ? 'day' : 'month'}</span> */}
                                            {selectedRooms.map((room) => (
                                                <span key={room.id} className="flex justify-between items-center text-sm text-gray-600">
                                                    ${(room.customPricing ?? PRICING)[bookingType][room.timeSlot]}/{bookingType === 'daily' ? 'day' : 'month'}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>Number of rooms with dates:</span>
                                            <span>× {selectedRooms.filter(room => (room.dates?.length || 0) > 0).length}</span>
                                        </div>
                                        {bookingType === 'daily' && (
                                            <div className="flex justify-between items-center text-sm text-gray-600">
                                                <span>Number of days:</span>
                                                <span>× {selectedRooms.reduce((total, room) => total + (room.dates?.length || 0), 0)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-sm">
                                            <span>Subtotal:</span>
                                            <span>${calculateTotalAmount(selectedRooms).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>Tax (3.5%):</span>
                                            <span>+ ${calculatePrice().tax.toFixed(2)}</span>
                                        </div>
                                        {!session?.user?.isVerified && (
                                            <div className="flex justify-between items-center text-sm text-gray-600">
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
                                                <span>+ ${calculatePrice().securityDeposit.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-gray-200 pt-3">
                                            <div className="flex justify-between items-center text-lg font-semibold">
                                                <span>Total Price:</span>
                                                <span className="text-blue-600">${calculatePrice().total.toFixed(2)}</span>
                                            </div>
                                            {!session?.user?.isVerified && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    *A refundable membership fee of $250 will be charged as this is your first booking
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Proceed Button */}
                                    <div className="mt-6">
                                        <button
                                            onClick={handleProceed}
                                            disabled={!selectedRooms.some(room => room.dates?.length > 0)}
                                            className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
                                                !selectedRooms.some(room => room.dates?.length > 0)
                                                    ? 'bg-gray-300 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 transition-colors duration-200'
                                            }`}
                                        >
                                            {selectedRooms.length === 0
                                                ? 'Select a Room to Proceed'
                                                : !selectedRooms.some(room => room.dates?.length > 0)
                                                    ? 'Select at Least One Date to Proceed'
                                                    : 'Proceed to Booking Summary'}
                                        </button>
                                        {selectedRooms.length > 0 && !selectedRooms.some(room => room.dates?.length > 0) && (
                                            <p className="text-sm text-gray-600 mt-2 text-center">
                                                Please select dates for at least one room to proceed
                                            </p>
                                        )}
                                        {selectedRooms.some(room => !room.dates || room.dates.length === 0) &&
                                            selectedRooms.some(room => room.dates?.length > 0) && (
                                                <p className="text-sm text-blue-600 mt-2 text-center">
                                                    Note: Rooms without selected dates will not be included in the booking
                                                </p>
                                            )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CalendarPage;