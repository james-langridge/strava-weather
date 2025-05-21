import React from 'react';

export function AuthError() {
    // Get error message from URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('message') || 'Authentication failed';

    const handleRetry = () => {
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                {/* Error Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>

                {/* Content */}
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Connection Failed
                </h1>

                <p className="text-gray-600 mb-6">
                    We couldn't connect your Strava account. This might happen if you denied access or there was a technical issue.
                </p>

                {/* Error Details */}
                <div className="mb-6 p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">Error Details:</p>
                    <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handleRetry}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                    >
                        Try Again
                    </button>

                    <a
                        href="/web/public"
                        className="block w-full text-gray-600 hover:text-gray-700 py-2 transition-colors duration-200"
                    >
                        Back to Home
                    </a>
                </div>

                {/* Troubleshooting */}
                <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left">
                    <h3 className="font-semibold text-gray-900 mb-2">Troubleshooting:</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Make sure you click "Authorize" on the Strava page</li>
                        <li>• Check that you have a valid Strava account</li>
                        <li>• Try clearing your browser cache and cookies</li>
                        <li>• Contact support if the issue persists</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}