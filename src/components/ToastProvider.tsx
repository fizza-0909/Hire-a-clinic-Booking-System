'use client';

import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            gutter={12}
            containerStyle={{
                top: 20,
                right: 20,
                fontSize: '14px',
            }}
            toastOptions={{
                duration: 3000,
                success: {
                    style: {
                        background: '#10B981',
                        color: 'white',
                        padding: '16px',
                        borderRadius: '8px',
                    },
                },
                error: {
                    style: {
                        background: '#EF4444',
                        color: 'white',
                        padding: '16px',
                        borderRadius: '8px',
                    },
                },
            }}
        />
    );
} 