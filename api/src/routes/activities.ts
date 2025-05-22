import { Router, Request, Response, NextFunction } from 'express';
import { activityProcessor } from '../services/activityProcessor';
import { authenticateUser } from '../services/auth';
import { AppError } from '../middleware/errorHandler';

const activitiesRouter = Router();

/**
 * POST /api/activities/process/:activityId - Process a specific activity
 */
activitiesRouter.post('/process/:activityId', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {    try {
        const user = req.user;
        const { activityId } = req.params;
        const { forceUpdate } = req.body;

        if (!activityId || !/^\d+$/.test(activityId)) {
            throw new AppError('Invalid activity ID', 400);
        }

    if (!user) {
        throw new AppError('User not found');
    }

        console.log(`🔄 Manual processing request for activity ${activityId} by user ${user.id}`);

        const result = await activityProcessor.processActivity(activityId, user.id, forceUpdate);

        if (result.success) {
            res.json({
                success: true,
                message: result.skipped ? 'Activity was skipped' : 'Activity processed successfully',
                data: {
                    activityId: result.activityId,
                    weatherData: result.weatherData,
                    skipped: result.skipped,
                    reason: result.reason,
                },
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to process activity',
                error: result.error,
                data: {
                    activityId: result.activityId,
                    skipped: result.skipped,
                    reason: result.reason,
                },
            });
        }

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/activities/process/recent - Process recent activities
 */
activitiesRouter.post('/process/recent', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user;

        if (!user) {
            throw new AppError('User not found');
        }

        const { days = 30 } = req.body;

        if (typeof days !== 'number' || days < 1 || days > 365) {
            throw new AppError('Days must be a number between 1 and 365', 400);
        }

        console.log(`🔄 Processing recent activities (${days} days) for user ${user.id}`);

        const results = await activityProcessor.processRecentActivities(user.id, days);

        const stats = results.reduce(
            (acc, result) => {
                if (result.success && !result.skipped) acc.successful++;
                if (result.skipped) acc.skipped++;
                if (!result.success && !result.skipped) acc.failed++;
                return acc;
            },
            { successful: 0, skipped: 0, failed: 0 }
        );

        res.json({
            success: true,
            message: `Processed ${results.length} activities`,
            data: {
                totalActivities: results.length,
                statistics: stats,
                results: results.slice(0, 10), // Return first 10 results for inspection
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/activities/process/batch - Process multiple specific activities
 */
activitiesRouter.post('/process/batch', authenticateUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user;

        if (!user) {
            throw new AppError('User not found');
        }

        const { activityIds, forceUpdate = false } = req.body;

        if (!Array.isArray(activityIds) || activityIds.length === 0) {
            throw new AppError('Activity IDs array is required', 400);
        }

        if (activityIds.length > 50) {
            throw new AppError('Cannot process more than 50 activities at once', 400);
        }

        // Validate all activity IDs
        const invalidIds = activityIds.filter(id => !id || !/^\d+$/.test(id.toString()));
        if (invalidIds.length > 0) {
            throw new AppError(`Invalid activity IDs: ${invalidIds.join(', ')}`, 400);
        }

        console.log(`🔄 Batch processing ${activityIds.length} activities for user ${user.id}`);

        const results = await activityProcessor.processActivitiesBatch(
            activityIds.map(id => id.toString()),
            user.id,
            forceUpdate
        );

        const stats = results.reduce(
            (acc, result) => {
                if (result.success && !result.skipped) acc.successful++;
                if (result.skipped) acc.skipped++;
                if (!result.success && !result.skipped) acc.failed++;
                return acc;
            },
            { successful: 0, skipped: 0, failed: 0 }
        );

        res.json({
            success: true,
            message: `Batch processing complete`,
            data: {
                totalActivities: results.length,
                statistics: stats,
                results,
            },
        });

    } catch (error) {
        next(error);
    }
});

export { activitiesRouter };