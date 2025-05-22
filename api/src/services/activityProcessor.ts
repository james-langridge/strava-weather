import {weatherService, type WeatherData, WeatherService} from './weatherService.js';
import { stravaApiService } from './stravaApi.js';
import { prisma } from '../lib/index.js';

export interface ProcessingResult {
    success: boolean;
    activityId: string;
    weatherData?: WeatherData;
    error?: string;
    skipped?: boolean;
    reason?: string;
}

export interface ActivityData {
    id: string | number;
    name: string;
    start_date: string;
    start_latlng: [number, number] | null;
    location_city?: string;
    location_state?: string;
    location_country?: string;
    description?: string;
    type: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
}

/**
 * Service for processing Strava activities and adding weather data
 */
export class ActivityProcessor {

    /**
     * Check if activity already has weather data by examining description
     */
    private hasWeatherData(description?: string): boolean {
        if (!description) return false;

        // Check for weather indicators in description
        return description.includes('🌤️ Weather:') ||
            description.includes('Weather:') ||
            description.includes('°F') ||
            description.includes('°C');
    }

    /**
     * Process a single activity and add weather data
     */
    async processActivity(
        activityId: string,
        userId: string,
        forceUpdate: boolean = false
    ): Promise<ProcessingResult> {
        const startTime: number = Date.now();
        const log = (step: string, data?: any): void => {
            console.log(`[${Date.now() - startTime}ms] ${step}`, data || '');
        };

        try {
            log(`🔄 START processing activity ${activityId} for user ${userId}`);

            // Get user's Strava tokens
            log('📊 Fetching user from database...');
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    accessToken: true,
                    refreshToken: true,
                    tokenExpiresAt: true,
                    weatherEnabled: true,
                    firstName: true,
                    lastName: true,
                },
            });

            if (!user) {
                log('❌ User not found');
                throw new Error('User not found');
            }

            log(`✅ User found: ${user.firstName} ${user.lastName}`);

            if (!user.weatherEnabled) {
                log('⚠️ Weather updates disabled');
                return {
                    success: false,
                    activityId,
                    skipped: true,
                    reason: 'Weather updates disabled',
                };
            }

            // Check if token needs refresh
            log('🔑 Checking token validity...');
            const tokenData = await stravaApiService.ensureValidToken(
                user.accessToken,
                user.refreshToken,
                user.tokenExpiresAt
            );
            log(`✅ Token ${tokenData.wasRefreshed ? 'was refreshed' : 'is valid'}`);

            // Update tokens if refreshed
            if (tokenData.wasRefreshed) {
                log('💾 Saving refreshed tokens...');
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        accessToken: tokenData.accessToken,
                        refreshToken: tokenData.refreshToken,
                        tokenExpiresAt: tokenData.expiresAt,
                        updatedAt: new Date(),
                    },
                });
                log('✅ Tokens updated in database');
            }

            // Get activity from Strava
            log(`🏃 Fetching activity ${activityId} from Strava...`);
            const activity = await stravaApiService.getActivity(activityId, tokenData.accessToken);
            log(`✅ Activity retrieved: "${activity.name}" (${activity.type})`);

            if (!activity) {
                log('❌ Activity not found on Strava');
                throw new Error('Activity not found on Strava');
            }

            // Check if already has weather
            if (!forceUpdate && this.hasWeatherData(activity.description)) {
                log('⏭️ Activity already has weather data');
                return {
                    success: true,
                    activityId,
                    skipped: true,
                    reason: 'Already has weather data',
                };
            }

            // Check GPS coordinates
            if (!activity.start_latlng || activity.start_latlng.length !== 2) {
                log('📍 No GPS coordinates found');
                return {
                    success: false,
                    activityId,
                    skipped: true,
                    reason: 'No GPS coordinates',
                };
            }

            const [lat, lon] = activity.start_latlng;
            const activityStartTime = new Date(activity.start_date);
            log(`📍 GPS: ${lat}, ${lon} at ${activityStartTime.toISOString()}`);

            // Get weather data
            log('🌤️ Fetching weather data...');
            const weatherData = await weatherService.getWeatherForActivity(lat, lon, activityStartTime, activityId);
            log(`✅ Weather: ${weatherData.temperature}°F, ${weatherData.description}`);

            // Create updated description
            log('📝 Creating weather description...');
            const updatedDescription = this.createWeatherDescription(activity, weatherData);
            log(`✅ Description created (${updatedDescription.length} chars)`);

            // Update activity on Strava
            log('📤 Updating activity on Strava...');
            await stravaApiService.updateActivity(activityId, tokenData.accessToken, {
                description: updatedDescription,
            });
            log('✅ Activity updated successfully!');

            const totalTime: number = Date.now() - startTime;
            log(`✅ COMPLETE in ${totalTime}ms`);

            return {
                success: true,
                activityId,
                weatherData,
            };

        } catch (error) {
            const totalTime: number = Date.now() - startTime;
            console.error(`❌ FAILED after ${totalTime}ms:`, {
                activityId,
                userId,
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                } : error,
            });

            return {
                success: false,
                activityId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Process multiple activities in batch
     */
    async processActivitiesBatch(
        activityIds: string[],
        userId: string,
        forceUpdate: boolean = false
    ): Promise<ProcessingResult[]> {
        console.log(`🔄 Processing ${activityIds.length} activities for user ${userId}`);

        const results: ProcessingResult[] = [];

        // Process activities sequentially to avoid rate limits
        for (const activityId of activityIds) {
            try {
                const result = await this.processActivity(activityId, userId, forceUpdate);
                results.push(result);

                // Small delay to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Failed to process activity ${activityId}:`, error);
                results.push({
                    success: false,
                    activityId,
                    error: error instanceof Error ? error.message : 'Batch processing error',
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const skippedCount = results.filter(r => r.skipped).length;
        const failedCount = results.filter(r => !r.success && !r.skipped).length;

        console.log(`📊 Batch processing complete: ${successCount} successful, ${skippedCount} skipped, ${failedCount} failed`);

        return results;
    }

    /**
     * Process all recent activities for a user
     */
    async processRecentActivities(userId: string, daysSince: number = 30): Promise<ProcessingResult[]> {
        try {
            console.log(`🔄 Processing recent activities (${daysSince} days) for user ${userId}`);

            // Get user's Strava tokens
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    accessToken: true,
                    refreshToken: true,
                    tokenExpiresAt: true,
                    weatherEnabled: true,
                },
            });

            if (!user || !user.weatherEnabled) {
                console.log(`⚠️ User ${userId} not found or weather disabled`);
                return [];
            }

            // Get recent activities from Strava (refresh token first)
            const tokenData = await stravaApiService.ensureValidToken(
                user.accessToken,
                user.refreshToken,
                user.tokenExpiresAt
            );

            // Update tokens in database if they were refreshed
            if (tokenData.wasRefreshed) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        accessToken: tokenData.accessToken,
                        refreshToken: tokenData.refreshToken,
                        tokenExpiresAt: tokenData.expiresAt,
                        updatedAt: new Date(),
                    },
                });
                console.log(`🔄 Refreshed tokens for user ${userId}`);
            }

            const sinceTimestamp = Math.floor((Date.now() - (daysSince * 24 * 60 * 60 * 1000)) / 1000);
            const activities = await stravaApiService.getActivities(tokenData.accessToken, sinceTimestamp);

            if (!activities || activities.length === 0) {
                console.log(`📭 No recent activities found for user ${userId}`);
                return [];
            }

            console.log(`📋 Found ${activities.length} recent activities to process`);

            const activityIds = activities.map(activity => activity.id.toString());
            return await this.processActivitiesBatch(activityIds, userId);

        } catch (error) {
            console.error(`Failed to process recent activities for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Create weather-enhanced description for activity
     */
    private createWeatherDescription(activity: ActivityData, weatherData: WeatherData): string {
        const originalDescription = activity.description || '';

        // Remove any existing weather data (in case we're updating)
        const cleanDescription = originalDescription.replace(/\n*🌤️ Weather:[\s\S]*$/, '').trim();

        // Create weather section
        const weatherEmoji = WeatherService.getWeatherEmoji(weatherData.condition, weatherData.icon);

        const weatherSection = [
            '',
            '🌤️ Weather:',
            `${weatherEmoji} ${weatherData.description}`,
            `🌡️ ${weatherData.temperature}°F (feels like ${weatherData.temperatureFeel}°F)`,
            `💨 Wind: ${weatherData.windSpeed} mph`,
            `💧 Humidity: ${weatherData.humidity}%`,
            `☁️ Clouds: ${weatherData.cloudCover}%`,
        ];

        if (weatherData.windGust && weatherData.windGust > weatherData.windSpeed + 5) {
            weatherSection.splice(-3, 0, `💨 Gusts: ${weatherData.windGust} mph`);
        }

        if (weatherData.uvIndex && weatherData.uvIndex > 0) {
            weatherSection.push(`☀️ UV Index: ${weatherData.uvIndex}`);
        }

        // Add timestamp for reference
        const weatherTime = new Date(weatherData.timestamp);
        weatherSection.push(`📅 ${weatherTime.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })}`);

        // Combine original description with weather data
        return cleanDescription + '\n' + weatherSection.join('\n');
    }

    /**
     * Get basic user statistics (no database logging required)
     * Returns statistics based on Strava API data
     */
    async getUserActivityStats(userId: string, daysSince: number = 30): Promise<{
        activitiesFound: number;
        activitiesWithWeather: number;
        activitiesWithoutWeather: number;
        weatherCoverage: number;
    }> {
        try {
            // Get user's Strava tokens
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    accessToken: true,
                    refreshToken: true,
                    tokenExpiresAt: true,
                    weatherEnabled: true,
                },
            });

            if (!user || !user.weatherEnabled) {
                return {
                    activitiesFound: 0,
                    activitiesWithWeather: 0,
                    activitiesWithoutWeather: 0,
                    weatherCoverage: 0,
                };
            }

            // Get recent activities from Strava
            const tokenData = await stravaApiService.ensureValidToken(
                user.accessToken,
                user.refreshToken,
                user.tokenExpiresAt
            );

            const sinceTimestamp = Math.floor((Date.now() - (daysSince * 24 * 60 * 60 * 1000)) / 1000);
            const activities = await stravaApiService.getActivities(tokenData.accessToken, sinceTimestamp);

            if (!activities || activities.length === 0) {
                return {
                    activitiesFound: 0,
                    activitiesWithWeather: 0,
                    activitiesWithoutWeather: 0,
                    weatherCoverage: 0,
                };
            }

            // Count activities with weather data by checking descriptions
            let activitiesWithWeather = 0;
            for (const activity of activities) {
                const fullActivity = await stravaApiService.getActivity(activity.id.toString(), tokenData.accessToken);
                if (fullActivity && this.hasWeatherData(fullActivity.description)) {
                    activitiesWithWeather++;
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const activitiesWithoutWeather = activities.length - activitiesWithWeather;
            const weatherCoverage = activities.length > 0 ? (activitiesWithWeather / activities.length) * 100 : 0;

            return {
                activitiesFound: activities.length,
                activitiesWithWeather,
                activitiesWithoutWeather,
                weatherCoverage: Math.round(weatherCoverage * 100) / 100,
            };

        } catch (error) {
            console.error(`Failed to get user activity stats for ${userId}:`, error);
            return {
                activitiesFound: 0,
                activitiesWithWeather: 0,
                activitiesWithoutWeather: 0,
                weatherCoverage: 0,
            };
        }
    }
}

// Export singleton instance
export const activityProcessor = new ActivityProcessor();