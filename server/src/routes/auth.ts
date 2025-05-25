import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { generateJWT, setAuthCookie, clearAuthCookie, authenticateUser, verifyJWT } from '../services/auth';
import { prisma } from "../lib";
import { ensureWebhooksInitialized } from "../utils/initWebhooks";
import { stravaApiService } from '../services/stravaApi';
import { encryptionService } from '../services/encryption';
import {logger} from "../utils/logger";

const authRouter: Router = Router();

/**
 * GET /api/auth/strava - Initiate Strava OAuth flow
 */
authRouter.get('/strava', (req: Request, res: Response) => {
    const scopes = ['activity:read_all', 'activity:write', 'profile:read_all'];

    logger.info('Starting Strava OAuth flow', {
        endpoint: '/auth/strava',
        scopes: scopes.join(',')
    });

    // Generate a secure state parameter for CSRF protection
    const state = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Store state in session for verification (in production, use a more secure method)
    // For now, we'll just generate it and verify on callback

    const authUrl = new URL(config.api.strava.authUrl);
    authUrl.searchParams.set('client_id', config.STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${config.APP_URL}/api/auth/strava/callback`);
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
            return res.redirect(`${config.APP_URL}/auth/error?error=${encodeURIComponent(error as string)}`);
        }

        if (!code) {
            console.log('❌ No authorization code received');
            return res.redirect(`${config.APP_URL}/auth/error?error=no_code`);
        }

        // Exchange code for access token
        console.log('🔑 Exchanging authorization code for access token');

        const tokenResponse = await fetch(config.api.strava.tokenUrl, {
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
            logger.error('Token exchange failed', {
                error: errorText,
                statusCode: tokenResponse.status
            });
            return res.redirect(`${config.APP_URL}/auth/error?error=token_exchange_failed`);
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Token exchange successful');

        const athlete = tokenData.athlete;

        if (!athlete) {
            console.error('❌ No athlete data in token response');
            return res.redirect(`${config.APP_URL}/auth/error?error=no_athlete_data`);
        }

        try {
            // Encrypt tokens before storing
            const encryptedAccessToken = encryptionService.encrypt(tokenData.access_token);
            const encryptedRefreshToken = encryptionService.encrypt(tokenData.refresh_token);

            const user = await prisma.user.upsert({
                where: { stravaAthleteId: athlete.id.toString() },
                update: {
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
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
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
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

            // Generate JWT and set as HTTP-only cookie
            const token = generateJWT(user.id, user.stravaAthleteId);
            setAuthCookie(res, token);

            // Redirect to success page without token in URL
            const redirectUrl = new URL('/auth/success', config.APP_URL);
            res.redirect(redirectUrl.toString());

        } catch (dbError) {
            console.error('❌ Database error during OAuth:', dbError);
            return res.redirect(`${config.APP_URL}/auth/error?error=database_error`);
        }

    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        next(error);
    }
});

/**
 * POST /api/auth/logout - Logout user
 */
authRouter.post('/logout', (req: Request, res: Response) => {
    console.log('🔒 User logout requested');

    // Clear the auth cookie
    clearAuthCookie(res);

    res.json({
        success: true,
        data: {
            message: 'Logged out successfully',
        }
    });
});

/**
 * GET /api/auth/check - Check if user is authenticated
 * This endpoint can be used by the frontend to verify authentication status
 */
authRouter.get('/check', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        console.log('🍪 Cookies received:', req.cookies);
        console.log('🔍 Looking for cookie:', config.auth.sessionCookieName);
        const token = req.cookies?.[config.auth.sessionCookieName];

        if (!token) {
            console.log('❌ No auth token found in cookies');
            res.json({
                success: false,
                data: {
                    authenticated: false,
                }
            });
            return;
        }

        // For a more secure check, we should verify the token
        try {
            const decoded = verifyJWT(token);
            console.log('✅ Token verified:', decoded);
            res.json({
                success: true,
                data: {
                    authenticated: true,
                }
            });
        } catch (error) {
            // Token is invalid or expired
            console.log('❌ Token verification failed:', error);
            res.json({
                success: false,
                data: {
                    authenticated: false
                }
            });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/auth/revoke - Revoke Strava access and logout
 * This completely disconnects the user's Strava account
 */
authRouter.delete('/revoke', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;

        console.log(`🔐 Revoking Strava access for user ${user.id}`);

        // Decrypt the access token to revoke it
        const decryptedAccessToken = encryptionService.decrypt(user.accessToken);

        // Revoke the Strava token
        await stravaApiService.revokeToken(decryptedAccessToken);

        // Delete the user from our database
        await prisma.user.delete({
            where: { id: user.id },
        });

        console.log(`✅ Revoked access and deleted user ${user.id}`);

        // Clear the auth cookie
        clearAuthCookie(res);

        res.json({
            success: true,
            message: 'Strava access revoked successfully',
        });

    } catch (error) {
        next(error);
    }
});

export { authRouter };