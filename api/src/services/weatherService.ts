import axios from 'axios';
import { config } from '../config/environment.js';

export interface WeatherData {
    temperature: number;        // Temperature in Celsius
    temperatureFeel: number;    // Feels like temperature in Celsius
    humidity: number;           // Humidity percentage
    pressure: number;           // Atmospheric pressure in hPa
    windSpeed: number;          // Wind speed in m/s
    windDirection: number;      // Wind direction in degrees
    windGust?: number;          // Wind gust speed in m/s (optional)
    cloudCover: number;         // Cloud coverage percentage
    visibility: number;         // Visibility in kilometers
    condition: string;          // Main weather condition (Rain, Clear, etc.)
    description: string;        // Detailed weather description
    icon: string;               // Weather icon code
    uvIndex?: number;           // UV index (optional)
    timestamp: string;          // ISO timestamp of the weather data
}

/**
 * Weather Service using One Call API 3.0
 */
export class WeatherService {
    private weatherCache: Map<string, WeatherData>;
    private cacheExpiryMs: number = 30 * 60 * 1000; // 30 minutes

    constructor() {
        this.weatherCache = new Map();
        setInterval(() => this.cleanupCache(), 15 * 60 * 1000);
    }

    /**
     * Get weather data for a specific activity
     */
    async getWeatherForActivity(
        lat: number,
        lon: number,
        activityTime: Date,
        activityId: string
    ): Promise<WeatherData> {
        const cacheKey = this.getCacheKey(lat, lon, activityTime, activityId);
        const cached = this.weatherCache.get(cacheKey);

        if (cached) {
            console.log(`🎯 Weather cache hit for activity ${activityId}`);
            return cached;
        }

        console.log(`🌤️ Fetching weather for activity ${activityId}`);
        console.log(`📍 Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        console.log(`⏰ Activity time: ${activityTime.toISOString()}`);

        try {
            const now = new Date();
            const timeDiff = now.getTime() - activityTime.getTime();
            const hoursSinceActivity = timeDiff / (1000 * 60 * 60);

            let weatherData: WeatherData;

            if (hoursSinceActivity > 1 && hoursSinceActivity <= 120) { // 1 hour to 5 days ago
                // Use Time Machine for historical data
                console.log(`🕐 Using Time Machine (activity ${hoursSinceActivity.toFixed(1)} hours ago)`);
                weatherData = await this.getHistoricalWeather(lat, lon, activityTime);
            } else if (hoursSinceActivity <= 1) {
                // Use current data from One Call for very recent activities
                console.log(`🔄 Using One Call current data (recent activity)`);
                weatherData = await this.getCurrentWeatherFromOneCall(lat, lon);
            } else {
                // Activity too old for Time Machine, use current as fallback
                console.log(`⚠️ Activity too old for historical data, using current weather`);
                weatherData = await this.getCurrentWeatherFromOneCall(lat, lon);
            }

            // Cache the result
            this.weatherCache.set(cacheKey, weatherData);

            return weatherData;

        } catch (error) {
            console.error('Weather service error:', error);
            throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get current weather using One Call API
     * More accurate than the basic weather endpoint
     */
    private async getCurrentWeatherFromOneCall(lat: number, lon: number): Promise<WeatherData> {
        const url = config.OPENWEATHERMAP_ONECALL_URL;
        const params = {
            lat: lat.toFixed(6),
            lon: lon.toFixed(6),
            appid: config.OPENWEATHERMAP_API_KEY,
            units: 'metric',
            exclude: 'minutely,hourly,daily,alerts' // Only need current data
        };

        console.log(`🎯 Using One Call API for current conditions`);

        const response = await axios.get(url, { params, timeout: 5000 });
        const current = response.data.current;

        return {
            temperature: Math.round(current.temp),
            temperatureFeel: Math.round(current.feels_like),
            humidity: current.humidity,
            pressure: current.pressure,
            windSpeed: Math.round(current.wind_speed * 10) / 10, // 1 decimal place
            windDirection: current.wind_deg,
            windGust: current.wind_gust ? Math.round(current.wind_gust * 10) / 10 : undefined,
            cloudCover: current.clouds,
            visibility: Math.round(current.visibility / 1000), // Convert to km
            condition: current.weather[0].main,
            description: current.weather[0].description,
            icon: current.weather[0].icon,
            uvIndex: current.uvi || 0,
            timestamp: new Date(current.dt * 1000).toISOString(),
        };
    }

    /**
     * Get historical weather using One Call Time Machine
     * For activities 1 hour to 5 days in the past
     */
    private async getHistoricalWeather(lat: number, lon: number, time: Date): Promise<WeatherData> {
        const url = `${config.OPENWEATHERMAP_ONECALL_URL}/timemachine`;
        const dt = Math.floor(time.getTime() / 1000);

        const params = {
            lat: lat.toFixed(6),
            lon: lon.toFixed(6),
            dt: dt.toString(),
            appid: config.OPENWEATHERMAP_API_KEY,
            units: 'metric'
        };

        console.log(`📜 Using Time Machine for ${time.toISOString()}`);

        const response = await axios.get(url, { params, timeout: 5000 });
        const data = response.data.data[0]; // Time Machine returns array with single item

        return {
            temperature: Math.round(data.temp),
            temperatureFeel: Math.round(data.feels_like),
            humidity: data.humidity,
            pressure: data.pressure,
            windSpeed: Math.round(data.wind_speed * 10) / 10, // 1 decimal place
            windDirection: data.wind_deg,
            windGust: data.wind_gust ? Math.round(data.wind_gust * 10) / 10 : undefined,
            cloudCover: data.clouds,
            visibility: Math.round((data.visibility || 10000) / 1000), // Convert to km
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            uvIndex: data.uvi || 0,
            timestamp: new Date(data.dt * 1000).toISOString(),
        };
    }

    /**
     * Generate cache key with high precision
     */
    private getCacheKey(lat: number, lon: number, time: Date, activityId: string): string {
        // Use 4 decimal places for ~11m precision
        const roundedLat = Math.round(lat * 10000) / 10000;
        const roundedLon = Math.round(lon * 10000) / 10000;

        // Round time to nearest 15 minutes
        const quarterHour = new Date(time);
        quarterHour.setMinutes(Math.floor(quarterHour.getMinutes() / 15) * 15, 0, 0);

        return `weather:${roundedLat}:${roundedLon}:${quarterHour.getTime()}:${activityId}`;
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, value] of this.weatherCache.entries()) {
            const cacheTime = new Date(value.timestamp).getTime();
            if (now - cacheTime > this.cacheExpiryMs) {
                this.weatherCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired weather cache entries`);
        }
    }

    /**
     * Clear the cache (useful for testing)
     */
    clearCache(): void {
        this.weatherCache.clear();
        console.log('🧹 Weather cache cleared');
    }
}

export const weatherService = new WeatherService();