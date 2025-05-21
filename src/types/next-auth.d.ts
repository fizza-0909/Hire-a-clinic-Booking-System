import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            firstName: string;
            lastName: string;
            phoneNumber?: string;
            isEmailVerified: boolean;
            isVerified: boolean; // For security deposit purposes
            role: string;
            isProfileVerified: boolean;
        }
    }

    interface User {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
        phoneNumber?: string;
        isEmailVerified: boolean;
        isVerified: boolean;
        isProfileVerified: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
        isEmailVerified: boolean;
        isVerified: boolean;
    }
} 