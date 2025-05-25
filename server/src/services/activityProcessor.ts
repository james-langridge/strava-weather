import { weatherService, type WeatherData } from './weatherService';
import { stravaApiService } from './stravaApi';
import { prisma } from '../lib';
import { createServiceLogger } from '../utils/logger';

/**
 * Activity processing result interface
 */
export interface ProcessingResult {
    success: boolean;
    activityId: string;
    weatherData?: WeatherData;
    error?: string;
    skipped?: boolean;
    reason?: string;
}

/**
 * Strava activity data interface
 */
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

const logger = createServiceLogger('ActivityProcessor');

/**
 * Weather data patterns for detection
 */
const WEATHER_PATTERNS = [
    /°C/,
    /°F/,
    /Feels like/,
    /Humidity/,
    /m\/s from/,
    /🌤️ Weather:/,
    /Weather:/,
];

/**
 * Wind direction compass points
 */
const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;

/**
 * Activity processor service
 *
 * Handles the processing of Strava activities to enrich them with weather data.
 * Manages token refresh, activity retrieval, weather fetching, and description updates.
 */
export class ActivityProcessor {
    /**
     * Process a single activity and add weather data
     *
     * @param activityId - Strava activity ID to process
     * @param userId - Internal user ID for token access
     * @param forceUpdate - Force update even if weather data exists
     * @returns Processing result with success status and any weather data
     */
    async processActivity(
        activityId: string,
        userId: string,
        forceUpdate: boolean = false
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const logContext = {
            activityId,
            userId,
            forceUpdate,
        };

        logger.info('Starting activity processing', logContext);

        try {
            // Fetch user with encrypted tokens
            logger.debug('Fetching user from database', logContext);

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    accessToken: true,  // Encrypted
                    refreshToken: true, // Encrypted
                    tokenExpiresAt: true,
                    weatherEnabled: true,
                    firstName: true,
                    lastName: true,
                },
            });

            if (!user) {
                logger.error('User not found', logContext);
                return {
                    success: false,
                    activityId,
                    error: 'User not found',
                };
            }

            logger.debug('User retrieved', {
                ...logContext,
                userName: `${user.firstName} ${user.lastName}`,
                weatherEnabled: user.weatherEnabled,
            });

            // Check if weather updates are enabled
            if (!user.weatherEnabled) {
                logger.info('Weather updates disabled for user', logContext);
                return {
                    success: false,
                    activityId,
                    skipped: true,
                    reason: 'Weather updates disabled',
                };
            }

            // Ensure valid Strava token
            logger.debug('Validating Strava access token', logContext);

            const tokenData = await stravaApiService.ensureValidToken(
                user.accessToken,  // Encrypted
                user.refreshToken, // Encrypted
                user.tokenExpiresAt
            );

            logger.debug('Token validation complete', {
                ...logContext,
                wasRefreshed: tokenData.wasRefreshed,
            });

            // Update tokens if refreshed
            if (tokenData.wasRefreshed) {
                logger.info('Updating refreshed tokens', logContext);

                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        accessToken: tokenData.accessToken,   // Encrypted
                        refreshToken: tokenData.refreshToken, // Encrypted
                        tokenExpiresAt: tokenData.expiresAt,
                        updatedAt: new Date(),
                    },
                });

                logger.debug('Tokens updated in database', logContext);
            }

            // Retrieve activity from Strava
            logger.debug('Fetching activity from Strava', logContext);

            const activity = await stravaApiService.getActivity(activityId, tokenData.accessToken);

            if (!activity) {
                logger.warn('Activity not found on Strava', logContext);
                return {
                    success: false,
                    activityId,
                    error: 'Activity not found on Strava',
                };
            }

            logger.info('Activity retrieved', {
                ...logContext,
                activityName: activity.name,
                activityType: activity.type,
                hasDescription: !!activity.description,
                hasCoordinates: !!activity.start_latlng,
            });

            // Check if activity already has weather data
            if (!forceUpdate && this.hasWeatherData(activity.description)) {
                logger.info('Activity already contains weather data', logContext);
                return {
                    success: true,
                    activityId,
                    skipped: true,
                    reason: 'Already has weather data',
                };
            }

            // Validate GPS coordinates
            if (!activity.start_latlng || activity.start_latlng.length !== 2) {
                logger.info('Activity missing GPS coordinates', logContext);
                return {
                    success: false,
                    activityId,
                    skipped: true,
                    reason: 'No GPS coordinates',
                };
            }

            const [lat, lon] = activity.start_latlng;
            const activityStartTime = new Date(activity.start_date);

            logger.debug('Activity location data', {
                ...logContext,
                latitude: lat,
                longitude: lon,
                startTime: activityStartTime.toISOString(),
            });

            // Fetch weather data
            logger.debug('Fetching weather data', {
                ...logContext,
                coordinates: { lat, lon },
            });

            const weatherData = await weatherService.getWeatherForActivity(
                lat,
                lon,
                activityStartTime,
                activityId
            );

            logger.info('Weather data retrieved', {
                ...logContext,
                temperature: weatherData.temperature,
                description: weatherData.description,
                humidity: weatherData.humidity,
                windSpeed: weatherData.windSpeed,
            });

            // Create updated description
            const updatedDescription = this.createWeatherDescription(activity, weatherData);

            logger.debug('Weather description created', {
                ...logContext,
                descriptionLength: updatedDescription.length,
                originalLength: activity.description?.length || 0,
            });

            // Update activity on Strava
            logger.debug('Updating activity on Strava', logContext);

            await stravaApiService.updateActivity(activityId, tokenData.accessToken, {
                description: updatedDescription,
            });

            const processingTime = Date.now() - startTime;

            logger.info('Activity processing completed successfully', {
                ...logContext,
                processingTimeMs: processingTime,
                weatherData: {
                    temperature: weatherData.temperature,
                    description: weatherData.description,
                },
            });

            return {
                success: true,
                activityId,
                weatherData,
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            logger.error('Activity processing failed', {
                ...logContext,
                processingTimeMs: processingTime,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });

            return {
                success: false,
                activityId,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Check if activity description already contains weather data
     *
     * @param description - Activity description to check
     * @returns True if weather data is detected
     */
    private hasWeatherData(description?: string): boolean {
        if (!description) return false;

        return WEATHER_PATTERNS.some(pattern => pattern.test(description));
    }

    /**
     * Create weather-enhanced description for activity
     *
     * @param activity - Original activity data
     * @param weatherData - Weather data to append
     * @returns Updated description with weather information
     */
    private createWeatherDescription(activity: ActivityData, weatherData: WeatherData): string {
        const originalDescription = activity.description || '';

        // Remove existing weather data using regex patterns
        const cleanDescription = this.removeExistingWeatherData(originalDescription);

        // Format weather conditions
        const condition = this.capitalizeFirst(weatherData.description);

        // Build weather line
        const weatherLine = this.formatWeatherLine(condition, weatherData);

        // Combine descriptions
        if (cleanDescription) {
            return `${cleanDescription}\n\n${weatherLine}`;
        }

        return weatherLine;
    }

    /**
     * Remove existing weather data from description
     *
     * @param description - Original description
     * @returns Cleaned description without weather data
     */
    private removeExistingWeatherData(description: string): string {
        return description
            // Remove standard weather format
            .replace(/\n*[A-Z][^,]+, -?\d+°[CF], Feels like.*from [NSEW]+[NSEW]*/g, '')
            // Remove emoji weather format
            .replace(/\n*🌤️ Weather:[\s\S]*$/, '')
            // Clean up multiple line breaks
            .replace(/\n\n+/g, '\n')
            .trim();
    }

    /**
     * Format weather data into a single line
     *
     * @param condition - Weather condition description
     * @param weatherData - Weather data object
     * @returns Formatted weather line
     */
    private formatWeatherLine(condition: string, weatherData: WeatherData): string {
        const parts = [
            condition,
            `${weatherData.temperature}°C`,
            `Feels like ${weatherData.temperatureFeel}°C`,
            `Humidity ${weatherData.humidity}%`,
            `Wind ${weatherData.windSpeed}m/s from ${this.getWindDirectionString(weatherData.windDirection)}`,
        ];

        return parts.join(', ');
    }

    /**
     * Convert wind direction degrees to compass direction
     *
     * @param degrees - Wind direction in degrees (0-360)
     * @returns Compass direction string (e.g., "NE", "SW")
     */
    private getWindDirectionString(degrees: number): string {
        const index = Math.round(degrees / 22.5) % 16;
        return WIND_DIRECTIONS[index] || 'N';
    }

    /**
     * Capitalize first letter of string
     *
     * @param str - String to capitalize
     * @returns Capitalized string
     */
    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Export singleton instance
export const activityProcessor = new ActivityProcessor();