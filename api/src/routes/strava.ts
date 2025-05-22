import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { prisma} from "../lib";
import { activityProcessor } from '../services/activityProcessor';
import { AppError } from '../middleware/errorHandler';

const stravaRouter = Router();

interface StravaWebhookEvent {
    object_type: 'activity' | 'athlete';
    object_id: number;
    aspect_type: 'create' | 'update' | 'delete';
    updates: Record<string, any>;
    owner_id: number;
    subscription_id: number;
    event_time: number;
}

/**
 * GET /api/strava/webhook - Webhook verification
 */
stravaRouter.get('/webhook', (req: Request, res: Response) => {
    console.log('🔗 Strava webhook verification request:', req.query);

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.STRAVA_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verification successful');
        res.json({ 'hub.challenge': challenge });
    } else {
        console.log('❌ Webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/strava/webhook - Handle webhook events
 */
stravaRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event: StravaWebhookEvent = req.body;

        console.log('📨 Strava webhook event received:', {
            object_type: event.object_type,
            object_id: event.object_id,
            aspect_type: event.aspect_type,
            owner_id: event.owner_id,
            event_time: new Date(event.event_time * 1000).toISOString(),
        });

        // Only process activity creation events
        if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
            console.log(`⏭️ Ignoring ${event.object_type} ${event.aspect_type} event`);
            res.status(200).json({ message: 'Event received but not processed' });
            return;
        }

        const activityId = event.object_id.toString();
        const stravaAthleteId = event.owner_id.toString();

        console.log(`🏃 New activity created: ${activityId} for athlete ${stravaAthleteId}`);

        // Find user by Strava athlete ID
        const user = await prisma.user.findUnique({
            where: { stravaAthleteId },
            select: {
                id: true,
                weatherEnabled: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user) {
            console.log(`⚠️ User with Strava athlete ID ${stravaAthleteId} not found`);
            res.status(200).json({ message: 'User not found' });
            return;
        }

        if (!user.weatherEnabled) {
            console.log(`⚠️ Weather updates disabled for user ${user.id}`);
            res.status(200).json({ message: 'Weather updates disabled for user' });
            return;
        }

        console.log(`👤 Found user: ${user.firstName} ${user.lastName} (${user.id})`);

        // Process the activity asynchronously (don't wait for completion)
        // This allows us to respond quickly to Strava
        setImmediate(async () => {
            try {
                console.log(`🔄 Background processing started for activity ${activityId}`);

                // Add a small delay to ensure the activity is fully available in Strava's API
                await new Promise(resolve => setTimeout(resolve, 5000));

                const result = await activityProcessor.processActivity(activityId, user.id);

                if (result.success && !result.skipped) {
                    console.log(`✅ Webhook processing successful for activity ${activityId}`);
                } else if (result.skipped) {
                    console.log(`⏭️ Activity ${activityId} was skipped: ${result.reason}`);
                } else {
                    console.log(`❌ Webhook processing failed for activity ${activityId}: ${result.error}`);
                }

            } catch (error) {
                console.error(`💥 Background processing error for activity ${activityId}:`, error);
            }
        });

        // Respond immediately to Strava
        res.status(200).json({
            message: 'Webhook received, activity queued for processing',
            activityId,
            userId: user.id,
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        next(error);
    }
});

/**
 * POST /api/strava/webhook/test - Test webhook processing with manual event
 */
stravaRouter.post('/webhook/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activityId, athleteId } = req.body;

        if (!activityId || !athleteId) {
            throw new AppError('activityId and athleteId are required', 400);
        }

        console.log(`🧪 Testing webhook processing for activity ${activityId}, athlete ${athleteId}`);

        // Create a mock webhook event
        const mockEvent: StravaWebhookEvent = {
            object_type: 'activity',
            object_id: parseInt(activityId),
            aspect_type: 'create',
            updates: {},
            owner_id: parseInt(athleteId),
            subscription_id: 1,
            event_time: Math.floor(Date.now() / 1000),
        };

        // Process the mock event using the same logic as the real webhook
        const user = await prisma.user.findUnique({
            where: { stravaAthleteId: athleteId },
            select: {
                id: true,
                weatherEnabled: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user) {
            throw new AppError(`User with Strava athlete ID ${athleteId} not found`, 404);
        }

        if (!user.weatherEnabled) {
            res.json({
                success: false,
                message: 'Weather updates disabled for user',
                userId: user.id,
            });
            return;
        }

        console.log(`👤 Testing for user: ${user.firstName} ${user.lastName} (${user.id})`);

        const result = await activityProcessor.processActivity(activityId, user.id);

        res.json({
            success: result.success,
            message: result.success
                ? (result.skipped ? 'Activity was skipped' : 'Activity processed successfully')
                : 'Processing failed',
            data: {
                activityId: result.activityId,
                weatherData: result.weatherData,
                skipped: result.skipped,
                reason: result.reason,
                error: result.error,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/strava/webhook/status - Check webhook subscription status
 */
stravaRouter.get('/webhook/status', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Webhook endpoint is active',
        data: {
            endpoint: '/api/strava/webhook',
            verifyToken: config.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'configured' : 'missing',
            timestamp: new Date().toISOString(),
        },
    });
});

module.exports = { stravaRouter };