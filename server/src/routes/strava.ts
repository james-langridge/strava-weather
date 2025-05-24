import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { prisma } from "../lib";
import { activityProcessor, type ProcessingResult } from '../services/activityProcessor';

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
stravaRouter.get('/webhook', (req: Request, res: Response): void => {
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
stravaRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
        const event: StravaWebhookEvent = req.body;

        console.log('📨 Strava webhook event received:', {
            object_type: event.object_type,
            object_id: event.object_id,
            aspect_type: event.aspect_type,
            owner_id: event.owner_id,
            event_time: new Date(event.event_time * 1000).toISOString(),
        });

        // Respond immediately for non-activity events
        if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
            console.log(`⏭️ Ignoring ${event.object_type} ${event.aspect_type} event`);
            res.status(200).json({ message: 'Event acknowledged' });
            return;
        }

        const activityId = event.object_id.toString();
        const stravaAthleteId = event.owner_id.toString();

        console.log(`🏃 New activity created: ${activityId} for athlete ${stravaAthleteId}`);

        // Quick user lookup
        const user = await prisma.user.findUnique({
            where: { stravaAthleteId },
            select: {
                id: true,
                weatherEnabled: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user || !user.weatherEnabled) {
            console.log(!user ? '⚠️ User not found' : '⚠️ Weather disabled');
            res.status(200).json({ message: 'Event acknowledged' });
            return;
        }

        console.log(`👤 Processing for: ${user.firstName} ${user.lastName}`);

        // Try to process immediately (with retry logic for 404)
        let attempts = 0;
        let result: ProcessingResult | null = null;

        while (attempts < 3 && Date.now() - startTime < 8000) {
            try {
                if (attempts > 0) {
                    // Wait between retries
                    const delay = attempts * 1500; // 1.5s, 3s
                    console.log(`⏳ Retry ${attempts}: waiting ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                console.log(`🔄 Attempt ${attempts + 1} to process activity ${activityId}`);
                result = await activityProcessor.processActivity(activityId, user.id);

                // If successful or skipped (not a 404), break
                if (result.success || result.skipped) {
                    break;
                }

                // Check if it's a "not found" error
                if (result.error?.includes('not found') || result.error?.includes('404')) {
                    attempts++;
                    continue;
                }

                // Other errors, don't retry
                break;

            } catch (error) {
                console.error(`Attempt ${attempts + 1} failed:`, error);
                attempts++;
            }
        }

        // Log final result
        if (result?.success && !result?.skipped) {
            console.log(`✅ Success: Activity ${activityId} updated with weather`);
        } else if (result?.skipped) {
            console.log(`⏭️ Skipped: ${result.reason}`);
        } else {
            console.log(`❌ Failed after ${attempts} attempts: ${result?.error || 'Unknown error'}`);
        }

        // Always respond 200 to prevent Strava retries
        res.status(200).json({
            message: 'Webhook processed',
            activityId,
            attempts,
            duration: Date.now() - startTime,
            success: result?.success || false,
        });

    } catch (error) {
        console.error('❌ Webhook handler error:', error);
        res.status(200).json({
            message: 'Webhook acknowledged with error',
            duration: Date.now() - startTime,
        });
    }
});

/**
 * GET /api/strava/webhook/status - Check webhook subscription status
 */
stravaRouter.get('/webhook/status', (req: Request, res: Response): void => {
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

export { stravaRouter };