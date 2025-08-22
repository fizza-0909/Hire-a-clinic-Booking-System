export type TimeSlot = 'full' | 'morning' | 'evening';
export type BookingType = 'daily' | 'monthly';

// Interface for room selection and calendar page
export interface RoomBooking {
    id: number;
    roomId: string;
    name: string;
    image: string;
    description: string;
    selected: boolean;
    timeSlot: TimeSlot;
    dates: string[];
}

// Interface for booking dates with time slots
export interface BookingDate {
    date: string;
    startTime: string;
    endTime: string;
}

// Interface for final booking data
export interface BookingRoom {
    roomId: string;
    name: string;
    timeSlot: TimeSlot;
    dates: BookingDate[];
    customPricing?:any
}

// Interface for booking data in session storage
export interface BookingData {
    rooms: BookingRoom[];
    bookingType: BookingType;
    totalAmount: number;
    isVerified?: boolean;
    priceBreakdown?: PriceBreakdown;
    includesSecurityDeposit?: boolean;
    customPricing?:any
}

// Interface for booking status from API
export interface BookingStatus {
    date: string;
    roomId: string;
    timeSlots: TimeSlot[];
}

// Interface for room data
export interface Room {
    id: string;
    name: string;
    type: 'exam' | 'consultation' | 'procedure' | 'office';
    description: string;
    image: string;
    price: {
        daily: {
            full: number;
            morning: number;
            evening: number;
        };
        monthly: {
            full: number;
            morning: number;
            evening: number;
        };
    };
}

// Interface for price breakdown
export interface PriceBreakdown {
    subtotal: number;
    tax: number;
    securityDeposit: number;
    total: number;
}

// Constants for pricing
export const PRICING = {
    daily: {
        full: 300,      // $300 per day for full day
        morning: 160,   // $160 per day for morning
        evening: 160    // $160 per day for evening
    },
    monthly: {
        full: 2000,     // $2000 per month for full day
        morning: 1200,  // $1200 per month for morning
        evening: 1200   // $1200 per month for evening
    },
    tax: 0.035,        // 3.5% tax rate
    securityDeposit: 250 // $250 security deposit
} as const; 