import jsPDF from 'jspdf';

interface BookingDetails {
    customerName: string;
    email: string;
    bookingNumber: string;
    bookingType: string;
    bookingDate: string;
    roomDetails: {
        roomNumber: string;
        timeSlot: string;
        dates: string[];
    }[];
    paymentDetails: {
        subtotal: number;
        tax: number;
        securityDeposit: number;
        totalAmount: number;
    };
}

export const generateBookingPDF = (booking: BookingDetails) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 20;

    let yPos = 20;

    const checkPageOverflow = (heightNeeded: number) => {
        if (yPos + heightNeeded > pageHeight - marginBottom) {
            doc.addPage();
            yPos = 20; // reset for new page
        }
    };

    // Header
    doc.setFontSize(20);
    doc.text('HIRE A CLINIC', doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 10;
    doc.setFontSize(16);
    doc.text('Booking Confirmation', doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 20;

    // Customer Details
    doc.setFontSize(14);
    doc.text('Customer Details', 20, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.text(`Name: ${booking.customerName}`, 20, yPos);
    yPos += 10;
    doc.text(`Email: ${booking.email}`, 20, yPos);
    yPos += 10;
    doc.text(`Booking Number: ${booking.bookingNumber}`, 20, yPos);
    yPos += 20;

    // Booking Summary
    doc.setFontSize(14);
    doc.text('Booking Summary', 20, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.text(`Booking Type: ${booking.bookingType}`, 20, yPos);
    yPos += 10;
    doc.text(`Booking Date: ${booking.bookingDate}`, 20, yPos);
    yPos += 20;

    // Room Details
    doc.setFontSize(14);
    doc.text('Room Details', 20, yPos);
    yPos += 10;
    doc.setFontSize(12);
    booking.roomDetails.forEach(room => {
        checkPageOverflow(40); // space for room number, time slot, and at least 2 date lines

        doc.text(`Room Number: ${room.roomNumber}`, 20, yPos);
        yPos += 10;
        doc.text(`Time Slot: ${room.timeSlot}`, 20, yPos);
        yPos += 10;
        doc.text('Dates:', 20, yPos);
        yPos += 10;

        room.dates.forEach(date => {
            checkPageOverflow(10);
            doc.text(`- ${date}`, 30, yPos);
            yPos += 10;
        });

        yPos += 10; // extra spacing after each room
    });

    // Payment Details
    doc.setFontSize(14);
    checkPageOverflow(50);
    doc.text('Payment Details', 20, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.text(`Subtotal: $${booking.paymentDetails?.subtotal?.toFixed(2)}`, 20, yPos);
    yPos += 10;
    doc.text(`Tax (3.5%): $${booking.paymentDetails?.tax?.toFixed(2)}`, 20, yPos);
    yPos += 10;
    if (booking.paymentDetails?.securityDeposit > 0) {
        doc.text(`Security Deposit (Refundable): $${booking.paymentDetails?.securityDeposit?.toFixed(2)}`, 20, yPos);
        yPos += 10;
    }
    doc.text(`Total Amount: $${booking.paymentDetails?.totalAmount?.toFixed(2)}`, 20, yPos);
    yPos += 20;

    // Terms and Conditions on a new page
    doc.addPage();
    yPos = 30;
    doc.setFontSize(14);
    doc.text('Terms and Conditions', 20, yPos);
    yPos += 10;
    doc.setFontSize(10);
    const terms = [
        '• Payments are non-refundable. Only the security deposit is refundable as per policy.',
        '• Renters are responsible for the equipment and space during their booked time slot.',
        '• Clinic owners must maintain a safe and professional environment.',
        '• Renters must respect booking times.'
    ];
    terms.forEach(term => {
        doc.text(term, 20, yPos);
        yPos += 10;
    });

    return doc;
};
