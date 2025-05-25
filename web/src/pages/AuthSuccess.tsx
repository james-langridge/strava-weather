import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useNavigate } from "react-router";
import { logger } from '../lib/logger';

/**
 * Authentication success page component
 *
 * Handles the redirect flow after successful Strava OAuth authentication.
 * This page is shown when users are redirected back from Strava after
 * granting permissions to the application.
 *
 * Flow:
 * 1. User redirected here from Strava OAuth callback
 * 2. Component processes authentication via AuthContext
 * 3. On success, redirects to dashboard
 * 4. On failure, redirects to error page
 *
 * Also handles display of welcome message for new users.
 */
export function AuthSuccess() {
    const { login, user } = useAuth();
    const hasProcessed = useRef(false);
    const navigate = useNavigate();

    /**
     * Parse URL parameters on component load
     */
    const urlParams = new URLSearchParams(window.location.search);
    const isNewUser = urlParams.get('new_user') === 'true';

    /**
     * Process authentication on mount
     *
     * This effect handles the initial authentication processing
     * and prevents duplicate processing with a ref guard.
     */
    useEffect(() => {
        // If user is already authenticated, redirect immediately
        if (user) {
            logger.info('User already authenticated on auth success page', {
                userId: user.id,
                redirectTo: '/dashboard',
            });
            navigate('/dashboard', { replace: true });
            return;
        }

        // Prevent duplicate authentication processing
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const processAuth = async () => {
            try {
                logger.info('Processing authentication callback', {
                    isNewUser,
                    hasUser: !!user,
                });

                await login();
                // Navigation happens in the user state effect below

            } catch (error) {
                logger.error('Failed to process authentication callback', error, {
                    redirectTo: '/auth/error',
                });

                navigate('/auth/error?error=auth_failed', { replace: true });
            }
        };

        processAuth();
    }, [user, login, navigate, isNewUser]);

    /**
     * Handle navigation after user state updates
     *
     * Separate effect to handle navigation after the user
     * state is updated by the login process.
     */
    useEffect(() => {
        if (user) {
            logger.info('Authentication successful, redirecting to dashboard', {
                userId: user.id,
                displayName: user.displayName,
                isNewUser,
            });

            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate, isNewUser]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                {/* Success Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                {/* Welcome/Success Message */}
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    {isNewUser ? 'Welcome to Strava Weather!' : 'Successfully Connected!'}
                </h1>

                <p className="text-gray-600 mb-6">
                    {isNewUser
                        ? 'Your Strava account has been connected successfully. Weather data will be automatically added to your future activities!'
                        : 'You\'re all set! Your account has been updated and weather processing will continue.'
                    }
                </p>

                {/* Loading Indicator */}
                <div className="flex items-center justify-center space-x-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span className="text-sm">Completing authentication...</span>
                </div>

                {/* Manual Redirect Fallback */}
                <div className="mt-6">
                    <a
                        href="/dashboard"
                        className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium text-sm"
                        onClick={() => {
                            logger.debug('Manual dashboard redirect clicked');
                        }}
                    >
                        Or click here to go to dashboard
                        <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>

                {/* Quick Tips for New Users */}
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