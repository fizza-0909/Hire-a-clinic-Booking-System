import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({
      email: email.toLowerCase(),
      isEmailVerified: false
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found or already verified" },
        { status: 400 }
      );
    }

    // Generate new verification token and code
    const verificationToken = await bcrypt.hash(user._id.toString() + Date.now().toString(), 12);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

    // Save new verification details
    user.verificationToken = verificationToken;
    user.verificationCode = verificationCode;
    await user.save();

    // Send new verification email
    await sendVerificationEmail(
      user.email,
      verificationToken,
      verificationCode
    );

    return NextResponse.json({ 
      success: true,
      message: "Verification email resent successfully"
    });
  } catch (error) {
    console.error("Failed to resend verification email:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    );
  }
} 