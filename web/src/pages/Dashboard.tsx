import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CloudRain, AlertCircle } from 'lucide-react';

export function Dashboard() {
    const { user, updateUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    const toggleWeatherEnabled = async () => {
        if (!user || updating) return;

        try {
            setUpdating(true);
            setError(null);

            const newEnabled = !user.weatherEnabled;
            await api.updateUserPreferences({ weatherEnabled: newEnabled });
            updateUser({ weatherEnabled: newEnabled });
        } catch (error) {
            console.error('Failed to update preferences:', error);
            setError(error instanceof Error ? error.message : 'Failed to update preferences');
        } finally {
            setUpdating(false);
        }
    };

    if (!user) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle>Not Authenticated</CardTitle>
                        <CardDescription>Please sign in to view your dashboard</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const memberSinceDate = new Date(user.memberSince);
    const lastUpdatedDate = new Date(user.lastUpdated);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Welcome Section */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {user.firstName || 'Athlete'}! 👋
                </h1>
                <p className="text-muted-foreground">
                    Manage your weather updates
                </p>
            </div>

            {/* Weather Settings Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <CloudRain className="h-5 w-5" />
                                Weather Updates
                            </CardTitle>
                            <CardDescription>
                                Automatically add weather data to your Strava activities
                            </CardDescription>
                        </div>
                        <Badge variant={user.weatherEnabled ? "default" : "secondary"}>
                            {user.weatherEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Enable Weather Updates</p>
                            <p className="text-sm text-muted-foreground">
                                {user.weatherEnabled
                                    ? 'New activities will automatically get weather data'
                                    : 'Turn on to start adding weather data to activities'
                                }
                            </p>
                        </div>
                        <Switch
                            checked={user.weatherEnabled}
                            onCheckedChange={toggleWeatherEnabled}
                            disabled={updating}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Account Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Information</CardTitle>
                    <CardDescription>Your Strava Weather account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Strava ID</p>
                            <p className="font-medium">{user.stravaAthleteId}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium">{user.location || 'Not set'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Member Since</p>
                            <p className="font-medium">
                                {memberSinceDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Last Updated</p>
                            <p className="font-medium">
                                {lastUpdatedDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}