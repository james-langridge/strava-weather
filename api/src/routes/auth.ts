import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/environment.js';
import { generateJWT } from '../services/auth.js';
import { prisma} from "../lib/index.js";
import {ensureWebhooksInitialized} from "../utils/initWebhooks.js";

const authRouter = Router();

/**
 * GET /api/auth/strava - Initiate Strava OAuth flow
 */
authRouter.get('/strava', (req: Request, res: Response) => {
    console.log('🚀 Starting Strava OAuth flow');

    const scopes = ['activity:read_all', 'activity:write', 'profile:read_all'];

    // Generate a secure state parameter for CSRF protection
    const state = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Store state in session for verification (in production, use a more secure method)
    // For now, we'll just generate it and verify on callback

    const authUrl = new URL(config.STRAVA_OAUTH_URL);
    authUrl.searchParams.set('client_id', config.STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${req.protocol}://${req.get('host')}/api/auth/strava/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('approval_prompt', 'force');
    authUrl.searchParams.set('scope', scopes.join(','));
    authUrl.searchParams.set('state', state);

    console.log(`🔗 Redirecting to Strava OAuth: ${authUrl.toString().substring(0, 100)}...`);

    res.redirect(authUrl.toString());
});

/**
 * GET /api/auth/strava/callback - Handle Strava OAuth callback
 */
authRouter.get('/strava/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('📨 OAuth callback received:', req.query);

        const { code, state, error } = req.query;

        if (error) {
            console.log('❌ OAuth error:', error);
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error as string)}`);
        }

        if (!code) {
            console.log('❌ No authorization code received');
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=no_code`);
        }

        // Exchange code for access token
        console.log('🔑 Exchanging authorization code for access token');

        const tokenResponse = await fetch(config.STRAVA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: config.STRAVA_CLIENT_ID,
                client_secret: config.STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token exchange failed:', errorText);
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=token_exchange_failed`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token exchange successful');

        const athlete = tokenData.athlete;

        if (!athlete) {
            console.error('❌ No athlete data in token response');
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=no_athlete_data`);
        }

        try {
            const user = await prisma.user.upsert({
                where: { stravaAthleteId: athlete.id.toString() },
                update: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    tokenExpiresAt: new Date(tokenData.expires_at * 1000),
                    firstName: athlete.firstname || '',
                    lastName: athlete.lastname || '',
                    profileImageUrl: athlete.profile_medium || athlete.profile,
                    city: athlete.city,
                    state: athlete.state,
                    country: athlete.country,
                    weatherEnabled: true,
                    updatedAt: new Date(),
                },
                create: {
                    stravaAthleteId: athlete.id.toString(),
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    tokenExpiresAt: new Date(tokenData.expires_at * 1000),
                    firstName: athlete.firstname || '',
                    lastName: athlete.lastname || '',
                    profileImageUrl: athlete.profile_medium || athlete.profile,
                    city: athlete.city,
                    state: athlete.state,
                    country: athlete.country,
                    weatherEnabled: true,
                },
            });

            console.log(`✅ Updated user ${user.id} (${user.firstName} ${user.lastName})`);

            await ensureWebhooksInitialized();

            const token = generateJWT(user.id, user.stravaAthleteId);

            const redirectUrl = new URL('/auth/success', config.FRONTEND_URL);
            redirectUrl.searchParams.set('token', token);
            res.redirect(redirectUrl.toString());

        } catch (dbError) {
            console.error('❌ Database error during OAuth:', dbError);
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=database_error`);
        }

    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        next(error);
    }
});

export { authRouter };