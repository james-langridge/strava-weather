import React from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo/Brand */}
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">
                                ⛅ Strava Weather
                            </h1>
                        </div>

                        {/* User Menu */}
                        {user && (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-3">
                                    {user.profileImageUrl && (
                                        <img
                                            src={user.profileImageUrl}
                                            alt={user.displayName}
                                            className="w-8 h-8 rounded-full border border-gray-300"
                                        />
                                    )}
                                    <span className="text-sm font-medium text-gray-700">
                    {user.displayName}
                  </span>
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={logout}
                                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                        <p>
                            Strava Weather Integration - Add weather data to your activities
                        </p>
                        <div className="flex space-x-4">
                            <a
                                href="https://strava.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-700 transition-colors"
                            >
                                Strava
                            </a>
                            <a
                                href="https://openweathermap.org"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-700 transition-colors"
                            >
                                OpenWeather
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}