import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { prisma} from "../../prisma";
import { AppError } from './errorHandler';

export interface AuthenticatedUser {
    id: string;
    stravaAthleteId: string;
    firstName: string;
    lastName: string;
    weatherEnabled: boolean;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Extract JWT token from request
 */
function extractToken(req: Request): string | null {
    // Try cookie first (preferred for web sessions)
    const cookieToken = req.cookies?.sessionToken;
    if (cookieToken) {
        return cookieToken;
    }

    // Try Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return null;
}

/**
 * Verify JWT token and decode payload
 */
function verifyToken(token: string): { userId: string } {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;

        if (!decoded.userId) {
            throw new Error('Invalid token payload');
        }

        return { userId: decoded.userId };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new AppError('Session expired', 401);
        } else if (error instanceof jwt.JsonWebTokenError) {
            throw new AppError('Invalid session token', 401);
        } else {
            throw new AppError('Token verification failed', 401);
        }
    }
}

/**
 * Middleware to authenticate user requests
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Extract token from request
        const token = extractToken(req);

        if (!token) {
            throw new AppError('Authentication required', 401);
        }

        // Verify token
        const { userId } = verifyToken(token);

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                stravaAthleteId: true,
                firstName: true,
                lastName: true,
                weatherEnabled: true,
                accessToken: true, // We'll need this for Strava API calls
            },
        });

        if (!user) {
            throw new AppError('User not found', 401);
        }

        // Check if user still has valid Strava access
        if (!user.accessToken) {
            throw new AppError('Strava access token missing - please reconnect', 401);
        }

        // Attach user to request
        req.user = {
            id: user.id,
            stravaAthleteId: user.stravaAthleteId,
            firstName: user.firstName,
            lastName: user.lastName,
            weatherEnabled: user.weatherEnabled,
        };

        console.log(`🔐 Authenticated user: ${user.firstName} ${user.lastName} (${user.id})`);

        next();

    } catch (error) {
        if (error instanceof AppError) {
            // Clear invalid session cookie
            res.clearCookie('sessionToken');
            next(error);
        } else {
            console.error('Authentication error:', error);
            res.clearCookie('sessionToken');
            next(new AppError('Authentication failed', 401));
        }
    }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const token = extractToken(req);

        if (!token) {
            // No token provided, continue without authentication
            next();
            return;
        }

        // Try to authenticate, but don't fail if it doesn't work
        const { userId } = verifyToken(token);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                stravaAthleteId: true,
                firstName: true,
                lastName: true,
                weatherEnabled: true,
            },
        });

        if (user) {
            req.user = user;
            console.log(`🔐 Optional auth success: ${user.firstName} ${user.lastName}`);
        }

        next();

    } catch (error) {
        // For optional auth, we just continue without the user
        console.log('Optional auth failed, continuing without user');
        next();
    }
}

/**
 * Middleware to require admin privileges (for future use)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    // First ensure user is authenticated
    await authenticateUser(req, res, (error) => {
        if (error) {
            return next(error);
        }

        // For now, we don't have admin roles, but this is where you'd check
        // TODO: Add admin role checking when needed
        console.log('🔑 Admin check passed (no admin roles implemented yet)');
        next();
    });
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string): string {
    return jwt.sign(
        { userId },
        config.JWT_SECRET,
        {
            expiresIn: '7d', // Token valid for 7 days
            issuer: 'strava-weather-api',
            audience: 'strava-weather-app',
        }
    );
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(res: Response, token: string): void {
    res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: !config.NODE_ENV || config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: '/',
    });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res: Response): void {
    res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: !config.NODE_ENV || config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}