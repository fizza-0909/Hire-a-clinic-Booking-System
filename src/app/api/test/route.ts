import { NextResponse } from 'next/server';

export async function POST() {
    console.log('Test endpoint hit!');
    return NextResponse.json({ success: true, message: 'Test endpoint working' });
}
