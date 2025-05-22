import { config } from '../config/environment';

// Weather data interfaces
export interface WeatherData {
    temperature: number;
    temperatureFeel: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
    windGust?: number;
    visibility: number;
    cloudCover: number;
    uvIndex?: number;
    description: string;
    icon: string;
    condition: string;
    timestamp: string;
    location: {
        lat: number;
        lon: number;
    };
    source: 'openweather';
}

export interface WeatherApiResponse {
    coord: {
        lon: number;
        lat: number;
    };
    weather: Array<{
        id: number;
        main: string;
        description: string;
        icon: string;
    }>;
    base: string;
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
    };
    visibility: number;
    wind: {
        speed: number;
        deg: number;
        gust?: number;
    };
    clouds: {
        all: number;
    };
    dt: number;
    sys: {
        type: number;
        id: number;
        country: string;
        sunrise: number;
        sunset: number;
    };
    timezone: number;
    id: number;
    name: string;
    cod: number;
}

export interface HistoricalWeatherResponse {
    lat: number;
    lon: number;
    timezone: string;
    timezone_offset: number;
    data: Array<{
        dt: number;
        temp: number;
        feels_like: number;
        pressure: number;
        humidity: number;
        dew_point: number;
        uvi?: number;
        clouds: number;
        visibility: number;
        wind_speed: number;
        wind_deg: number;
        wind_gust?: number;
        weather: Array<{
            id: number;
            main: string;
            description: string;
            icon: string;
        }>;
    }>;
}

/**
 * Weather Service for fetching weather data from OpenWeatherMap API
 */
export class WeatherService {
    private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
    private readonly oneCallUrl = 'https://api.openweathermap.org/data/3.0';
    private readonly apiKey: string;

    constructor() {
        this.apiKey = config.OPENWEATHERMAP_API_KEY;

        if (!this.apiKey) {
            throw new Error('OPENWEATHERMAP_API_KEY is required but not configured');
        }
    }

