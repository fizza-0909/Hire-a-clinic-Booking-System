'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import toast from 'react-hot-toast';

interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
}

const ProfilePage = () => {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: ''
    });

    useEffect(() => {
        // Get user data from localStorage
        const userData = localStorage.getItem('user');
        if (!userData) {
            toast.error('Please login to view your profile');
            router.push('/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(userData);
            setProfile(parsedUser);
        } catch (error) {
            console.error('Error parsing user data:', error);
            toast.error('Error loading profile data');
        }
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = () => {
        try {
            // Save to localStorage
            localStorage.setItem('user', JSON.stringify(profile));
            setIsEditing(false);
            toast.success('Profile updated successfully');
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to save profile changes');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="max-w-4xl mx-auto px-4 pt-20">
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                            <button
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${isEditing
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {isEditing ? 'Save Changes' : 'Edit Profile'}
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={profile.firstName}
                                        onChange={handleInputChange}
                                        disabled={!isEditing}
                                        className={`w-full px-4 py-2 rounded-lg border ${isEditing
                                                ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'border-gray-200 bg-gray-50'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={profile.lastName}
                                        onChange={handleInputChange}
                                        disabled={!isEditing}
                                        className={`w-full px-4 py-2 rounded-lg border ${isEditing
                                                ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                : 'border-gray-200 bg-gray-50'
                                            }`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={profile.email}
                                    onChange={handleInputChange}
                                    disabled={!isEditing}
                                    className={`w-full px-4 py-2 rounded-lg border ${isEditing
                                            ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            : 'border-gray-200 bg-gray-50'
                                        }`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    value={profile.phoneNumber || ''}
                                    onChange={handleInputChange}
                                    disabled={!isEditing}
                                    className={`w-full px-4 py-2 rounded-lg border ${isEditing
                                            ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                            : 'border-gray-200 bg-gray-50'
                                        }`}
                                    placeholder="Enter your phone number"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => router.push('/profile/bookings')}
                                    className="flex items-center justify-center px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    <span>View My Bookings</span>
                                </button>
                                <button
                                    onClick={() => router.push('/booking')}
                                    className="flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <span>Make New Booking</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage; 