import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib';
import { authenticateUser } from '@/services/auth';
import { AppError } from '../utils/errors';
import type { Request, Response, NextFunction } from 'express';

const usersRouter = Router();

// Validation schemas
const userUpdateSchema = z.object({
    weatherEnabled: z.boolean(),
});

const preferencesUpdateSchema = z.object({
    temperatureUnit: z.enum(['fahrenheit', 'celsius']).optional(),
    weatherFormat: z.enum(['detailed', 'simple']).optional(),
    includeUvIndex: z.boolean().optional(),
    includeVisibility: z.boolean().optional(),
    customFormat: z.string().optional(),
}).transform((data) => {
    const result: any = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            result[key] = value;
        }
    });
    return result;
});

/**
 * GET /api/users/me - Get current user profile
 */
usersRouter.get('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        const userProfile = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                stravaAthleteId: true,
                firstName: true,
                lastName: true,
                profileImageUrl: true,
                city: true,
                state: true,
                country: true,
                weatherEnabled: true,
                createdAt: true,
                updatedAt: true,
                preferences: {
                    select: {
                        temperatureUnit: true,
                        weatherFormat: true,
                        includeUvIndex: true,
                        includeVisibility: true,
                        customFormat: true,
                        updatedAt: true,
                    }
                }
            },
        });

        if (!userProfile) {
            throw new AppError('User profile not found', 404);
        }

        res.json({
            success: true,
            data: {
                id: userProfile.id,
                stravaAthleteId: userProfile.stravaAthleteId,
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                displayName: [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || 'Strava User',
                profileImageUrl: userProfile.profileImageUrl,
                location: [userProfile.city, userProfile.state, userProfile.country]
                    .filter(Boolean)
                    .join(', ') || null,
                weatherEnabled: userProfile.weatherEnabled,
                preferences: userProfile.preferences,
                memberSince: userProfile.createdAt,
                lastUpdated: userProfile.updatedAt,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me - Update user preferences
 */
usersRouter.patch('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        // Validate request body
        const validation = userUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid request data', 400);
        }

        const updateData = validation.data;

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                id: true,
                weatherEnabled: true,
                updatedAt: true,
            },
        });

        console.log(`✅ Updated user preferences for ${user.id}:`, updateData);

        res.json({
            success: true,
            data: {
                id: updatedUser.id,
                weatherEnabled: updatedUser.weatherEnabled,
                updatedAt: updatedUser.updatedAt,
            },
            message: 'User preferences updated successfully',
        });

    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/users/me/preferences - Update weather preferences
 */
usersRouter.patch('/me/preferences', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;

        // Validate request body
        const validation = preferencesUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid preferences data', 400);
        }

        const preferencesData = validation.data;

        // Update or create preferences
        const updatedPreferences = await prisma.userPreference.upsert({
            where: { userId: user.id },
            update: preferencesData,
            create: {
                userId: user.id,
                ...preferencesData,
            },
            select: {
                temperatureUnit: true,
                weatherFormat: true,
                includeUvIndex: true,
                includeVisibility: true,
                customFormat: true,
                updatedAt: true,
            },
        });

        console.log(`✅ Updated weather preferences for ${user.id}:`, preferencesData);

        res.json({
            success: true,
            data: updatedPreferences,
            message: 'Weather preferences updated successfully',
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/me/stats - Get basic user statistics
 */
usersRouter.get('/me/stats', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        const userProfile = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                weatherEnabled: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!userProfile) {
            throw new AppError('User profile not found', 404);
        }

        const membershipDays = Math.floor(
            (Date.now() - userProfile.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        res.json({
            success: true,
            data: {
                weatherEnabled: userProfile.weatherEnabled,
                membershipDays,
                memberSince: userProfile.createdAt,
                lastActive: userProfile.updatedAt,
                // For activity stats, would need to query Strava API directly
                // or implement a simpler tracking mechanism
                message: 'Activity statistics require querying Strava API directly'
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/users/me - Delete user account
 */
usersRouter.delete('/me', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        // Delete user and all related data (cascading delete)
        await prisma.user.delete({
            where: { id: user.id },
        });

        console.log(`✅ Deleted user account ${user.id}`);

        res.json({
            success: true,
            message: 'User account deleted successfully',
        });

    } catch (error) {
        next(error);
    }
});

export { usersRouter };