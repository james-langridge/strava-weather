import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';

export function Dashboard() {
    const { user, updateUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    const toggleWeatherEnabled = async () => {
        if (!user || updating) return;

        try {
            setUpdating(true);
            setError(null);

            console.log('🔄 Updating weather preferences...');

            const newEnabled = !user.weatherEnabled;
            await api.updateUserPreferences({ weatherEnabled: newEnabled });
            updateUser({ weatherEnabled: newEnabled });

            console.log('✅ Weather preferences updated');
        } catch (error) {
            console.error('Failed to update preferences:', error);
            setError(error instanceof Error ? error.message : 'Failed to update preferences');
        } finally {
            setUpdating(false);
        }
    };

    if (!user) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">Not authenticated</h2>
                <p className="text-gray-600 mt-2">Please sign in to view your dashboard</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="text-red-400">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Welcome back, {user.firstName || 'Athlete'}! 👋
                            </h1>
                        </div>
                    </div>

                    {/* Weather Toggle */}
                    <div className="flex items-center space-x-3">
                        <label className="text-sm font-medium text-gray-700">
                            Weather Updates
                        </label>
                        <button
                            onClick={toggleWeatherEnabled}
                            disabled={updating}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                user.weatherEnabled
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : 'bg-gray-300 hover:bg-gray-400'
                            } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
              <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      user.weatherEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
                        </button>
                    </div>
                </div>
            </div>

            {/* Weather Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Weather Updates</h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${user.weatherEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-700">
              {user.weatherEnabled ? 'Enabled' : 'Disabled'}
            </span>
                    </div>
                    <p className="text-sm text-gray-600">
                        {user.weatherEnabled
                            ? 'New activities will automatically get weather data added'
                            : 'Enable weather updates to start adding weather data to activities'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}