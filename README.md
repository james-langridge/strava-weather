# Strava Weather Integration

Automatically add weather data to your Strava activities! This app uses webhooks to detect new activities and adds weather information to the activity description.

## Overview

This is a full-stack application that automatically adds weather data to your Strava activities:
- **Backend**: Express.js API handling Strava OAuth, webhooks, and weather data
- **Frontend**: React SPA for user authentication and settings management
- **Deployment**: Single Vercel deployment serving both frontend and API

## Quick Deploy

Deploy the entire app with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjames-langridge%2Fstrava-weather&env=DATABASE_URL,STRAVA_CLIENT_ID,STRAVA_CLIENT_SECRET,STRAVA_WEBHOOK_VERIFY_TOKEN,OPENWEATHERMAP_API_KEY,JWT_SECRET,VITE_API_URL,FRONTEND_URL&envDescription=Required%20environment%20variables&envLink=https%3A%2F%2Fgithub.com%2Fjames-langridge%2Fstrava-weather%23environment-variables&project-name=strava-weather&repository-name=strava-weather)

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
   - **Authorization Callback Domain**: `your-app-name.vercel.app` (update after deployment)
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

### 2. Deploy to Vercel

1. Click the "Deploy with Vercel" button above
2. Fill in the environment variables:

```env
# Database (from Neon)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Strava API (from your Strava app)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=any_random_string_you_choose

# OpenWeatherMap
OPENWEATHERMAP_API_KEY=your_api_key

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=generate_long_random_string_32_chars

# URLs (use your Vercel app URL)
VITE_API_URL=https://your-app-name.vercel.app
FRONTEND_URL=https://your-app-name.vercel.app
```

3. Click "Deploy" and wait for the build to complete
4. Note your deployed URL (e.g., `https://strava-weather.vercel.app`)

### 3. Update Strava App Settings

1. Return to [Strava API Settings](https://www.strava.com/settings/api)
2. Edit your app
3. Update **Authorization Callback Domain** to your Vercel domain (without https://)
   - Example: `strava-weather.vercel.app`

### 4. Test Your Setup

1. Visit your deployed app URL
2. Click "Connect to Strava"
3. Authorize the app
4. Create a new Strava activity
5. Weather data should appear in the description within seconds!

## Features

- 🔐 **Secure OAuth2 Authentication** - Connect safely with Strava
- 🌤️ **Automatic Weather Data** - Adds weather to new activities via webhooks
- 📍 **Accurate Location Data** - Uses activity GPS coordinates
- ⏰ **Historical Weather** - Fetches weather for activities up to 5 days old
- 🎛️ **User Control** - Toggle weather updates on/off
- 🍪 **Secure Sessions** - HTTP-only cookies for authentication

## How It Works

1. User connects their Strava account via OAuth
2. App registers for Strava webhook events
3. When user creates a new activity, Strava sends a webhook
4. App fetches the activity details and GPS coordinates
5. Weather data is retrieved for that time and location
6. Activity description is updated with weather information

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `STRAVA_CLIENT_ID` | From your Strava app | ✅ |
| `STRAVA_CLIENT_SECRET` | From your Strava app | ✅ |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random string for webhook security | ✅ |
| `OPENWEATHERMAP_API_KEY` | From OpenWeatherMap | ✅ |
| `JWT_SECRET` | Random 32+ character string | ✅ |
| `VITE_API_URL` | Your Vercel app URL | ✅ |
| `FRONTEND_URL` | Your Vercel app URL | ✅ |
| `ADMIN_TOKEN` | For admin endpoints (optional) | ➖ |

## Local Development

```bash
# Clone the repository
git clone https://github.com/james-langridge/strava-weather.git
cd strava-weather

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Database setup
npm run db:generate
npm run db:migrate

# Run development servers
npm run dev

# Or run separately:
npm run dev:server  # Backend on http://localhost:3001
npm run dev:web     # Frontend on http://localhost:5173
```

### Webhook Testing Locally

For local webhook testing, use [ngrok](https://ngrok.com/):

```bash
# Start ngrok tunnel
ngrok http 3001

# Use the ngrok URL for VITE_API_URL and webhook setup
```

## Project Structure

```
strava-weather/
├── server/              # Express.js backend
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── middleware/  # Express middleware
│   └── prisma/          # Database schema
├── web/                 # React frontend
│   └── src/
│       ├── pages/       # Route components
│       ├── components/  # UI components
│       └── contexts/    # React contexts
├── api/                 # Vercel serverless function
│   └── index.js         # Exports Express app
└── vercel.json          # Vercel configuration
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/auth/strava` - Initiate OAuth flow
- `GET /api/auth/strava/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/check` - Check authentication
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update user preferences
- `POST /api/strava/webhook` - Webhook endpoint

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, TypeScript, Prisma
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT with HTTP-only cookies
- **Weather API**: OpenWeatherMap One Call API 3.0
- **Deployment**: Vercel (serverless functions + static hosting)

## Troubleshooting

### Webhook Issues
- Check Vercel function logs for webhook events
- Verify webhook is registered: `GET /api/admin/webhook/status`
- Ensure `STRAVA_WEBHOOK_VERIFY_TOKEN` matches

### Authentication Issues
- Clear browser cookies and try again
- Check that `JWT_SECRET` is set correctly
- Verify Strava callback domain matches your Vercel URL

### Weather Not Appearing
- Confirm activity has GPS coordinates
- Check OpenWeatherMap API quota
- Verify user has weather updates enabled

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

## Support

If you encounter issues:
1. Check [Vercel function logs](https://vercel.com/docs/functions/logs)
2. Review the [GitHub issues](https://github.com/james-langridge/strava-weather/issues)
3. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details

---

Built by [James Langridge](https://github.com/james-langridge)

Happy running! 🏃‍♂️🌤️