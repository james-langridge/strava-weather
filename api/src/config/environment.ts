import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenvConfig({
    path: path.resolve(process.cwd(), process.cwd().endsWith('/api') ? '../.env' : '.env')
});

// Environment validation schema
const environmentSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3001'),

    // Frontend URL
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),

    // Database
    DATABASE_URL: z.string().url(),

    // Strava API
    STRAVA_CLIENT_ID: z.string().min(1),
    STRAVA_CLIENT_SECRET: z.string().min(1),
    STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().min(1),

    // OpenWeatherMap API
    OPENWEATHERMAP_API_KEY: z.string().min(1),

    // JWT Secret for session tokens
    JWT_SECRET: z.string().min(32),

    // Encryption key for storing sensitive data
    ENCRYPTION_KEY: z.string().min(32),
});

// Parse and validate environment variables
const parseResult = environmentSchema.safeParse(process.env);

if (!parseResult.success) {
    console.error('❌ Invalid environment variables:');
    parseResult.error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
}

export const config = {
    ...parseResult.data,

    // Computed values
    isDevelopment: parseResult.data.NODE_ENV === 'development',
    isProduction: parseResult.data.NODE_ENV === 'production',
    isTest: parseResult.data.NODE_ENV === 'test',

    // Strava OAuth URLs
    STRAVA_OAUTH_URL: 'https://www.strava.com/oauth/authorize',
    STRAVA_TOKEN_URL: 'https://www.strava.com/oauth/token',
    STRAVA_API_BASE_URL: 'https://www.strava.com/api/v3',

    // OpenWeatherMap URLs
    OPENWEATHERMAP_API_BASE_URL: 'https://api.openweathermap.org/data/2.5',
    OPENWEATHERMAP_ONECALL_URL: 'https://api.openweathermap.org/data/3.0/onecall',

    // Rate limiting
    STRAVA_RATE_LIMITS: {
        requests_per_15_minutes: 100,
        requests_per_day: 1000,
    },

    // Background processing
    ASYNC_PROCESSING: {
        timeout: 30000, // 30 seconds max for weather processing
        retries: 3, // Retry failed attempts 3 times
    },

    // Security
    SESSION_COOKIE_NAME: 'strava-weather-session',
    SESSION_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days

    // Weather processing
    WEATHER_CACHE_TTL: 15 * 60, // 15 minutes
    OUTDOOR_ACTIVITY_TYPES: [
        'Run',
        'Ride',
        'Walk',
        'Hike',
        'AlpineSki',
        'BackcountrySki',
        'Canoeing',
        'Crossfit',
        'EBikeRide',
        'Kayaking',
        'Kitesurf',
        'MountainBikeRide',
        'NordicSki',
        'RockClimbing',
        'RollerSki',
        'Rowing',
        'Sailing',
        'Skateboard',
        'Snowboard',
        'Snowshoe',
        'StandUpPaddling',
        'Surfing',
        'Swim',
        'TrailRun',
        'Windsurf',
    ],
} as const;

// Type export for use in other files
export type Config = typeof config;