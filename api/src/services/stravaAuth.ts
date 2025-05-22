import crypto from 'crypto';
import {config} from '../config/environment';
import {prisma} from "../lib";

export interface StravaAthlete {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    city: string;
    state: string;
    country: string;
    profile: string;
    profile_medium: string;
}

interface StravaTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    token_type: 'Bearer';
    athlete: StravaAthlete;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
    try {
        const response = await fetch(config.STRAVA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: config.STRAVA_CLIENT_ID,
                client_secret: config.STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Strava token exchange failed: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data as StravaTokenResponse;

    } catch (error) {
        console.error('Failed to exchange code for token:', error);
        throw new Error('Failed to authenticate with Strava');
    }
}

/**
 * Refresh expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
    try {
        const response = await fetch(config.STRAVA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: config.STRAVA_CLIENT_ID,
                client_secret: config.STRAVA_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${response.status} ${error}`);
        }

        const data = await response.json();
        return data as StravaTokenResponse;

    } catch (error) {
        console.error('Failed to refresh token:', error);
        throw new Error('Failed to refresh Strava token');
    }
}

/**
 * Encrypt sensitive data for database storage using AES-256-CBC with proper IV
 */
function encryptToken(token: string): string {
    try {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(config.ENCRYPTION_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return format: iv:encrypted
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption failed, using base64 fallback:', error);
        // Fallback to simple base64 encoding for development
        return Buffer.from(token).toString('base64');
    }
}

/**
 * Decrypt sensitive data from database using AES-256-CBC with proper IV
 */
function decryptToken(encryptedData: string): string {
    try {
        // Check if it's the new format (iv:encrypted) or old base64
        if (!encryptedData.includes(':')) {
            // Fallback for base64 encoded tokens
            return Buffer.from(encryptedData, 'base64').toString('utf8');
        }

        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(config.ENCRYPTION_KEY, 'salt', 32);

        const parts = encryptedData.split(':');

        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, encrypted] = parts;

        if (!ivHex || !encrypted) {
            throw new Error('Missing IV or encrypted data');
        }

        const iv = Buffer.from(ivHex, 'hex');

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed, trying base64 fallback:', error);
        // Fallback to base64 decoding
        try {
            return Buffer.from(encryptedData, 'base64').toString('utf8');
        } catch {
            throw new Error('Failed to decrypt token');
        }
    }
}

/**
 * Create or update user from Strava OAuth response
 */
export async function createOrUpdateUser(tokenData: StravaTokenResponse): Promise<{ userId: string; isNewUser: boolean }> {
    try {
        const athlete = tokenData.athlete;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { stravaAthleteId: athlete.id.toString() },
        });

        const userData = {
            stravaAthleteId: athlete.id.toString(),
            accessToken: encryptToken(tokenData.access_token),
            refreshToken: encryptToken(tokenData.refresh_token),
            tokenExpiresAt: new Date(tokenData.expires_at * 1000),
            firstName: athlete.firstname || null,
            lastName: athlete.lastname || null,
            profileImageUrl: athlete.profile || null,
            city: athlete.city || null,
            state: athlete.state || null,
            country: athlete.country || null,
            weatherEnabled: true, // Default to enabled
        };

        if (existingUser) {
            // Update existing user
            await prisma.user.update({
                where: { id: existingUser.id },
                data: userData,
            });

            console.log(`✅ Updated user ${existingUser.id} (${athlete.firstname} ${athlete.lastname})`);
            return { userId: existingUser.id, isNewUser: false };

        } else {
            // Create new user
            const newUser = await prisma.user.create({
                data: userData,
            });

            console.log(`✅ Created new user ${newUser.id} (${athlete.firstname} ${athlete.lastname})`);
            return { userId: newUser.id, isNewUser: true };
        }

    } catch (error) {
        console.error('Failed to create/update user:', error);
        throw new Error('Failed to save user data');
    }
}

/**
 * Get user's current access token (refresh if needed)
 */
export async function getUserAccessToken(userId: string): Promise<string> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const now = new Date();
        const tokenExpiresAt = new Date(user.tokenExpiresAt);

        // Check if token needs refresh (refresh 5 minutes before expiry)
        const refreshThreshold = new Date(tokenExpiresAt.getTime() - 5 * 60 * 1000);

        if (now >= refreshThreshold) {
            console.log(`🔄 Refreshing access token for user ${userId}`);

            const refreshToken = decryptToken(user.refreshToken);
            const newTokenData = await refreshAccessToken(refreshToken);

            // Update user with new tokens
            await prisma.user.update({
                where: { id: userId },
                data: {
                    accessToken: encryptToken(newTokenData.access_token),
                    refreshToken: encryptToken(newTokenData.refresh_token),
                    tokenExpiresAt: new Date(newTokenData.expires_at * 1000),
                },
            });

            return newTokenData.access_token;
        }

        // Token is still valid
        return decryptToken(user.accessToken);

    } catch (error) {
        console.error('Failed to get access token:', error);
        throw new Error('Failed to get user access token');
    }
}

/**
 * Revoke user's Strava authorization
 */
export async function revokeStravaAccess(userId: string): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const accessToken = decryptToken(user.accessToken);

        // Revoke token with Strava
        await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        // Delete user from database
        await prisma.user.delete({
            where: { id: userId },
        });

        console.log(`✅ Revoked access and deleted user ${userId}`);

    } catch (error) {
        console.error('Failed to revoke Strava access:', error);
        throw new Error('Failed to revoke Strava access');
    }
}