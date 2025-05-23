# Strava Weather Integration

Automatically add weather data to your Strava activities! This app uses webhooks to detect new activities and adds weather information to the activity description.

## Overview

This project consists of two parts:
- **API** (`/api`): Express.js backend handling Strava webhooks, OAuth, and weather data
- **Web** (`/web`): React frontend for user authentication and settings management

## Quick Deploy

This app requires two separate Vercel deployments. Deploy in this order:

### 1. Deploy API
[![Deploy API with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjames-langridge%2Fstrava-weather&env=DATABASE_URL,STRAVA_CLIENT_ID,STRAVA_CLIENT_SECRET,STRAVA_WEBHOOK_VERIFY_TOKEN,OPENWEATHERMAP_API_KEY,JWT_SECRET,ENCRYPTION_KEY,VITE_API_URL,FRONTEND_URL&envDescription=Required%20environment%20variables&envLink=https%3A%2F%2Fgithub.com%2Fjames-langridge%2Fstrava-weather%23environment-variables&project-name=strava-weather-api&repository-name=strava-weather-api&root-directory=api)

### 2. Deploy Web
[![Deploy Web with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjames-langridge%2Fstrava-weather&env=VITE_API_URL&envDescription=URL%20of%20your%20deployed%20API&project-name=strava-weather-web&repository-name=strava-weather-web&root-directory=web)

## Prerequisites

Before deploying, you'll need:
- Vercel account (free tier works)
- Strava API app credentials
- OpenWeatherMap API key (with One Call API 3.0)
- PostgreSQL database (e.g., Neon via Vercel)

## Setup Guide

### 1. Create Required Accounts & API Keys

#### Strava API Application

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Click "Create an App" and fill in:
   - **Application Name**: "Strava Weather"
   - **Authorization Callback Domain**: `your-api-name.vercel.app` (update after deployment)
   - Other fields as appropriate
3. Save your **Client ID** and **Client Secret**

#### OpenWeatherMap API Key

1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Generate an API key from [API Keys page](https://home.openweathermap.org/api_keys)
3. **Important**: Subscribe to "One Call API 3.0" free tier (1000 calls/day)

#### Neon Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Storage
2. Create Database → Select "Neon Serverless Postgres"
3. Copy the `DATABASE_URL` from Quickstart section

### 2. Prepare Environment Variables

You'll need these values ready:

```env
# From Neon
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# From Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=any_random_string

# From OpenWeatherMap
OPENWEATHERMAP_API_KEY=your_api_key

# Generate these (32+ characters each)
JWT_SECRET=generate_long_random_string
ENCRYPTION_KEY=generate_another_long_random_string

# URLs (will update after deployment)
VITE_API_URL=https://your-api.vercel.app
FRONTEND_URL=https://your-web.vercel.app
```

**Generate random strings:**
```bash
openssl rand -base64 32
```

### 3. Deploy with Vercel

#### Step 1: Deploy the API
1. Click the "Deploy API" button above
2. When prompted, enter all environment variables
3. The deployment will automatically:
   - Generate Prisma client
   - Run database migrations
   - Build the TypeScript code
4. Note your API URL after deployment (e.g., `https://strava-weather-api.vercel.app`)

#### Step 2: Deploy the Web App
1. Click the "Deploy Web" button above
2. Set `VITE_API_URL` to your API URL from Step 1
3. Note your Web URL after deployment

#### Step 3: Update Configuration
1. Go to your API project settings in Vercel
2. Update `FRONTEND_URL` to your Web URL
3. Redeploy the API

### 4. Update Strava App Settings

1. Return to [Strava API Settings](https://www.strava.com/settings/api)
2. Edit your app
3. Update **Authorization Callback Domain** to your API domain (without https://)
   - Example: `strava-weather-api.vercel.app`

### 5. Test Your Setup

1. Visit your web app URL
2. Click "Connect to Strava"
3. Authorize the app
4. Create a new Strava activity
5. Weather data should appear in the description within seconds!

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string from Neon | `postgresql://user:pass@host/db?sslmode=require` |
| `STRAVA_CLIENT_ID` | From your Strava app | `123456` |
| `STRAVA_CLIENT_SECRET` | From your Strava app | `abc123...` |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Any random string | `my-webhook-token` |
| `OPENWEATHERMAP_API_KEY` | From OpenWeatherMap | `abc123...` |
| `JWT_SECRET` | Random 32+ char string | `generate-with-openssl` |
| `ENCRYPTION_KEY` | Random 32+ char string | `generate-with-openssl` |
| `VITE_API_URL` | Your deployed API URL | `https://your-api.vercel.app` |
| `FRONTEND_URL` | Your deployed web URL | `https://your-web.vercel.app` |
| `ADMIN_TOKEN` | (Optional) For admin endpoints | `your-admin-token` |

## Local Development

```bash
# Prerequisites
git clone https://github.com/james-langridge/strava-weather.git
cd strava-weather
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Database setup
npm run db:generate
npm run db:migrate

# Run both apps
npm run dev

# Or run separately:
# Terminal 1
cd api && npm run dev

# Terminal 2
cd web && npm run dev
```

For webhook testing locally, use [ngrok](https://ngrok.com/):
```bash
ngrok http 3001
# Use the ngrok URL for webhook setup
```

## Tech Stack

- **API**: Express.js server handling Strava OAuth, webhooks, and weather processing
- **Database**: PostgreSQL (Neon) storing user tokens and preferences
- **Weather**: OpenWeatherMap One Call API 3.0 for accurate weather data
- **Frontend**: React SPA for user management and settings
- **Deployment**: Separate Vercel projects for optimal performance

## Support

If you encounter issues:
1. Check Vercel function logs
2. Review webhook status via admin API
3. Ensure all environment variables are set correctly
4. Open an issue on GitHub with details

Happy running! 🏃‍♂️🌤️