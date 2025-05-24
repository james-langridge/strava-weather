import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib';
import { authenticateUser, clearAuthCookie } from '../services/auth';
import { AppError } from '../utils/errors';
import type { Request, Response, NextFunction } from 'express';

const usersRouter = Router();

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

        const validation = preferencesUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid preferences data', 400);
        }

        const preferencesData = validation.data;

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

        // Clear the auth cookie since the account no longer exists
        clearAuthCookie(res);

        res.json({
            success: true,
            message: 'User account deleted successfully',
        });

    } catch (error) {
        next(error);
    }
});

export { usersRouter };