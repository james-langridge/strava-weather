# Strava Weather Integration

Automatically add weather data to your Strava activities! This app uses webhooks to detect new activities and adds weather information to the activity description.

## Overview

This project consists of two parts:
- **API** (`/api`): Express.js backend handling Strava webhooks, OAuth, and weather data
- **Web** (`/web`): React frontend for user authentication and settings management

## Prerequisites

- Node.js 22.11.0+ (LTS)
- npm 10.0.0+
- Vercel account (free tier works)
- Strava account
- OpenWeatherMap account (free tier)

## Setup Guide

### 1. Create a Strava API Application

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Click "Create an App"
3. Fill in the required fields:
    - **Application Name**: "Strava Weather" (or your preferred name)
    - **Category**: Choose appropriate category
    - **Club**: Can be left empty
    - **Website**: Your domain or `https://your-app.vercel.app` (update later)
    - **Application Description**: "Adds weather data to Strava activities"
    - **Authorization Callback Domain**:
        - For local development: `localhost`
        - For production: `your-api-domain.vercel.app`
4. Upload an app icon (optional)
5. Agree to the terms and click "Create"
6. Save your **Client ID** and **Client Secret** - you'll need these later

### 2. Create OpenWeatherMap API Key

1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Go to [API Keys](https://home.openweathermap.org/api_keys)
3. Generate a new API key
4. **Important**: Subscribe to the "One Call API 3.0" (free tier includes 1000 calls/day)
    - Go to [Pricing](https://openweathermap.org/price)
    - Find "One Call API 3.0" and subscribe to the free tier

### 3. Create a Neon Database via Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on "Storage" in the navigation
3. Click "Create Database" → Select "Neon Serverless Postgres"
4. Choose a database name (e.g., "strava-weather-db")
5. Select a region close to you
6. Click "Create"
7. Once created, you'll see your database credentials
8. Copy the `DATABASE_URL` from the "Quickstart" section

### 4. Clone and Configure the Project

```bash
# Clone the repository
git clone https://github.com/james-langridge/strava-weather.git
cd strava-weather

# Install dependencies
npm install

# Copy environment files
cp .env.example .env
```

### 5. Configure Environment Variables

Edit `.env` and fill in all values:

```env
# Database (from Neon/Vercel)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Strava API (from Step 1)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=generate_random_string_here

# OpenWeatherMap (from Step 2)
OPENWEATHERMAP_API_KEY=your_api_key

# Security (generate random 32+ character strings)
JWT_SECRET=generate_long_random_string_here
ENCRYPTION_KEY=generate_another_long_random_string_here

# Node Configuration
NODE_ENV=development
PORT=3001

# URLs (update after deployment)
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
```

**To generate secure random strings:**
```bash
# On macOS/Linux
openssl rand -base64 32

# Or use an online generator
```

### 6. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view database
npm run db:studio
```

### 7. Deploy to Vercel

You'll need to deploy the API and Web apps as **separate Vercel projects**.

#### Deploy API First

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy the API:
   ```bash
   cd api
   vercel
   ```

3. Follow the prompts:
    - Login/signup to Vercel
    - Set up and deploy: **Yes**
    - Which scope: Select your account
    - Link to existing project: **No**
    - Project name: `strava-weather-api` (or your preference)
    - Directory: `./` (current directory)
    - Override settings: **No**

4. Configure environment variables in Vercel:
   ```bash
   # Go to your project settings on vercel.com
   # Or use CLI:
   vercel env add DATABASE_URL
   vercel env add STRAVA_CLIENT_ID
   vercel env add STRAVA_CLIENT_SECRET
   vercel env add STRAVA_WEBHOOK_VERIFY_TOKEN
   vercel env add OPENWEATHERMAP_API_KEY
   vercel env add JWT_SECRET
   vercel env add ENCRYPTION_KEY
   vercel env add FRONTEND_URL  # Set to your web app URL (will update later)
   vercel env add VITE_API_URL  # Set to your API URL (e.g., https://strava-weather-api.vercel.app)
   ```

5. Deploy to production:
   ```bash
   vercel --prod
   ```

6. Note your API URL (e.g., `https://strava-weather-api.vercel.app`)

#### Deploy Web App

1. Navigate to web directory:
   ```bash
   cd ../web
   ```

2. Update `web/vercel.json` with your API URL:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://YOUR-API-URL.vercel.app/api/$1"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

3. Deploy the web app:
   ```bash
   vercel
   ```

4. Follow the prompts:
    - Set up and deploy: **Yes**
    - Link to existing project: **No**
    - Project name: `strava-weather-web` (or your preference)
    - Directory: `./` (current directory)

5. Configure environment variable:
   ```bash
   vercel env add VITE_API_URL  # Your API URL from above
   ```

6. Deploy to production:
   ```bash
   vercel --prod
   ```

7. Note your web app URL (e.g., `https://strava-weather-web.vercel.app`)

### 8. Update Environment Variables

Now that both apps are deployed, update the environment variables:

1. **In the API project**, update `FRONTEND_URL`:
   ```bash
   cd ../api
   vercel env add FRONTEND_URL  # Your web app URL
   vercel --prod  # Redeploy
   ```

2. **Update Strava App Settings**:
    - Go back to [Strava API Settings](https://www.strava.com/settings/api)
    - Edit your app
    - Update **Authorization Callback Domain** to your API domain (without https://)
        - Example: `strava-weather-api.vercel.app`

### 9. Set Up Strava Webhooks

Webhooks allow the app to automatically process new activities.

#### Option 1: Automatic Setup (Recommended)

The API will attempt to set up webhooks automatically on startup if `VITE_API_URL` is configured.

#### Option 2: Manual Setup via Admin API

1. First, add an admin token to your API environment:
   ```bash
   vercel env add ADMIN_TOKEN  # Create a secure token
   vercel --prod  # Redeploy
   ```

2. Use the admin endpoint to create webhook subscription:
   ```bash
   curl -X POST https://your-api-url.vercel.app/api/admin/webhook/setup \
     -H "X-Admin-Token: your_admin_token"
   ```

#### Option 3: Using the Setup Script

1. Clone the repo locally (if not already)
2. Set up `.env` with your production values
3. Run:
   ```bash
   cd api
   npm run webhook:setup -- --url https://your-api-url.vercel.app
   ```

### 10. Test Your Setup

1. Visit your web app URL
2. Click "Connect to Strava"
3. Authorize the app on Strava
4. You should be redirected to the dashboard
5. Create a new Strava activity (or upload one)
6. Within a few seconds, weather data should be added to the activity description!

## Troubleshooting

### Webhook Issues

Check webhook status:
```bash
# Using admin API
curl https://your-api-url.vercel.app/api/admin/webhook/status \
  -H "X-Admin-Token: your_admin_token"

# Or using script
cd api
npm run webhook:status
```

View Vercel function logs:
1. Go to your API project on Vercel
2. Click "Functions" tab
3. Click on "api/index"
4. View real-time logs

### Common Issues

1. **"No webhook subscription found"**
    - Make sure `VITE_API_URL` is set correctly in your API environment
    - Try manual webhook setup (see above)

2. **OAuth redirect fails**
    - Check that `FRONTEND_URL` in API matches your web app URL
    - Verify Strava callback domain matches API domain

3. **Weather data not appearing**
    - Check Vercel function logs for errors
    - Ensure OpenWeatherMap API key is valid and One Call API 3.0 is enabled
    - Verify the activity has GPS coordinates

4. **Database connection errors**
    - Ensure `DATABASE_URL` includes `?sslmode=require`
    - Check that your Neon database is active

## Local Development

For local development with both frontend and backend:

```bash
# Terminal 1 - Run API
cd api
npm run dev

# Terminal 2 - Run Web
cd web
npm run dev
```

For webhook testing locally, use [ngrok](https://ngrok.com/):
```bash
ngrok http 3001
# Use the ngrok URL for webhook setup
```

## Architecture

- **API**: Express.js server handling Strava OAuth, webhooks, and weather processing
- **Database**: PostgreSQL (Neon) storing user tokens and preferences
- **Weather**: OpenWeatherMap One Call API 3.0 for accurate weather data
- **Frontend**: React SPA for user management and settings
- **Deployment**: Separate Vercel projects for optimal performance

## Security Notes

- User tokens are encrypted before database storage
- JWT tokens used for session management
- Webhook signatures validated (when enabled)
- All sensitive operations require authentication

## Support

If you encounter issues:
1. Check Vercel function logs
2. Review webhook status via admin API
3. Ensure all environment variables are set correctly
4. Open an issue on GitHub with details

Happy running! 🏃‍♂️🌤️