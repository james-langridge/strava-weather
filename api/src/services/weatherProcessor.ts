import { config } from '../config/environment.js';
import { prisma} from "../lib/index.js";
import axios from "axios";

interface ActivityProcessingData {
    stravaActivityId: string;
    stravaAthleteId: string;
    eventTime: number;
    subscriptionId: number;
}

interface StravaActivity {
    id: string;
    name: string;
    type: string;
    start_date: string;
    start_latlng: [number, number] | null;
    description: string | null;
    private: boolean;
}

interface WeatherData {
    temperature: number;
    temperatureFeel: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    pressure: number;
    visibility: number;
    uvIndex?: number;
}

/**
 * Process weather data for a Strava activity
 * This is called asynchronously after webhook response
 */
export async function processActivityWeather(data: ActivityProcessingData): Promise<void> {
    const startTime = Date.now();

    try {
        console.log(`🌤️ Processing weather for activity ${data.stravaActivityId}`);

        // Step 1: Find user by Strava athlete ID
        const user = await prisma.user.findUnique({
            where: { stravaAthleteId: data.stravaAthleteId },
        });

        if (!user) {
            console.log(`⚠️ User not found for athlete ID ${data.stravaAthleteId}`);
            return;
        }

        if (!user.weatherEnabled) {
            console.log(`⚠️ Weather disabled for user ${user.id}`);
            return;
        }

        // Step 2: Fetch activity details from Strava
        const activity = await fetchStravaActivity(data.stravaActivityId, user.accessToken);

        if (!activity) {
            console.log(`⚠️ Activity ${data.stravaActivityId} not found or inaccessible`);
            return;
        }

        // Step 3: Check if it's an outdoor activity with location
        // if (!isOutdoorActivity(activity.type)) {
        //     console.log(`⚠️ Activity ${activity.id} is not an outdoor activity (${activity.type})`);
        //     return;
        // }

        if (!activity.start_latlng || activity.start_latlng.length !== 2) {
            console.log(`⚠️ Activity ${activity.id} has no GPS coordinates`);
            return;
        }

        // Step 4: Check if weather already added (prevent duplicates)
        if (hasWeatherInDescription(activity.description)) {
            console.log(`⚠️ Weather already added to activity ${activity.id}`);
            return;
        }

        // Step 5: Fetch weather data
        const [lat, lon] = activity.start_latlng;
        const activityDate = new Date(activity.start_date);

        const weatherData = await fetchWeatherData(lat, lon, activityDate);

        if (!weatherData) {
            console.log(`⚠️ Could not fetch weather data for activity ${activity.id}`);
            return;
        }

        // Step 6: Format weather description
        const weatherDescription = formatWeatherDescription(weatherData);

        // Step 7: Update activity description
        const updatedDescription = addWeatherToDescription(activity.description, weatherDescription);

        await updateStravaActivityDescription(activity.id, updatedDescription, user.accessToken);

        const processingTime = Date.now() - startTime;
        console.log(`✅ Weather added to activity ${activity.id} in ${processingTime}ms`);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ Weather processing failed for activity ${data.stravaActivityId} in ${processingTime}ms:`, error);

        // TODO: When we scale, implement retry logic here
        // For now, we just log and move on
    }
}

/**
 * Check if weather already added (prevent duplicates)
 * Updated to check for °C instead of °F
 */
function hasWeatherInDescription(description: string | null): boolean {
    if (!description) return false;
    // Check for temperature patterns with °C or weather keywords
    return description.includes('°C') ||
        description.includes('Feels like') ||
        description.includes('Humidity') ||
        description.includes('m/s from');
}

/**
 * Fetch activity details from Strava API
 */
async function fetchStravaActivity(activityId: string, accessToken: string): Promise<StravaActivity | null> {
    try {
        const response = await fetch(`${config.STRAVA_API_BASE_URL}/activities/${activityId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        });

        if (response.status === 401) {
            // Token expired - should trigger refresh flow
            throw new Error('Strava access token expired');
        }

        if (!response.ok) {
            throw new Error(`Strava API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Failed to fetch Strava activity:', error);
        return null;
    }
}

/**
 * Check if activity type should get weather data
 */
// function isOutdoorActivity(activityType: string): boolean {
//     return config.OUTDOOR_ACTIVITY_TYPES.includes(activityType);
// }

/**
 * Fetch weather data from OpenWeatherMap
 */
async function fetchWeatherData(lat: number, lon: number, date: Date): Promise<WeatherData | null> {
    try {
        const now = new Date();
        const isHistorical = date < new Date(now.getTime() - 5 * 60 * 1000); // More than 5 minutes ago

        let url: string;

        if (isHistorical) {
            // Use historical weather data (limited to last 5 days for free tier)
            const timestamp = Math.floor(date.getTime() / 1000);
            url = `${config.OPENWEATHERMAP_ONECALL_URL}/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${config.OPENWEATHERMAP_API_KEY}&units=metric`;
        } else {
            // Use current weather
            url = `${config.OPENWEATHERMAP_API_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${config.OPENWEATHERMAP_API_KEY}&units=metric`;
        }

        const response = await axios.get(url, {
            timeout: 5000,
        });

        const {data} = response;

        // Parse response based on endpoint
        if (isHistorical) {
            const weather = data.data?.[0];
            if (!weather) return null;

            return {
                temperature: Math.round(weather.temp || 0),
                temperatureFeel: Math.round(weather.feels_like || weather.temp || 0),
                condition: weather.weather?.[0]?.description || 'Unknown',
                humidity: weather.humidity || 0,
                windSpeed: Math.round(weather.wind_speed || 0),
                windDirection: getWindDirection(weather.wind_deg || 0),
                pressure: Math.round(weather.pressure || 0),
                visibility: Math.round((weather.visibility || 0) / 1000),
                uvIndex: weather.uvi,
            };
        } else {
            return {
                temperature: Math.round(data.main?.temp || 0),
                temperatureFeel: Math.round(data.main?.feels_like || data.main?.temp || 0),
                condition: data.weather?.[0]?.description || 'Unknown',
                humidity: data.main?.humidity || 0,
                windSpeed: Math.round(data.wind?.speed || 0),
                windDirection: getWindDirection(data.wind?.deg || 0),
                pressure: Math.round(data.main?.pressure || 0),
                visibility: Math.round((data.visibility || 0) / 1000),
            };
        }

    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        return null;
    }
}

/**
 * Convert wind degree to direction
 */
function getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index] || 'N';
}

/**
 * Format weather data into readable description
 * Format: "Light rain, 10°C, Feels like 10°C, Humidity 91%, Wind 2m/s from WSW"
 */
function formatWeatherDescription(weather: WeatherData): string {
    const condition = weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1);

    const parts = [
        condition,
        `${weather.temperature}°C`,
        `Feels like ${weather.temperatureFeel}°C`,
        `Humidity ${weather.humidity}%`,
        `Wind ${weather.windSpeed}m/s from ${weather.windDirection}`,
    ];

    return parts.join(', ');
}

/**
 * Add weather to existing activity description
 */
function addWeatherToDescription(existingDescription: string | null, weatherDescription: string): string {
    const description = existingDescription?.trim() || '';

    if (description) {
        return `${description}\n\n${weatherDescription}`;
    } else {
        return weatherDescription;
    }
}

/**
 * Update Strava activity description
 */
async function updateStravaActivityDescription(activityId: string, description: string, accessToken: string): Promise<void> {
    try {
        const response = await fetch(`${config.STRAVA_API_BASE_URL}/activities/${activityId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description }),
        });

        if (!response.ok) {
            throw new Error(`Failed to update activity: ${response.status}`);
        }

    } catch (error) {
        console.error('Failed to update Strava activity:', error);
        throw error;
    }
}
