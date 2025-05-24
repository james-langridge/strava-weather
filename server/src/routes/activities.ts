import { Router, Request, Response, NextFunction } from 'express';
import { activityProcessor } from '../services/activityProcessor';
import { authenticateUser } from '../services/auth';
import { AppError } from '../middleware/errorHandler';

const activitiesRouter = Router();

/**
 * POST /api/activities/process/:activityId
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

export { activitiesRouter };