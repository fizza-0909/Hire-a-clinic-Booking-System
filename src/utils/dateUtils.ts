import { TimeSlot } from '../types/booking';

// Convert Date object to YYYY-MM-DD string
export const formatDateToString = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Parse YYYY-MM-DD string to Date object
export const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date string format');
    }
    return date;
};

// Format date for display
export const formatDisplayDate = (dateStr: string): string => {
    try {
        const date = parseDateString(dateStr);
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

// Check if date is in the past
export const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

// Check if date is a weekend
export const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

// Get time slot details
export const getTimeSlotDetails = (timeSlot: TimeSlot) => {
    switch (timeSlot) {
        case 'morning':
            return { startTime: '08:00', endTime: '13:00' };
        case 'evening':
            return { startTime: '14:00', endTime: '19:00' };
        case 'full':
        default:
            return { startTime: '08:00', endTime: '19:00' };
    }
};

// Validate booking dates
export const validateBookingDates = (dates: string[]): boolean => {
    if (!Array.isArray(dates) || dates.length === 0) {
        return false;
    }

    return dates.every(dateStr => {
        try {
            const date = parseDateString(dateStr);
            return !isNaN(date.getTime()) && !isWeekend(date) && !isDateInPast(date);
        } catch {
            return false;
        }
    });
};

// Generate monthly booking dates
export const generateMonthlyBookingDates = (
    startDate: Date,
    maxDays: number = 22,
    maxDaysToCheck: number = 60
): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate);
    let daysChecked = 0;

    while (dates.length < maxDays && daysChecked < maxDaysToCheck) {
        if (!isWeekend(currentDate) && !isDateInPast(currentDate)) {
            dates.push(formatDateToString(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
        daysChecked++;
    }

    return dates;
}; 