    /**
     * Get current weather for coordinates
     */
    async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
        try {
            console.log(`🌤️ Fetching current weather for ${lat}, ${lon}`);

            const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=imperial`;

            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenWeather API error (${response.status}): ${errorText}`);
            }

            const data: WeatherApiResponse = await response.json();

            const weatherData = this.transformCurrentWeatherData(data);

            console.log(`✅ Weather data fetched successfully: ${weatherData.temperature}°F, ${weatherData.description}`);

            return weatherData;

        } catch (error) {
            console.error('Failed to fetch current weather:', error);
            throw new Error(`Weather fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get historical weather for a specific timestamp and coordinates
     * Note: Requires OpenWeather One Call API 3.0 subscription for historical data
     */
    async getHistoricalWeather(lat: number, lon: number, timestamp: number): Promise<WeatherData> {
        try {
            console.log(`🕒 Fetching historical weather for ${lat}, ${lon} at ${new Date(timestamp * 1000).toISOString()}`);

            // For historical data, try One Call API 3.0 first
            try {
                const url = `${this.oneCallUrl}/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${this.apiKey}&units=imperial`;

                const response = await fetch(url);

                if (response.ok) {
                    const data: HistoricalWeatherResponse = await response.json();
                    const weatherData = this.transformHistoricalWeatherData(data, lat, lon);

                    console.log(`✅ Historical weather data fetched: ${weatherData.temperature}°F, ${weatherData.description}`);

                    return weatherData;
                } else if (response.status === 401) {
                    console.log('⚠️ One Call API not available, falling back to current weather approximation');
                } else {
                    throw new Error(`Historical weather API error: ${response.status}`);
                }
            } catch (oneCallError) {
                console.log('⚠️ One Call API failed, falling back to current weather:', oneCallError);
            }

            // Fallback: Use current weather if historical is not available
            console.log('📍 Using current weather as approximation for historical data');
            const currentWeather = await this.getCurrentWeather(lat, lon);

            // Update timestamp to requested time
            return {
                ...currentWeather,
                timestamp: new Date(timestamp * 1000).toISOString(),
            };

        } catch (error) {
            console.error('Failed to fetch historical weather:', error);
            throw new Error(`Historical weather fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get weather for activity based on start coordinates and time
     */
    async getWeatherForActivity(
        startLat: number,
        startLon: number,
        startTime: Date,
        activityId: string | number
    ): Promise<WeatherData> {
        try {
            console.log(`🏃 Getting weather for activity ${activityId} at ${startTime.toISOString()}`);

            const timestamp = Math.floor(startTime.getTime() / 1000);
            const now = Math.floor(Date.now() / 1000);
            const hoursSinceActivity = (now - timestamp) / 3600;

            let weatherData: WeatherData;

            if (hoursSinceActivity <= 2) {
                // Activity is very recent, use current weather
                console.log(`📍 Activity is recent (${hoursSinceActivity.toFixed(1)}h ago), using current weather`);
                weatherData = await this.getCurrentWeather(startLat, startLon);
            } else {
                // Activity is older, try historical weather
                console.log(`🕒 Activity is ${hoursSinceActivity.toFixed(1)}h old, fetching historical weather`);
                weatherData = await this.getHistoricalWeather(startLat, startLon, timestamp);
            }

            console.log(`✅ Weather retrieved for activity ${activityId}: ${weatherData.temperature}°F, ${weatherData.description}`);

            return weatherData;

        } catch (error) {
            console.error(`Failed to get weather for activity ${activityId}:`, error);
            throw error;
        }
    }

    /**
     * Transform OpenWeather current weather response to our format
     */
    private transformCurrentWeatherData(data: WeatherApiResponse): WeatherData {
        const weather = data.weather?.[0];

        if (!weather) {
            throw new Error('No weather data found in API response');
        }

        return {
            temperature: Math.round(data.main.temp),
            temperatureFeel: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            pressure: data.main.pressure,
            windSpeed: Math.round(data.wind.speed * 10) / 10, // Round to 1 decimal
            windDirection: data.wind.deg,
            windGust: data.wind.gust ? Math.round(data.wind.gust * 10) / 10 : 0, // Default to 0 instead of undefined
            visibility: Math.round((data.visibility / 1609.34) * 10) / 10, // Convert m to miles, 1 decimal
            cloudCover: data.clouds.all,
            description: weather.description,
            icon: weather.icon,
            condition: weather.main,
            timestamp: new Date(data.dt * 1000).toISOString(),
            location: {
                lat: data.coord.lat,
                lon: data.coord.lon,
            },
            source: 'openweather' as const,
        };
    }

    /**
     * Transform OpenWeather historical weather response to our format
     */
    private transformHistoricalWeatherData(data: HistoricalWeatherResponse, lat: number, lon: number): WeatherData {
        const weatherPoint = data.data?.[0]; // Safe array access

        if (!weatherPoint) {
            throw new Error('No historical weather data found in API response');
        }

        const weather = weatherPoint.weather?.[0];

        if (!weather) {
            throw new Error('No weather details found in historical data');
        }

        return {
            temperature: Math.round(weatherPoint.temp),
            temperatureFeel: Math.round(weatherPoint.feels_like),
            humidity: weatherPoint.humidity,
            pressure: weatherPoint.pressure,
            windSpeed: Math.round(weatherPoint.wind_speed * 10) / 10,
            windDirection: weatherPoint.wind_deg,
            windGust: weatherPoint.wind_gust ? Math.round(weatherPoint.wind_gust * 10) / 10 : 0, // Default to 0
            visibility: Math.round((weatherPoint.visibility / 1609.34) * 10) / 10, // Convert m to miles
            cloudCover: weatherPoint.clouds,
            uvIndex: weatherPoint.uvi ?? 0, // Default to 0 if undefined
            description: weather.description,
            icon: weather.icon,
            condition: weather.main,
            timestamp: new Date(weatherPoint.dt * 1000).toISOString(),
            location: {
                lat,
                lon,
            },
            source: 'openweather' as const,
        };
    }

    /**
     * Format weather data for Strava activity description
     */
    static formatWeatherForStrava(weather: WeatherData): string {
        const tempSymbol = '🌡️';
        const windSymbol = '💨';
        const humiditySymbol = '💧';

        const parts = [
            `${tempSymbol} ${weather.temperature}°F (feels like ${weather.temperatureFeel}°F)`,
            `${windSymbol} ${weather.windSpeed} mph`,
            `${humiditySymbol} ${weather.humidity}%`,
            `☁️ ${weather.description}`,
        ];

        return `\n\n🌤️ Weather:\n${parts.join('\n')}`;
    }

    /**
     * Get weather emoji based on condition
     */
    static getWeatherEmoji(condition: string, icon: string): string {
        const conditionLower = condition.toLowerCase();

        if (conditionLower.includes('clear')) return '☀️';
        if (conditionLower.includes('cloud')) return '☁️';
        if (conditionLower.includes('rain')) return '🌧️';
        if (conditionLower.includes('snow')) return '❄️';
        if (conditionLower.includes('thunder')) return '⛈️';
        if (conditionLower.includes('mist') || conditionLower.includes('fog')) return '🌫️';
        if (conditionLower.includes('drizzle')) return '🌦️';

        // Fallback to icon-based detection
        if (icon.includes('01')) return '☀️'; // clear sky
        if (icon.includes('02')) return '⛅'; // few clouds
        if (icon.includes('03') || icon.includes('04')) return '☁️'; // scattered/broken clouds
        if (icon.includes('09') || icon.includes('10')) return '🌧️'; // rain
        if (icon.includes('11')) return '⛈️'; // thunderstorm
        if (icon.includes('13')) return '❄️'; // snow
        if (icon.includes('50')) return '🌫️'; // mist

        return '🌤️'; // default
    }
}

// Export singleton instance
export const weatherService = new WeatherService();