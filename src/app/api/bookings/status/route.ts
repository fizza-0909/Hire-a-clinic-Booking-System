import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Booking } from '@/models/Booking';

export async function POST(req: Request) {
    try {
        const { month, year, roomId } = await req.json();

        console.log('Received booking status request');
        console.log('Request parameters:', { month, year, roomId });

        if (!month || !year || !roomId) {
            return NextResponse.json(
                { error: 'Month, year, and roomId are required' },
                { status: 400 }
            );
        }

        await dbConnect();
        console.log('Connecting to database...');

        // Calculate start and end dates for the month
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        console.log('Searching for bookings between:', { startDate, endDate });

        // Find bookings for the specified room and date range
        const bookings = await Booking.find({
            'rooms': {
                $elemMatch: {
                    'id': Number(roomId),
                    'dates': {
                        $in: Array.from({ length: 31 }, (_, i) => {
                            const date = new Date(year, month - 1, i + 1);
                            return date.toISOString().split('T')[0];
                        })
                    }
                }
            }
        }).select('rooms status').lean();

        console.log(`Found ${bookings.length} bookings for room ${roomId}`);

        // Format the response
        const formattedBookings = bookings.flatMap(booking => {
            const roomBooking = booking.rooms.find(r => r.id === Number(roomId));
            if (!roomBooking) return [];

            return roomBooking.dates
                .filter(date => {
                    const [bookingYear, bookingMonth] = date.split('-').map(Number);
                    return bookingYear === year && bookingMonth === month;
                })
                .map(date => ({
                    date,
                    roomId: roomId.toString(),
                    timeSlots: [roomBooking.timeSlot],
                    status: booking.status // Include the booking status
                }));
        });

        console.log('Formatted bookings:', formattedBookings);

        return NextResponse.json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching booking status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch booking status' },
            { status: 500 }
        );
    }
} 