import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma} from "../../prisma";
import type { Request, Response, NextFunction } from 'express';

export interface JwtPayload {
    userId: string;
    stravaAthleteId: string;
    iat: number;
    exp: number;
}

export interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        stravaAthleteId: string;
        accessToken: string;
        weatherEnabled: boolean;
    };
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
 * Extract token from request headers
 */
function extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Also check for token in cookies (for browser requests)
    const cookieToken = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (cookieToken) {
        return cookieToken;
    }

    return null;
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

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export async function optionalAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = extractTokenFromRequest(req);

        if (token) {
            const decoded = verifyJWT(token);
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    stravaAthleteId: true,
                    accessToken: true,
                    weatherEnabled: true,
                },
            });

            if (user) {
                (req as AuthenticatedRequest).user = {
                    id: user.id,
                    stravaAthleteId: user.stravaAthleteId,
                    accessToken: user.accessToken,
                    weatherEnabled: user.weatherEnabled,
                };
            }
        }

        next();

    } catch (error) {
        // Don't fail on optional auth errors, just continue without user
        next();
    }
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(res: Response, token: string): void {
    res.cookie(config.SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: config.SESSION_MAX_AGE,
        path: '/',
    });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res: Response): void {
    res.clearCookie(config.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        path: '/',
    });
}