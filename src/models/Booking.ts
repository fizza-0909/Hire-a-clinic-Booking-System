import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: [true, 'Room ID is required']
    },
    dates: [{
        type: String,
        required: [true, 'Booking dates are required']
    }],
    timeSlot: {
        type: String,
        enum: ['full', 'morning', 'evening'],
        required: [true, 'Time slot is required']
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'failed'],
        default: 'pending'
    },
    totalAmount: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: [0, 'Total amount cannot be negative']
    },
    paymentDetails: {
        stripePaymentIntentId: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending'
        },
        paidAt: Date,
        failedAt: Date
    },
    bookingType: {
        type: String,
        enum: ['fullDay', 'halfDay'],
        required: true
    },
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

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema); 