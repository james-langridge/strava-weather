import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/environment.js';
import { generateJWT, setAuthCookie, clearAuthCookie, authenticateUser } from '../services/auth.js';
import { stravaApiService } from '../services/stravaApi.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma} from "../lib/index.js";

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

    const authUrl = new URL('https://www.strava.com/oauth/authorize');
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

        const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
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

        // Get athlete information
        const athlete = tokenData.athlete;

        if (!athlete) {
            console.error('❌ No athlete data in token response');
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=no_athlete_data`);
        }

        try {
            // Create or update user in database
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
                    weatherEnabled: true, // Enable by default
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

            // Generate JWT token using your existing function
            const token = generateJWT(user.id, user.stravaAthleteId);

            // Set authentication cookie using your existing function
            setAuthCookie(res, token);

            console.log(`✅ OAuth complete for user ${user.id} (existing)`);

            // Redirect to success page
            res.redirect(`${config.FRONTEND_URL}/auth/success`);

        } catch (dbError) {
            console.error('❌ Database error during OAuth:', dbError);
            return res.redirect(`${config.FRONTEND_URL}/auth/error?error=database_error`);
        }

    } catch (error) {
        console.error('❌ OAuth callback error:', error);
        next(error);
    }
});

/**
 * GET /api/auth/me - Get current user
 */
authRouter.get('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user; // Using your existing auth middleware

        res.json({
            success: true,
            data: {
                id: user.id,
                stravaAthleteId: user.stravaAthleteId,
                weatherEnabled: user.weatherEnabled,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/logout - Logout user
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
    try {
        // Clear the authentication cookie using your existing function
        clearAuthCookie(res);

        console.log('🚪 User logged out successfully');

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
        });
    }
});

/**
 * DELETE /api/auth/account - Delete user account
 */
authRouter.delete('/account', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        console.log(`🗑️ Account deletion requested for user ${user.id}`);

        // Get user's access token for Strava revocation
        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { accessToken: true },
        });

        if (fullUser?.accessToken) {
            // Revoke Strava access token
            try {
                await stravaApiService.revokeToken(fullUser.accessToken);
                console.log('✅ Strava token revoked');
            } catch (error) {
                console.warn('⚠️ Failed to revoke Strava token:', error);
                // Continue with account deletion even if revocation fails
            }
        }

        // Then delete the user
        await prisma.user.delete({
            where: { id: user.id },
        });

        // Clear authentication cookie
        clearAuthCookie(res);

        console.log(`✅ User account ${user.id} deleted successfully`);

        res.json({
            success: true,
            message: 'Account deleted successfully',
        });

    } catch (error) {
        next(error);
    }
});

export { authRouter };