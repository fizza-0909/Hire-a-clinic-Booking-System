// Terms and Conditions modal logic added for user compliance
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';

// Add TermsModal component
interface TermsModalProps {
    open: boolean;
    onClose: () => void;
    onAccept: () => void;
}
function TermsModal({ open, onClose, onAccept }: TermsModalProps) {
    if (!open) return null;
    const [checked, setChecked] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <h2 className="text-xl font-bold mb-4 text-center">Medical Office Use Agreement & Terms of Use</h2>
                <div className="text-sm text-gray-700 space-y-4">
                    {/* <p>This Agreement is made and entered into by and between <strong>Hire a Clinic</strong>, a (name of legal entity type – e.g., LLC, PLLC) ("Licensor"), and the undersigned individual or entity ("Licensee" or "Booking Party").</p> */}
                    <p>By booking, reserving, or using a medical office suite or space through <strong>Hire a Clinic</strong>, the Licensee agrees to be bound by the terms below.</p>
                    <h3 className="font-semibold mt-4">1. LICENSE TO USE PREMISES</h3>
                    <p><strong>1.1. Non-Exclusive License.</strong> Licensor grants Licensee a limited, revocable, non-transferable license to use specified medical office space at designated times, for lawful professional purposes only.</p>
                    <p><strong>1.2. No Lease or Tenancy Created.</strong> This Agreement is not a lease. It does not create a landlord-tenant relationship. It is a license for temporary use of space.</p>
                    <h3 className="font-semibold mt-4">2. LICENSEE REPRESENTATIONS & REQUIREMENTS</h3>
                    <p><strong>2.1. Licensee affirms that they are:</strong></p>
                    <ul className="list-disc pl-5">
                        <li>A duly licensed and credentialed healthcare provider;</li>
                        <li>Authorized to provide care in the jurisdiction where the office is located;</li>
                        <li>Carrying all required professional liability (malpractice) insurance and general liability insurance, and will provide proof upon request.</li>
                    </ul>
                    <p><strong>2.2. Licensee is fully responsible for:</strong></p>
                    <ul className="list-disc pl-5">
                        <li>Their own patients, services rendered, and compliance with all local, state, and federal laws (including HIPAA);</li>
                        <li>Bringing, securing, and maintaining their own medical records, forms, and supplies;</li>
                        <li>Ensuring they do not prescribe, store, or dispense controlled substances on the premises without proper licensing and safeguards.</li>
                    </ul>
                    <h3 className="font-semibold mt-4">3. USE OF PREMISES</h3>
                    <p><strong>3.1.</strong> Licensee shall use the premises only for consultations, evaluations, and services within the scope of their professional license.</p>
                    <p><strong>3.2.</strong> Licensee shall not:</p>
                    <ul className="list-disc pl-5">
                        <li>Alter, damage, or misuse the premises;</li>
                        <li>Conduct any illegal or unethical activity;</li>
                        <li>Solicit patients or staff of Hire a Clinic for unrelated business;</li>
                        <li>Leave personal items unattended or overnight unless explicitly permitted.</li>
                    </ul>
                    <p><strong>3.3.</strong> Shared amenities (e.g., waiting room, Wi-Fi, front desk, cleaning) are provided “as-is” and subject to availability.</p>
                    <h3 className="font-semibold mt-4">4. NO ENDORSEMENT OR SUPERVISION</h3>
                    <p><strong>4.1.</strong> Licensor does not supervise, endorse, or participate in the medical care provided by Licensee.</p>
                    <p><strong>4.2.</strong> Licensee acts entirely independently, and no employment, agency, or partnership is created by this agreement.</p>
                    <h3 className="font-semibold mt-4">5. FEES & PAYMENTS</h3>
                    <p><strong>5.1.</strong> Fees for room use are due at the time of booking and are non-refundable.</p>
                    <h3 className="font-semibold mt-4">6. INDEMNIFICATION & LIABILITY WAIVER</h3>
                    <p><strong>6.1.</strong> Licensee shall indemnify, defend, and hold harmless Hire a Clinic, its owners, officers, employees, and affiliates from:</p>
                    <ul className="list-disc pl-5">
                        <li>Any claims, demands, damages, lawsuits, or liabilities arising out of or related to Licensee’s use of the premises;</li>
                        <li>Any malpractice claims, patient complaints, or injuries occurring during or after Licensee’s use of the space;</li>
                        <li>Any violations of law or professional regulations by Licensee.</li>
                    </ul>
                    <p><strong>6.2.</strong> Licensor shall not be liable for:</p>
                    <ul className="list-disc pl-5">
                        <li>Any damages to personal property;</li>
                        <li>Business interruptions;</li>
                        <li>Lost income, reputational harm, or indirect damages.</li>
                    </ul>
                    <h3 className="font-semibold mt-4">7. INSURANCE REQUIREMENTS</h3>
                    <p>Licensee agrees to carry and maintain:</p>
                    <ul className="list-disc pl-5">
                        <li>Professional liability insurance with a minimum coverage of $1,000,000 per incident;</li>
                        <li>General liability insurance covering premises use;</li>
                        <li>Any other insurance required by applicable law.</li>
                    </ul>
                    <p>Proof of insurance must be furnished upon request.</p>
                    <h3 className="font-semibold mt-4">8. TERMINATION</h3>
                    <p><strong>8.1.</strong> Licensor reserves the right to revoke access or cancel any booking at its sole discretion for:</p>
                    <ul className="list-disc pl-5">
                        <li>Breach of this Agreement;</li>
                        <li>Unethical conduct;</li>
                        <li>Risk to property, staff, or patients.</li>
                    </ul>
                    <p><strong>8.2.</strong> Any violations may result in permanent banning from using Hire a Clinic services.</p>
                    <h3 className="font-semibold mt-4">9. DISPUTES & GOVERNING LAW</h3>
                    <p><strong>9.1.</strong> This Agreement is governed by the laws of the State of <strong>Texas</strong>.</p>
                    {/* <p><strong>9.2.</strong> All disputes shall be resolved through binding arbitration in <strong>Collin County,Texas</strong>, and not through court litigation.</p> */}
                    <p><strong>9.2.</strong> Attorneys’ fees and costs incurred by Hire a Clinic to enforce this agreement may be recoverable.</p>
                    <h3 className="font-semibold mt-4">10. MISCELLANEOUS</h3>
                    <ul className="list-disc pl-5">
                        <li><strong>Entire Agreement:</strong> This document represents the full agreement between the parties.</li>
                        <li><strong>No Waiver:</strong> Failure to enforce any provision does not waive future enforcement.</li>
                        <li><strong>Severability:</strong> If any provision is found unenforceable, the rest remains in effect.</li>
                        <li><strong>Electronic Acceptance:</strong> Use of the space constitutes agreement to these terms. A digital or physical signature is enforceable.</li>
                    </ul>
                    <hr className="my-4" />
                    <p className="text-center font-semibold"> By clicking “I Agree”, registering or booking a room, you acknowledge and agree that your submission serves as your consent and signature to comply with all applicable rules, policies, and regulations.</p>
                </div>
                <div className="flex items-center mt-6 mb-4 justify-center">
                    <input
                        id="modal-terms-checkbox"
                        type="checkbox"
                        checked={checked}
                        onChange={e => setChecked(e.target.checked)}
                        className="mr-2"
                    />
                    <label htmlFor="modal-terms-checkbox" className="text-sm">I have read and agree to the Terms and Conditions</label>
                </div>
                <div className="flex justify-center">
                    <button
                        className={`px-6 py-2 rounded bg-blue-600 text-white font-semibold ${!checked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!checked}
                        onClick={() => { if (checked) { onAccept(); onClose(); } }}
                    >
                        I Agree
                    </button>
                    <button
                        className="ml-2 px-6 py-2 rounded bg-gray-300 text-gray-700 font-semibold"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Register() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [passwordMatch, setPasswordMatch] = useState(true);
    const [error, setError] = useState('');
    const [termsChecked, setTermsChecked] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === 'phoneNumber') {
            // Remove all non-digit characters
            const digitsOnly = value.replace(/\D/g, '');

            // Format phone number as (XXX) XXX-XXXX
            let formattedNumber = digitsOnly;
            if (digitsOnly.length >= 10) {
                formattedNumber = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
            }

            setFormData(prev => ({
                ...prev,
                [name]: formattedNumber
            }));
        } else {
            setFormData(prev => {
                const newData = {
                    ...prev,
                    [name]: value
                };

                // Check password match when either password or confirmPassword changes
                if (name === 'password' || name === 'confirmPassword') {
                    const match = name === 'password'
                        ? value === prev.confirmPassword
                        : prev.password === value;
                    setPasswordMatch(match);
                }

                return newData;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            setIsLoading(false);
            setPasswordMatch(false);
            return;
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(formData.password)) {
            toast.error('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character');
            setIsLoading(false);
            return;
        }

        // Validate phone number
        const phoneDigits = formData.phoneNumber.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            toast.error('Please enter a valid 10-digit phone number');
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            const data = await res.json();

            if (res.ok) {
                toast.success('Registration successful! Please verify your email.');
                // Redirect to verification page with email
                router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
            } else {
                toast.error(data.error || 'Registration failed');
                setError(data.error || 'Registration failed');
            }
        } catch (err) {
            toast.error('An error occurred during registration');
            setError('An error occurred during registration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTermsCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!termsChecked) {
            e.preventDefault();
            setShowTermsModal(true);
        } else {
            setTermsChecked(false);
        }
    };

    const handleAcceptTerms = () => {
        setTermsChecked(true);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} onAccept={handleAcceptTerms} />
            <div className="flex items-center justify-center min-h-screen pt-8">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                    <h2 className="text-2xl font-bold mb-8 text-center">REGISTRATION FORM</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="First name"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Last name"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="(XXX) XXX-XXXX"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                required
                                pattern="\(\d{3}\) \d{3}-\d{4}"
                                title="Please enter a valid phone number in the format (XXX) XXX-XXXX"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Enter a 10-digit phone number
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    placeholder="Create a password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={8}
                                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
                                    title="Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                                Password must contain at least 8 characters, including uppercase, lowercase, number, and special character
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    className={`mt-1 block w-full px-3 py-2 rounded-md border shadow-sm focus:ring-1 focus:ring-blue-500 ${formData.confirmPassword
                                        ? passwordMatch
                                            ? 'border-green-500 focus:border-green-500'
                                            : 'border-red-500 focus:border-red-500'
                                        : 'border-gray-300 focus:border-blue-500'
                                        }`}
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={8}
                                />
                                {formData.confirmPassword && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {passwordMatch ? (
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>
                                )}
                            </div>
                            {formData.confirmPassword && !passwordMatch && (
                                <p className="mt-1 text-sm text-red-500">
                                    Passwords do not match
                                </p>
                            )}
                        </div>
                        <div className="flex items-center">
                            <input
                                id="terms-checkbox"
                                type="checkbox"
                                checked={termsChecked}
                                onChange={handleTermsCheckbox}
                                className="mr-2"
                                required
                            />
                            <label htmlFor="terms-checkbox" className="text-sm">
                                I agree to the <span className="text-blue-600 underline cursor-pointer" onClick={() => setShowTermsModal(true)}>Terms and Conditions</span>
                            </label>
                        </div>
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-red-800">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading || !termsChecked}
                            className={`w-full py-3 px-4 rounded-lg text-white text-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 ${isLoading || !termsChecked ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                                    Registering...
                                </div>
                            ) : (
                                'Register'
                            )}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <button
                                onClick={() => router.push('/login')}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Login here
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
} 