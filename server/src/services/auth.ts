import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma } from "../lib";
import type { NextFunction, Request, Response } from 'express';

export interface JwtPayload {
    userId: string;
    stravaAthleteId: string;
    iat: number;
    exp: number;
}

export interface AuthenticatedUser {
    id: string;
    stravaAthleteId: string;
    firstName: string;
    lastName: string;
    weatherEnabled: boolean;
    accessToken: string;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Generate JWT token for user
 */
export function generateJWT(userId: string, stravaAthleteId: string | number | bigint): string {
    const athleteIdStr = typeof stravaAthleteId !== 'string' ? stravaAthleteId.toString() : stravaAthleteId;

    const payload = {
        userId,
        stravaAthleteId: athleteIdStr,
    };

    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: '30d', // Token expires in 30 days
        issuer: 'strava-weather-api',
        audience: 'strava-weather-client',
    });
}

/**
 * Verify and decode JWT token
 */
export function verifyJWT(token: string): JwtPayload {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET, {
            issuer: 'strava-weather-api',
            audience: 'strava-weather-client',
        }) as JwtPayload;

        return decoded;

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token expired');
        } else if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        } else {
            throw new Error('Token verification failed');
        }
    }
}

/**
 * Extract token from request
 * Prioritizes cookies over Authorization header for security
 */
function extractTokenFromRequest(req: Request): string | null {
    // First check for HTTP-only cookie (most secure)
    const cookieToken = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (cookieToken) {
        return cookieToken;
    }

    // Fallback to Authorization header (for backward compatibility)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return null;
}

/**
 * Set secure HTTP-only cookie with JWT
 */
export function setAuthCookie(res: Response, token: string): void {
    // Extract domain from FRONTEND_URL for cookie domain
    // For example: https://web.example.com -> .example.com
    let cookieDomain: string | undefined;

    try {
        const frontendUrl = new URL(config.FRONTEND_URL);
        const hostname = frontendUrl.hostname;

        // If it's a subdomain, set cookie for parent domain
        // This allows cookie sharing between api.example.com and web.example.com
        const parts = hostname.split('.');
        if (parts.length > 2) {
            // Remove subdomain, keep domain.tld
            cookieDomain = '.' + parts.slice(-2).join('.');
        } else if (parts.length === 2 && !hostname.includes('localhost')) {
            // For example.com, set .example.com
            cookieDomain = '.' + hostname;
        }
        // For localhost or IP addresses, don't set domain
    } catch (error) {
        console.warn('Could not parse FRONTEND_URL for cookie domain:', error);
    }

    const cookieOptions = {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        secure: config.isProduction, // HTTPS only in production
        sameSite: 'lax' as const, // CSRF protection
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        path: '/', // Cookie available for all paths
    };

    res.cookie(config.SESSION_COOKIE_NAME, token, cookieOptions);

    console.log(`🍪 Set auth cookie with options:`, {
        ...cookieOptions,
        token: token.substring(0, 10) + '...' // Log partial token for debugging
    });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res: Response): void {
    // Extract domain same as setAuthCookie for consistency
    let cookieDomain: string | undefined;

    try {
        const frontendUrl = new URL(config.FRONTEND_URL);
        const hostname = frontendUrl.hostname;
        const parts = hostname.split('.');

        if (parts.length > 2) {
            cookieDomain = '.' + parts.slice(-2).join('.');
        } else if (parts.length === 2 && !hostname.includes('localhost')) {
            cookieDomain = '.' + hostname;
        }
    } catch (error) {
        console.warn('Could not parse FRONTEND_URL for cookie domain:', error);
    }

    res.clearCookie(config.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        path: '/',
        ...(cookieDomain && { domain: cookieDomain }),
    });

    console.log('🗑️ Cleared auth cookie');
}

/**
 * Middleware to authenticate requests
 */
export async function authenticateUser(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = extractTokenFromRequest(req);

        if (!token) {
            res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided',
            });
            return;
        }

        // Verify JWT
        const decoded = verifyJWT(token);

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                stravaAthleteId: true,
                accessToken: true,
                weatherEnabled: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user) {
            res.status(401).json({
                error: 'Authentication failed',
                message: 'User not found',
            });
            return;
        }

        // Add user to request object
        (req as AuthenticatedRequest).user = {
            id: user.id,
            stravaAthleteId: user.stravaAthleteId,
            accessToken: user.accessToken,
            weatherEnabled: user.weatherEnabled,
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
        };

        next();

    } catch (error) {
        console.error('Authentication error:', error);

        let message = 'Authentication failed';
        if (error instanceof Error) {
            message = error.message;
        }

        res.status(401).json({
            error: 'Authentication failed',
            message,
        });
    }
}