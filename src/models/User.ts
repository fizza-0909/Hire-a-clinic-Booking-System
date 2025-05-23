import { Schema, model, models } from 'mongoose';
import { hash } from 'bcryptjs';

const userSchema = new Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        select: false
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    verificationToken: {
        type: String,
        select: false
    },
    verificationCode: {
        type: String,
        select: false
    },
    verificationTokenExpiry: {
        type: Date,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    stripeCustomerId: {
        type: String,
        sparse: true  // Allows null values and creates a sparse index
    },
    preferences: {
        emailNotifications: {
            type: Boolean,
            default: true
        }
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

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        this.password = await hash(this.password, 12);
        this.updatedAt = new Date();
        next();
    } catch (error) {
        next(error as Error);
    }
});

export default models.User || model('User', userSchema);