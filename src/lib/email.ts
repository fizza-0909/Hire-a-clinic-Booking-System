import nodemailer from 'nodemailer';

interface EmailConfig {
    to: string;
    subject: string;
    html: string;
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD
    },
    secure: true
});

export const sendEmail = async (config: EmailConfig) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            ...config
        });
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};

export const getBookingConfirmationEmail = (booking: {
    customerName: string;
    bookingNumber: string;
    roomDetails: Array<{
        roomNumber: string;
        timeSlot: string;
        dates: string[];
    }>;
    paymentDetails: {
        subtotal: number;
        tax: number;
        securityDeposit: number;
        totalAmount: number;
    };
}) => {
    const roomDetailsHtml = booking.roomDetails.map(room => `
        <div style="margin-bottom: 20px;">
            <h3 style="margin: 0;">Room ${room.roomNumber}</h3>
            <p style="margin: 5px 0;">Time Slot: ${room.timeSlot}</p>
            <p style="margin: 5px 0;">Dates:</p>
            <ul style="margin: 5px 0;">
                ${room.dates.map(date => `<li>${date}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    return {
        subject: `Booking Confirmation - ${booking.bookingNumber}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb; text-align: center; padding: 20px;">HIRE A CLINIC</h1>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
                    <h2 style="margin-top: 0;">Booking Confirmation</h2>
                    <p>Dear ${booking.customerName},</p>
                    <p>Thank you for your booking. Your booking has been confirmed with the following details:</p>
                    
                    <div style="margin: 20px 0;">
                        <h3 style="margin: 0;">Booking Number</h3>
                        <p style="margin: 5px 0;">${booking.bookingNumber}</p>
                    </div>

                    <div style="margin: 20px 0;">
                        <h3 style="margin: 0;">Room Details</h3>
                        ${roomDetailsHtml}
                    </div>

                    <div style="margin: 20px 0;">
                        <h3 style="margin: 0;">Payment Details</h3>
                        <table style="width: 100%; margin-top: 10px;">
                            <tr>
                                <td>Subtotal:</td>
                                <td style="text-align: right;">$${booking.paymentDetails.subtotal.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>Tax (3.5%):</td>
                                <td style="text-align: right;">$${booking.paymentDetails.tax.toFixed(2)}</td>
                            </tr>
                            ${booking.paymentDetails.securityDeposit > 0 ? `
                                <tr>
                                    <td>Security Deposit (Refundable):</td>
                                    <td style="text-align: right;">$${booking.paymentDetails.securityDeposit.toFixed(2)}</td>
                                </tr>
                            ` : ''}
                            <tr style="font-weight: bold;">
                                <td>Total Amount:</td>
                                <td style="text-align: right;">$${booking.paymentDetails.totalAmount.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="margin: 20px 0; padding: 20px; background-color: #e5e7eb; border-radius: 4px;">
                        <h3 style="margin: 0;">Important Information</h3>
                        <ul style="margin: 10px 0;">
                            <li>Please arrive 15 minutes before your scheduled time</li>
                            <li>Bring a valid ID for verification</li>
                            <li>Follow all clinic safety protocols</li>
                            <li>Keep this confirmation for your records</li>
                        </ul>
                    </div>

                    <p style="margin-top: 20px;">If you have any questions, please don't hesitate to contact us.</p>
                    <p style="margin-bottom: 0;">Best regards,<br>Hire A Clinic Team</p>
                </div>
            </div>
        `
    };
};

export function getBookingReminderEmail(booking: any) {
    return {
        subject: 'Upcoming Booking Reminder - Hire a Clinic',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #3b82f6; text-align: center;">Booking Reminder</h1>
                <p>Dear ${booking.customerName},</p>
                <p>This is a reminder for your upcoming booking at Hire a Clinic.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="color: #1f2937; margin-top: 0;">Booking Details</h2>
                    <p><strong>Date:</strong> ${new Date(booking.date).toLocaleDateString()}</p>
                    <p><strong>Time Slot:</strong> ${booking.timeSlot}</p>
                    <p><strong>Room:</strong> ${booking.roomName}</p>
                </div>
                
                <p>Please arrive 15 minutes before your scheduled time.</p>
                <p>If you need to make any changes to your booking, please contact us as soon as possible.</p>
                
                <div style="text-align: center; margin-top: 30px; color: #6b7280;">
                    <p>Hire a Clinic</p>
                    <p>2140 N Lake Forest Dr #100, McKinney, TX 75071</p>
                </div>
            </div>
        `
    };
}

export function getRegistrationConfirmationEmail(user: any) {
    return {
        subject: 'Welcome to Hire a Clinic!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #3b82f6; text-align: center;">Welcome to Hire a Clinic</h1>
                <p>Dear ${user.firstName},</p>
                <p>Thank you for registering with Hire a Clinic. Your account has been successfully created.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="color: #1f2937; margin-top: 0;">Your Account Details</h2>
                    <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                </div>
                
                <p>You can now:</p>
                <ul style="list-style-type: none; padding: 0;">
                    <li style="margin: 10px 0; padding-left: 24px; position: relative;">
                        ✓ Book clinic rooms and facilities
                    </li>
                    <li style="margin: 10px 0; padding-left: 24px; position: relative;">
                        ✓ Manage your bookings
                    </li>
                    <li style="margin: 10px 0; padding-left: 24px; position: relative;">
                        ✓ Update your profile information
                    </li>
                </ul>
                
                <p>To get started, simply <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" style="color: #3b82f6; text-decoration: none;">log in to your account</a>.</p>
                
                <div style="text-align: center; margin-top: 30px; color: #6b7280;">
                    <p>Hire a Clinic</p>
                    <p>2140 N Lake Forest Dr #100, McKinney, TX 75071</p>
                </div>
            </div>
        `
    };
}

export function getIncompletePaymentEmail(booking: any) {
    return {
        subject: 'Complete Your Booking Payment - Hire a Clinic',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #3b82f6; text-align: center;">Complete Your Booking</h1>
                <p>Dear ${booking.customerName},</p>
                <p>We noticed that you haven't completed the payment for your recent booking.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="color: #1f2937; margin-top: 0;">Booking Details</h2>
                    <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                    <p><strong>Total Amount:</strong> $${booking.totalAmount.toFixed(2)}</p>
                    
                    <h3 style="color: #1f2937;">Room Details</h3>
                    ${booking.rooms.map((room: any) => `
                        <div style="margin-bottom: 15px;">
                            <p><strong>Room:</strong> ${room.name}</p>
                            <p><strong>Time Slot:</strong> ${room.timeSlot}</p>
                            <p><strong>Dates:</strong></p>
                            <ul>
                                ${room.dates.map((date: string) => `
                                    <li>${new Date(date).toLocaleDateString()}</li>
                                `).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
                
                <p>To complete your booking, please <a href="${process.env.NEXT_PUBLIC_APP_URL}/booking/payment/${booking.bookingId}" style="color: #3b82f6; text-decoration: none;">click here to make your payment</a>.</p>
                <p>If you need assistance or have any questions, please don't hesitate to contact us.</p>
                
                <div style="text-align: center; margin-top: 30px; color: #6b7280;">
                    <p>Hire a Clinic</p>
                    <p>2140 N Lake Forest Dr #100, McKinney, TX 75071</p>
                </div>
            </div>
        `
    };
}

export async function sendVerificationEmail(
    to: string,
    token: string,
    code: string
) {
    console.log('Attempting to send verification email to:', to);

    if (!process.env.EMAIL_SERVER_HOST || 
        !process.env.EMAIL_SERVER_PORT || 
        !process.env.EMAIL_SERVER_USER || 
        !process.env.EMAIL_SERVER_PASSWORD ||
        !process.env.EMAIL_FROM ||
        !process.env.NEXT_PUBLIC_APP_URL) {
        console.error('Missing email configuration:', {
            host: !!process.env.EMAIL_SERVER_HOST,
            port: !!process.env.EMAIL_SERVER_PORT,
            user: !!process.env.EMAIL_SERVER_USER,
            pass: !!process.env.EMAIL_SERVER_PASSWORD,
            from: !!process.env.EMAIL_FROM,
            appUrl: !!process.env.NEXT_PUBLIC_APP_URL
        });
        throw new Error('Email configuration is incomplete');
    }

    const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(to)}`;
    
    try {
        await sendEmail({
            to,
            subject: 'Verify Your Email - Hire a Clinic',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #3b82f6; text-align: center;">Verify Your Email</h1>
                    <p>Thank you for registering with Hire a Clinic. To complete your registration, please verify your email address.</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="color: #1f2937; margin-top: 0;">Verification Options</h2>
                        
                        <div style="margin-bottom: 20px;">
                            <p><strong>Option 1:</strong> Click the button below to verify your email:</p>
                            <a href="${verificationLink}" 
                               style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 6px; margin: 10px 0;">
                                Verify Email
                            </a>
                        </div>
                        
                        <div>
                            <p><strong>Option 2:</strong> Go to the verification page and enter this code:</p>
                            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/verify-email?email=${encodeURIComponent(to)}" style="color: #3b82f6; text-decoration: none;">Click here to go to verification page</a></p>
                            <div style="background-color: white; padding: 15px; border-radius: 4px; text-align: center; 
                                      font-size: 24px; letter-spacing: 4px; font-family: monospace;">
                                ${code}
                            </div>
                        </div>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                        This verification code will expire in 24 hours. If you did not create an account with Hire a Clinic, 
                        please ignore this email.
                    </p>
                    
                    <div style="text-align: center; margin-top: 30px; color: #6b7280;">
                        <p>Hire a Clinic</p>
                        <p>2140 N Lake Forest Dr #100, McKinney, TX 75071</p>
                    </div>
                </div>
            `
        });
        
        console.log('Verification email sent successfully');
        return true;
    } catch (error) {
        console.error('Failed to send verification email:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
} 