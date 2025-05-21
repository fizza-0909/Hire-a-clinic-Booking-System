const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Add debugging logs
console.log('Current directory:', __dirname);
console.log('Environment variables loaded:', {
    MONGODB_URI: process.env.MONGODB_URI ? 'Found' : 'Not found',
    NODE_ENV: process.env.NODE_ENV
});

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Room name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Room description is required'],
        trim: true
    },
    price: {
        fullDay: {
            type: Number,
            required: [true, 'Full day price is required'],
            min: [0, 'Price cannot be negative']
        },
        halfDay: {
            type: Number,
            required: [true, 'Half day price is required'],
            min: [0, 'Price cannot be negative']
        }
    },
    capacity: {
        type: Number,
        required: [true, 'Room capacity is required'],
        min: [1, 'Capacity must be at least 1']
    },
    amenities: [{
        type: String,
        trim: true
    }],
    images: [{
        url: {
            type: String,
            required: true
        },
        alt: {
            type: String,
            required: true
        }
    }],
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Room = mongoose.model('Room', roomSchema);

const initialRooms = [
    {
        name: 'Examination Room 1',
        description: 'Fully equipped examination room with modern medical equipment and comfortable patient seating.',
        price: {
            fullDay: 300,
            halfDay: 160
        },
        capacity: 3,
        amenities: [
            'Medical examination table',
            'Basic diagnostic equipment',
            'Sink and sanitization station',
            'LED lighting'
        ],
        images: [{
            url: '/images/rooms/exam-room-1.jpg',
            alt: 'Examination Room 1'
        }],
        isAvailable: true
    },
    {
        name: 'Consultation Room 2',
        description: 'Private consultation room ideal for patient consultations and discussions.',
        price: {
            fullDay: 300,
            halfDay: 160
        },
        capacity: 4,
        amenities: [
            'Desk and chairs',
            'Privacy screen',
            'Computer workstation',
            'Patient seating area'
        ],
        images: [{
            url: '/images/rooms/consult-room-2.jpg',
            alt: 'Consultation Room 2'
        }],
        isAvailable: true
    },
    {
        name: 'Procedure Room 3',
        description: 'Specialized room for medical procedures with advanced equipment and sterile environment.',
        price: {
            fullDay: 300,
            halfDay: 160
        },
        capacity: 5,
        amenities: [
            'Surgical lighting',
            'Medical gas outlets',
            'Sterilization equipment',
            'Emergency equipment'
        ],
        images: [{
            url: '/images/rooms/procedure-room-3.jpg',
            alt: 'Procedure Room 3'
        }],
        isAvailable: true
    }
];

async function initializeRooms() {
    try {
        // Log MongoDB URI (without sensitive info)
        const mongoUri = process.env.MONGODB_URI;
        console.log('Attempting to connect to MongoDB...', {
            uriExists: !!mongoUri,
            uriLength: mongoUri ? mongoUri.length : 0
        });

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing rooms
        await Room.deleteMany({});
        console.log('Cleared existing rooms');

        // Insert new rooms
        const rooms = await Room.insertMany(initialRooms);
        console.log('Inserted rooms:', rooms);

        console.log('Room initialization completed successfully');
    } catch (error) {
        console.error('Error initializing rooms:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

initializeRooms(); 