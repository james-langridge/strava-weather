import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';

export function AuthSuccess() {
    const { login } = useAuth();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;

        // Mark as processed to prevent multiple calls
        hasProcessed.current = true;

        const processAuth = async () => {
            try {
                console.log('🔐 Processing authentication...');

                // The OAuth callback has already set the HTTP-only cookie
                // We just need to verify and fetch user data
                await login();

                console.log('✅ Authentication successful, redirecting to dashboard...');

                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);

            } catch (error) {
                console.error('Failed to process authentication:', error);
                setTimeout(() => {
                    window.location.href = '/auth/error?error=auth_failed';
                }, 2000);
            }
        };

        processAuth();
    }, []); // Empty dependency array

    // Check if this is a new user
    const urlParams = new URLSearchParams(window.location.search);
    const isNewUser = urlParams.get('new_user') === 'true';

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                {/* Success Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                {/* Content */}
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    {isNewUser ? '🎉 Welcome to Strava Weather!' : '✅ Successfully Connected!'}
                </h1>

                <p className="text-gray-600 mb-6">
                    {isNewUser
                        ? 'Your Strava account has been connected successfully. Weather data will be automatically added to your future activities!'
                        : 'You\'re all set! Your account has been updated and weather processing will continue.'
                    }
                </p>

                {/* Loading indicator */}
                <div className="flex items-center justify-center space-x-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span className="text-sm">Completing authentication...</span>
                </div>

                {/* Manual redirect button */}
                <div className="mt-6">
                    <a
                        href="/dashboard"
                        className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium text-sm"
                    >
                        Or click here to go to dashboard
                        <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>

                {/* Quick tips for new users */}
                {isNewUser && (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg text-left">
                        <h3 className="font-semibold text-blue-900 mb-2">Quick Tips:</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Weather data is added automatically to new activities</li>
                            <li>• You can toggle weather updates on/off in settings</li>
                            <li>• View processing history in your dashboard</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}