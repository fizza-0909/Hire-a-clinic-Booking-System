import nodemailer from 'nodemailer';

interface EmailConfig {
    to: string;
    subject: string;
    html: string;
}

// Validate required environment variables
const requiredEnvVars = [
    'EMAIL_SERVER_HOST',
    'EMAIL_SERVER_PORT',
    'EMAIL_SERVER_USER',
    'EMAIL_SERVER_PASSWORD',
    'EMAIL_FROM'
];

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Log missing environment variables in development
if (!isProduction) {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.warn('Missing email environment variables:', missingVars.join(', '));
    }
}

// Log email configuration (without sensitive data)
console.log('Email Configuration:', {
    host: process.env.EMAIL_SERVER_HOST ? '***' : 'MISSING',
    port: process.env.EMAIL_SERVER_PORT ? '***' : 'MISSING',
    user: process.env.EMAIL_SERVER_USER ? '***' : 'MISSING',
    from: process.env.EMAIL_FROM ? '***' : 'MISSING',
    appUrl: process.env.NEXT_PUBLIC_APP_URL ? '***' : 'MISSING',
    nodeEnv: process.env.NODE_ENV || 'development'
});

// Create transporter with retry logic
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD
    },
    secure: true, // Use TLS
    connectionTimeout: 10000, // 10 seconds
    tls: {
        // Don't fail on invalid certs in development
        rejectUnauthorized: isProduction
    },
    // Add debug logging
    logger: true,
    debug: !isProduction,
    // Better handling of connection issues
    pool: true,
    maxConnections: 1,
    maxMessages: 5
});

// Verify connection configuration with better error handling
const verifyTransporter = async () => {
    try {
        console.log('Verifying SMTP connection...');
        const success = await transporter.verify();
        console.log('SMTP Server is ready to send emails');
        return success;
    } catch (error) {
        console.error('SMTP Connection Error:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof Error ? (error as any).code : 'NO_CODE',
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
};

// Verify on startup
if (process.env.NODE_ENV !== 'test') {
    verifyTransporter().catch(console.error);
}

export const sendEmail = async (config: EmailConfig, retryCount = 3): Promise<{ success: boolean; error?: string; details?: any }> => {
    let lastError;
    const startTime = Date.now();
    
    // Helper function to create timeout promise
    const withTimeout = (promise: Promise<any>, ms: number) => {
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Email sending timed out after ${ms}ms`)), ms)
        );
        return Promise.race([promise, timeout]);
    };
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        const attemptStartTime = Date.now();
        try {
            console.log(`Sending email attempt ${attempt}/${retryCount} to ${config.to}`);
            
            const mailOptions = {
                from: `"Hire a Clinic" <${process.env.EMAIL_FROM}>`,
                to: config.to,
                subject: config.subject,
                html: config.html,
                // Add headers for better email deliverability
                headers: {
                    'X-Priority': '1',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'high',
                    'X-Attempt-Number': attempt.toString(),
                    'X-Total-Attempts': retryCount.toString()
                }
            };

            console.log(`[${new Date().toISOString()}] Sending email with options:`, {
                ...mailOptions,
                from: '***',
                to: '***',
                html: '***',
                subject: mailOptions.subject
            });

            // Add a 10-second timeout for each attempt
            const info = await withTimeout(transporter.sendMail(mailOptions), 10000);
            const attemptDuration = Date.now() - attemptStartTime;
            const totalDuration = Date.now() - startTime;
            
            console.log(`[${new Date().toISOString()}] Email sent successfully in ${attemptDuration}ms (total ${totalDuration}ms):`, {
                messageId: info.messageId,
                accepted: info.accepted,
                rejected: info.rejected,
                pending: info.pending,
                response: info.response
            });
            
            return { 
                success: true,
                details: {
                    messageId: info.messageId,
                    attemptDuration,
                    totalDuration,
                    attemptNumber: attempt
                }
            };
            
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt} failed:`, error);
            
            // If it's the last attempt, don't wait
            if (attempt < retryCount) {
                // Exponential backoff: 1s, 2s, 4s, etc.
                const delayMs = Math.pow(2, attempt - 1) * 1000;
                console.log(`Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    
    // If we get here, all attempts failed
    console.error(`Failed to send email after ${retryCount} attempts`, lastError);
    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    console.error('Failed to send email after all retries:', {
        error: errorMessage,
        to: config.to,
        subject: config.subject,
        details: lastError instanceof Error ? {
            name: lastError.name,
            code: (lastError as any).code,
            stack: lastError.stack
        } : lastError
    });
    
    return { 
        success: false, 
        error: errorMessage,
        details: lastError
    };
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
): Promise<{ success: boolean; error?: string }> {
    console.log('Attempting to send verification email to:', to);

    // Validate required environment variables
    const requiredVars = {
        EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
        EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
        EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
        EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    };

    const missingVars = Object.entries(requiredVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        const verificationUrl = `${requiredVars.NEXT_PUBLIC_APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
        
        const emailContent = {
            to,
            subject: 'Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #3b82f6; text-align: center;">Verify Your Email</h1>
                    <p>Thank you for registering with Hire a Clinic. Please verify your email address by entering the following code:</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">
                            ${code}
                        </div>
                    </div>
                    
                    <p>Or click the button below to verify your email:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="display: inline-block; background-color: #3b82f6; color: white; 
                                  padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                                  font-weight: bold;">
                            Verify Email Address
                        </a>
                    </div>
                    
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                    
                    <div style="text-align: center; margin-top: 30px; color: #6b7280;">
                        <p>Hire a Clinic</p>
                        <p>2140 N Lake Forest Dr #100, McKinney, TX 75071</p>
                    </div>
                </div>
            `
        };

        const result = await sendEmail(emailContent);
        if (!result.success) {
            throw new Error(result.error || 'Failed to send verification email');
        }
        
        return { success: true };
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to send verification email';
        console.error('Error in sendVerificationEmail:', errorMsg);
        return { success: false, error: errorMsg };
    }
}