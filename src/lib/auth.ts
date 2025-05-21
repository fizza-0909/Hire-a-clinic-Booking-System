import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "./mongodb";
import User from "@/models/User";
import dbConnect from "./mongoose";
import bcrypt from 'bcryptjs';

// Extend the built-in session types
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            firstName: string;
            lastName: string;
            role: string;
            isVerified: boolean;
            isEmailVerified: boolean;
        }
    }

    interface User {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
        role: string;
        isVerified: boolean;
        isEmailVerified: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
        role: string;
        isVerified: boolean;
        isEmailVerified: boolean;
    }
}

if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('Please define NEXTAUTH_SECRET environment variable');
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Please enter your email and password');
                }

                await dbConnect();

                const user = await User.findOne({ email: credentials.email }).select('+password');
                if (!user) {
                    throw new Error('No user found with this email');
                }

                const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
                if (!isPasswordValid) {
                    throw new Error('Invalid password');
                }

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role || 'user',
                    isVerified: user.isVerified || false,
                    isEmailVerified: user.isEmailVerified || false
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                // Initial sign in
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.firstName = user.firstName;
                token.lastName = user.lastName;
                token.role = user.role;
                token.isVerified = user.isVerified;
                token.isEmailVerified = user.isEmailVerified;
            }
            
            // Always refresh user data on each request
            try {
                await dbConnect();
                const freshUser = await User.findById(token.id).lean();
                if (freshUser) {
                    token.isVerified = freshUser.isVerified;
                    token.isEmailVerified = freshUser.isEmailVerified;
                    console.log('Updated user verification status in token:', {
                        isVerified: freshUser.isVerified,
                        isEmailVerified: freshUser.isEmailVerified
                    });
                }
            } catch (error) {
                console.error('Error refreshing user data:', error);
            }
            
            return token;
        },
        async session({ session, token }) {
            session.user = {
                id: token.id,
                email: token.email,
                name: token.name,
                firstName: token.firstName,
                lastName: token.lastName,
                role: token.role,
                isVerified: token.isVerified,
                isEmailVerified: token.isEmailVerified
            };
            return session;
        }
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development'
}; 