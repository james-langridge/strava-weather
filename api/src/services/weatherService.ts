// api/src/services/weatherService.ts

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
 * Service for fetching weather data from OpenWeatherMap
 */
export class WeatherService {
    private weatherCache: Map<string, WeatherData>;
    private cacheExpiryMs: number = 30 * 60 * 1000; // 30 minutes

    constructor() {
        this.weatherCache = new Map();

        // Clear expired cache entries every 15 minutes
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

        console.log(`🌤️ Fetching weather for activity ${activityId} at ${lat}, ${lon}`);

        try {
            const now = new Date();
            const timeDiff = now.getTime() - activityTime.getTime();
            const isHistorical = timeDiff > 3 * 60 * 60 * 1000; // More than 3 hours ago

            let weatherData: WeatherData;

            if (isHistorical && timeDiff <= 5 * 24 * 60 * 60 * 1000) {
                // Use One Call Time Machine for historical data (up to 5 days)
                weatherData = await this.getHistoricalWeather(lat, lon, activityTime);
            } else {
                // Use current weather API
                weatherData = await this.getCurrentWeather(lat, lon);
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
     * Get current weather data
     */
    private async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
        const url = `${config.OPENWEATHERMAP_API_BASE_URL}/weather`;
        const params = {
            lat: lat.toString(),
            lon: lon.toString(),
            appid: config.OPENWEATHERMAP_API_KEY,
            units: 'metric'
        };

        const response = await axios.get(url, { params, timeout: 5000 });
        const data = response.data;

        return {
            temperature: Math.round(data.main.temp),
            temperatureFeel: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            pressure: data.main.pressure,
            windSpeed: Math.round(data.wind.speed),
            windDirection: data.wind.deg,
            windGust: data.wind.gust ? Math.round(data.wind.gust) : undefined,
            cloudCover: data.clouds.all,
            visibility: Math.round(data.visibility / 1000),
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            uvIndex: 0, // Not available in current weather API
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get historical weather data using One Call Time Machine API
     */
    private async getHistoricalWeather(lat: number, lon: number, time: Date): Promise<WeatherData> {
        const url = `${config.OPENWEATHERMAP_ONECALL_URL}/timemachine`;
        const dt = Math.floor(time.getTime() / 1000);

        const params = {
            lat: lat.toString(),
            lon: lon.toString(),
            dt: dt.toString(),
            appid: config.OPENWEATHERMAP_API_KEY,
            units: 'metric'
        };

        const response = await axios.get(url, { params, timeout: 5000 });
        const data = response.data;

        // Get the data point closest to the activity time
        const hourlyData = data.hourly || [];
        const targetHour = hourlyData.reduce((closest: any, current: any) => {
            const closestDiff = Math.abs(closest.dt - dt);
            const currentDiff = Math.abs(current.dt - dt);
            return currentDiff < closestDiff ? current : closest;
        }, hourlyData[0] || data.current);

        const weatherPoint = targetHour || data.current;

        return {
            temperature: Math.round(weatherPoint.temp),
            temperatureFeel: Math.round(weatherPoint.feels_like),
            humidity: weatherPoint.humidity,
            pressure: weatherPoint.pressure,
            windSpeed: Math.round(weatherPoint.wind_speed),
            windDirection: weatherPoint.wind_deg,
            windGust: weatherPoint.wind_gust ? Math.round(weatherPoint.wind_gust) : undefined,
            cloudCover: weatherPoint.clouds,
            visibility: Math.round((weatherPoint.visibility || 10000) / 1000),
            condition: weatherPoint.weather[0].main,
            description: weatherPoint.weather[0].description,
            icon: weatherPoint.weather[0].icon,
            uvIndex: weatherPoint.uvi || 0,
            timestamp: new Date(weatherPoint.dt * 1000).toISOString(),
        };
    }

    /**
     * Generate cache key for weather data
     */
    private getCacheKey(lat: number, lon: number, time: Date, activityId: string): string {
        // Round coordinates to 2 decimal places to allow some variance
        const roundedLat = Math.round(lat * 100) / 100;
        const roundedLon = Math.round(lon * 100) / 100;

        // Round time to nearest hour for better cache hits
        const hourTime = new Date(time);
        hourTime.setMinutes(0, 0, 0);

        return `weather:${roundedLat}:${roundedLon}:${hourTime.getTime()}:${activityId}`;
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
     * Get weather emoji based on condition and icon
     * Static method so it can be used elsewhere
     */
    static getWeatherEmoji(condition: string, icon: string): string {
        // Map OpenWeatherMap icons to emojis
        const iconMap: Record<string, string> = {
            '01d': '☀️',  // clear sky day
            '01n': '🌙',  // clear sky night
            '02d': '⛅',  // few clouds day
            '02n': '☁️',  // few clouds night
            '03d': '☁️',  // scattered clouds
            '03n': '☁️',
            '04d': '☁️',  // broken clouds
            '04n': '☁️',
            '09d': '🌧️',  // shower rain
            '09n': '🌧️',
            '10d': '🌦️',  // rain day
            '10n': '🌧️',  // rain night
            '11d': '⛈️',  // thunderstorm
            '11n': '⛈️',
            '13d': '❄️',  // snow
            '13n': '❄️',
            '50d': '🌫️',  // mist
            '50n': '🌫️',
        };

        return iconMap[icon] || '🌤️';
    }

    /**
     * Clear the cache (useful for testing)
     */
    clearCache(): void {
        this.weatherCache.clear();
        console.log('🧹 Weather cache cleared');
    }
}

// Export singleton instance
export const weatherService = new WeatherService();