import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';

export function Landing() {
    const { login, error } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await login();
        } catch (error) {
            console.error('Connection failed:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50">
            <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                {/* Hero Section */}
                <div className="text-center">
                    <div className="mb-8">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                            ⛅ Strava Weather
                        </h1>
                        <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                            Automatically add weather data to your Strava activities
                        </p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="text-3xl mb-4">🌡️</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Real Weather Data
                            </h3>
                            <p className="text-gray-600">
                                Temperature, humidity, wind speed, and conditions at the time of your activity
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="text-3xl mb-4">⚡</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Automatic Updates
                            </h3>
                            <p className="text-gray-600">
                                New activities get weather data added automatically via webhooks
                            </p>
                        </div>

                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="text-3xl mb-4">🔒</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Secure & Private
                            </h3>
                            <p className="text-gray-600">
                                Your data stays secure. Revoke access anytime from your dashboard
                            </p>
                        </div>
                    </div>

                    {/* Call to Action */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-md mx-auto">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Get Started
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Connect your Strava account to start adding weather data to your activities
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                        >
                            {isConnecting ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Connecting...</span>
                                </>
                            ) : (
                                <>
                                    <span>🏃</span>
                                    <span>Connect to Strava</span>
                                </>
                            )}
                        </button>

                        <p className="text-xs text-gray-500 mt-4">
                            You'll be redirected to Strava to authorize the connection
                        </p>
                    </div>

                    {/* How it works */}
                    <div className="mt-16">
                        <h2 className="text-2xl font-bold text-gray-900 mb-8">
                            How it works
                        </h2>
                        <div className="grid md:grid-cols-4 gap-6 text-left">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg mb-3">
                                    1
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Connect</h3>
                                <p className="text-sm text-gray-600">
                                    Authorize our app to access your Strava activities
                                </p>
                            </div>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg mb-3">
                                    2
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Activity</h3>
                                <p className="text-sm text-gray-600">
                                    Upload activities to Strava as you normally do
                                </p>
                            </div>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg mb-3">
                                    3
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Weather</h3>
                                <p className="text-sm text-gray-600">
                                    We automatically fetch weather data and update your activity
                                </p>
                            </div>

                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg mb-3">
                                    4
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Enjoy</h3>
                                <p className="text-sm text-gray-600">
                                    View enriched activities with weather context
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}