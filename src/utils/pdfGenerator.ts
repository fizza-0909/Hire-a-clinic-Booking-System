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
    
    // Add header
    doc.setFontSize(20);
    doc.text('HIRE A CLINIC', doc.internal.pageSize.width / 2, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Booking Confirmation', doc.internal.pageSize.width / 2, 30, { align: 'center' });
    
    // Customer Details
    doc.setFontSize(14);
    doc.text('Customer Details', 20, 50);
    doc.setFontSize(12);
    doc.text(`Name: ${booking.customerName}`, 20, 60);
    doc.text(`Email: ${booking.email}`, 20, 70);
    doc.text(`Booking Number: ${booking.bookingNumber}`, 20, 80);

    // Booking Summary
    doc.setFontSize(14);
    doc.text('Booking Summary', 20, 100);
    doc.setFontSize(12);
    doc.text(`Booking Type: ${booking.bookingType}`, 20, 110);
    doc.text(`Booking Date: ${booking.bookingDate}`, 20, 120);

    // Room Details
    doc.setFontSize(14);
    doc.text('Room Details', 20, 140);
    doc.setFontSize(12);
    let yPos = 150;
    booking.roomDetails.forEach(room => {
        doc.text(`Room Number: ${room.roomNumber}`, 20, yPos);
        doc.text(`Time Slot: ${room.timeSlot}`, 20, yPos + 10);
        doc.text('Dates:', 20, yPos + 20);
        room.dates.forEach((date, index) => {
            doc.text(`- ${date}`, 30, yPos + 30 + (index * 10));
        });
        yPos += 50 + (room.dates.length * 10);
    });

    // Payment Details
    doc.setFontSize(14);
    doc.text('Payment Details', 20, yPos);
    doc.setFontSize(12);
    doc.text(`Subtotal: $${booking.paymentDetails.subtotal.toFixed(2)}`, 20, yPos + 10);
    doc.text(`Tax (3.5%): $${booking.paymentDetails.tax.toFixed(2)}`, 20, yPos + 20);
    if (booking.paymentDetails.securityDeposit > 0) {
        doc.text(`Security Deposit (Refundable): $${booking.paymentDetails.securityDeposit.toFixed(2)}`, 20, yPos + 30);
        doc.text(`Total Amount: $${booking.paymentDetails.totalAmount.toFixed(2)}`, 20, yPos + 40);
    } else {
        doc.text(`Total Amount: $${booking.paymentDetails.totalAmount.toFixed(2)}`, 20, yPos + 30);
    }



    // Add a new page for Terms and Conditions
doc.addPage();

doc.setFontSize(14);
doc.text('Terms and Conditions', 20, 30);
doc.setFontSize(10);
doc.text('• Payments are non-refundable. Only the security deposit is refundable as per policy.', 20, 40);
doc.text('• Renters are responsible for the equipment and space during their booked time slot.', 20, 50);
doc.text('• Clinic owners must maintain a safe and professional environment.', 20, 60);
doc.text('• Renters must respect booking times.', 20, 70);

    return doc;
}; 