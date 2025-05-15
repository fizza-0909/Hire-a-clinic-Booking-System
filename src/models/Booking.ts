import { Schema, model, models } from 'mongoose';
import { TimeSlot, BookingType } from '@/constants/pricing';

const bookingSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rooms: [{
        id: Number,
        name: String,
        timeSlot: {
            type: String,
            enum: ['full', 'morning', 'evening'],
            required: true
        },
        dates: [{
            type: String,
            required: true
        }]
    }],
    bookingType: {
        type: String,
        enum: ['daily', 'monthly'],
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    paymentIntentId: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add indexes for common queries
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ roomId: 1, dates: 1, timeSlot: 1 });
bookingSchema.index({ 'paymentDetails.stripePaymentIntentId': 1 });

// Validate dates don't overlap for same room and time slot
bookingSchema.pre('save', async function (next) {
    if (this.isModified('dates') || this.isModified('timeSlot') || this.isModified('roomId')) {
        const existingBooking = await mongoose.model('Booking').findOne({
            _id: { $ne: this._id },
            roomId: this.roomId,
            dates: { $in: this.dates },
            timeSlot: this.timeSlot,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingBooking) {
            next(new Error('Room is already booked for these dates and time slot'));
        }
    }
    next();
});

export const Booking = models.Booking || model('Booking', bookingSchema);
export default Booking; 