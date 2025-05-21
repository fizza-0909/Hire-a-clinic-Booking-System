import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.json(
        { error: "Verification token and email are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({
      email: email.toLowerCase(),
      verificationToken: token,
      isEmailVerified: false
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationCode = undefined;
    await user.save();

    return NextResponse.json({ 
      success: true,
      message: "Email verified successfully"
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
} 