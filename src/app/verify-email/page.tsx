'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

function VerifyEmailContent() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [isResending, setIsResending] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();

    // Pre-fill email from query param
    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            const decodedEmail = decodeURIComponent(emailParam);
            setEmail(decodedEmail);
        }
    }, [searchParams]);

    // If user comes from the link, verify automatically
    useEffect(() => {
        const token = searchParams.get('token');
        const emailParam = searchParams.get('email');
        
        if (token && emailParam) {
            setStatus('loading');
            fetch(`/api/auth/verify?token=${token}&email=${emailParam}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setStatus('success');
                        setMessage('Email verified successfully!');
                        toast.success('Email verified successfully!');
                        // Wait 2 seconds before redirecting
                        setTimeout(() => router.push('/login?verified=true'), 2000);
                    } else {
                        setStatus('error');
                        setMessage(data.error || 'Failed to verify email');
                        toast.error(data.error || 'Failed to verify email');
                        // If verification fails, stay on the page to let user enter code
                        setCode('');
                    }
                })
                .catch(() => {
                    setStatus('error');
                    setMessage('An error occurred while verifying your email');
                    toast.error('An error occurred while verifying your email');
                    // If verification fails, stay on the page to let user enter code
                    setCode('');
                });
        }
    }, [searchParams, router]);

    // Handle code verification
    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');
        if (!email || !code) {
            setStatus('error');
            setMessage('Please enter your email and the verification code.');
            toast.error('Please enter your email and the verification code.');
            return;
        }
        try {
            const res = await fetch('/api/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStatus('success');
                setMessage('Email verified successfully!');
                toast.success('Email verified successfully!');
                // Wait 2 seconds before redirecting
                setTimeout(() => router.push('/login?verified=true'), 2000);
            } else {
                setStatus('error');
                setMessage(data.error || 'Invalid or expired code.');
                toast.error(data.error || 'Invalid or expired code.');
                // Clear the code field on error
                setCode('');
            }
        } catch {
            setStatus('error');
            setMessage('An error occurred while verifying your code.');
            toast.error('An error occurred while verifying your code.');
            // Clear the code field on error
            setCode('');
        }
    };

    // Handle resend verification email
    const handleResendVerification = async () => {
        if (isResending || !email) return;
        
        setIsResending(true);
        setMessage('');
        
        try {
            const res = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                toast.success('A new verification email has been sent. Please check your inbox.');
                setMessage('A new verification email has been sent. Please check your inbox.');
            } else {
                toast.error(data.error || 'Failed to resend verification email.');
                setMessage(data.error || 'Failed to resend verification email.');
            }
        } catch (error) {
            toast.error('An error occurred while resending the verification email.');
            setMessage('An error occurred while resending the verification email.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Email Verification
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Please verify your email address to complete registration
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleCodeSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                // value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                disabled={status === 'loading' || status === 'success'}
                            />
                        </div>
                        <div>
                            <label htmlFor="code" className="sr-only">Verification Code</label>
                            <input
                                id="code"
                                name="code"
                                type="text"
                                required
                                value={code}
                                onChange={(e) => {
                                    // Only allow digits and limit to 6 characters
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setCode(value);
                                }}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Enter 6-digit verification code"
                                disabled={status === 'loading' || status === 'success'}
                                maxLength={6}
                                pattern="[0-9]{6}"
                                inputMode="numeric"
                                title="Please enter a 6-digit verification code"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col space-y-4">
                        <button
                            type="submit"
                            disabled={status === 'loading' || status === 'success' || !email || !code}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? 'Verifying...' : 'Verify Code'}
                        </button>
                        <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={isResending || !email || status === 'success'}
                            className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isResending ? 'Sending...' : 'Resend verification email'}
                        </button>
                    </div>
                </form>
                {message && (
                    <div className={`rounded-md p-4 ${
                        status === 'success' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                        <div className="flex">
                            <div className="flex-shrink-0">
                                {status === 'success' ? (
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3">
                                <p className={`text-sm font-medium ${
                                    status === 'success' ? 'text-green-800' : 'text-red-800'
                                }`}>
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                <div className="text-center">
                    <Link
                        href="/login"
                        className="font-medium text-blue-600 hover:text-blue-500"
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Loading verification...</div>}>
            <VerifyEmailContent />
        </Suspense>
    );
} 