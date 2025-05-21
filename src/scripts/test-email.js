const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testEmail() {
    console.log('Starting email configuration test...');
    console.log('\nChecking environment variables:');
    
    const requiredVars = {
        EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
        EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
        EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
        EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
        EMAIL_FROM: process.env.EMAIL_FROM,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    };
    

    let missingVars = [];
    for (const [key, value] of Object.entries(requiredVars)) {
        console.log(`${key}: ${value ? '✓ Present' : '✗ Missing'}`);
        if (!value) missingVars.push(key);
    }

    if (missingVars.length > 0) {
        console.error('\n❌ Error: Missing required environment variables:', missingVars.join(', '));
        process.exit(1);
    }

    console.log('\nCreating SMTP transporter...');
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        secure: process.env.EMAIL_SERVER_PORT === "465",
        auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
        },
    });

    try {
        console.log('Verifying SMTP connection...');
        await transporter.verify();
        console.log('✓ SMTP connection successful!');

        console.log('\nSending test email...');
        const info = await transporter.sendMail({
            from: `"Hire a Clinic Test" <${process.env.EMAIL_FROM}>`,
            to: process.env.EMAIL_SERVER_USER,
            subject: "Email Configuration Test",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #3b82f6; text-align: center;">Email Configuration Test</h1>
                    <p>This is a test email sent at: ${new Date().toLocaleString()}</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="color: #1f2937; margin-top: 0;">Configuration Details</h2>
                        <ul>
                            <li>Host: ${process.env.EMAIL_SERVER_HOST}</li>
                            <li>Port: ${process.env.EMAIL_SERVER_PORT}</li>
                            <li>Secure: ${process.env.EMAIL_SERVER_PORT === "465" ? "Yes" : "No"}</li>
                            <li>From: ${process.env.EMAIL_FROM}</li>
                            <li>App URL: ${process.env.NEXT_PUBLIC_APP_URL}</li>
                        </ul>
                    </div>
                </div>
            `,
        });

        console.log('\n✓ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        console.log('\nResponse:', info.response);
        console.log('Accepted recipients:', info.accepted);
        console.log('Rejected recipients:', info.rejected);
    } catch (error) {
        console.error('\n❌ Error occurred:');
        console.error('Name:', error.name);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testEmail().catch(console.error); 