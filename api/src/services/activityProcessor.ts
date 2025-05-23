import {weatherService, type WeatherData} from './weatherService.js';
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

        return description.includes('°C') ||
            description.includes('Feels like') ||
            description.includes('Humidity') ||
            description.includes('m/s from') ||
            description.includes('🌤️ Weather:') ||
            description.includes('Weather:') ||
            description.includes('°F');
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
     * Create weather-enhanced description for activity
     */
    private createWeatherDescription(activity: ActivityData, weatherData: WeatherData): string {
        const originalDescription = activity.description || '';

        const cleanDescription = originalDescription
            .replace(/\n*[A-Z][^,]+, -?\d+°C, Feels like.*from [NSEW]+[NSEW]*/g, '')
            .replace(/\n*🌤️ Weather:[\s\S]*$/, '')
            .replace(/\n\n+/g, '\n')
            .trim();

        const condition = weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1);

        const weatherLine = [
            condition,
            `${weatherData.temperature}°C`,
            `Feels like ${weatherData.temperatureFeel}°C`,
            `Humidity ${weatherData.humidity}%`,
            `Wind ${weatherData.windSpeed}m/s from ${this.getWindDirectionString(weatherData.windDirection)}`
        ].join(', ');

        if (cleanDescription) {
            return `${cleanDescription}\n\n${weatherLine}`;
        } else {
            return weatherLine;
        }
    }

    /**
     * Convert wind direction degrees to compass direction
     */
    private getWindDirectionString(degrees: number): string {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index] || 'N';
    }
}

export const activityProcessor = new ActivityProcessor();