'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

const Header: React.FC = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push('/');
    };

    // Only show profile menu for authenticated users
    if (!session?.user) {
        return (
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16">
                    <div className="flex justify-between items-center h-full">
                        <Link href="/" className="text-2xl font-semibold text-blue-600">
                            Hire a Clinic
                        </Link>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16">
                <div className="flex justify-between items-center h-full">
                    <Link href="/booking" className="text-2xl font-semibold text-blue-600">
                        Hire a Clinic
                    </Link>

                    {/* Profile Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center space-x-3 hover:bg-gray-50 rounded-full p-2 transition-colors duration-200"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-lg">
                                    {session.user.name?.split(' ').map(n => n[0]).join('')}
                                </span>
                            </div>
                            <span className="text-gray-700">{session.user.name}</span>
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-100">
                                <div className="px-4 py-2 border-b border-gray-100">
                                    <div className="text-sm font-medium text-gray-900">
                                        {session.user.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {session.user.email}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        router.push('/my-bookings');
                                        setShowProfileMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    My Bookings
                                </button>
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setShowProfileMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header; 