import mongoose, { Document, Model } from 'mongoose';
import { TimeSlot, BookingType } from '@/types/booking';

interface IBooking extends Document {
    userId: string;
    rooms: Array<{
        roomId: string;
        name: string;
        timeSlot: TimeSlot;
        dates: Array<{
            date: string;
            startTime: string;
            endTime: string;
        }>;
    }>;
    bookingType: BookingType;
    totalAmount: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    paymentStatus: 'pending' | 'completed' | 'failed';
    paymentIntentId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const bookingSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    rooms: [{
        roomId: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        timeSlot: {
            type: String,
            enum: ['full', 'morning', 'evening'],
            required: true
        },
        dates: [{
            date: {
                type: String,
                required: true,
                validate: {
                    validator: function(v: string) {
                        // Validate YYYY-MM-DD format
                        return /^\d{4}-\d{2}-\d{2}$/.test(v);
                    },
                    message: (props: { value: string }) => `${props.value} is not a valid date format! Use YYYY-MM-DD`
                }
            },
            startTime: {
                type: String,
                required: true,
                validate: {
                    validator: function(v: string) {
                        // Validate HH:mm format
                        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: (props: { value: string }) => `${props.value} is not a valid time format! Use HH:mm`
                }
            },
            endTime: {
                type: String,
                required: true,
                validate: {
                    validator: function(v: string) {
                        // Validate HH:mm format
                        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: (props: { value: string }) => `${props.value} is not a valid time format! Use HH:mm`
                }
            }
        }]
    }],
    bookingType: {
        type: String,
        enum: ['daily', 'monthly'],
        required: true
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['succeeded', 'rejected'],
        required: true
    },
    paymentDetails: {
        status: {
            type: String,
            enum: ['succeeded', 'rejected'],
            required: true
        },
        confirmedAt: Date,
        paymentIntentId: String,
        amount: Number,
        currency: String,
        paymentMethodType: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Validate dates don't overlap for same room and time slot
bookingSchema.pre('save', async function(next) {
    try {
        const BookingModel = this.constructor as Model<IBooking>;
        // Check each room in the booking
        for (const room of this.rooms) {
            // For each date in the room
            for (const bookingDate of room.dates) {
                // Check if the room is already booked for this date and time slot
                // Only block if there's a confirmed booking with successful payment
                const existingBooking = await BookingModel.findOne({
                    'rooms.roomId': room.roomId,
                    'rooms.dates': {
                        $elemMatch: {
                            date: bookingDate.date,
                            $or: [
                                { timeSlot: 'full' },
                                { timeSlot: room.timeSlot }
                            ]
                        }
                    },
                    $or: [
                        { status: 'confirmed', paymentStatus: 'succeeded' },
                        { paymentDetails: { status: 'succeeded' } }
                    ]
                });

                if (existingBooking) {
                    throw new Error(`Room ${room.name} is already booked for ${bookingDate.date} during the ${room.timeSlot} slot`);
                }
            }
        }
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Update timestamps on save
bookingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Export only as a named export for consistency
export const Booking = (mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema)) as Model<IBooking>; 