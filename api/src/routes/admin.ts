import { Router, Request, Response, NextFunction } from 'express';
import { webhookSubscriptionService } from '../services/webhookSubscription.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/environment.js';

const adminRouter = Router();

/**
 * Admin authentication middleware
 * In production, replace this with proper admin authentication
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const adminToken = req.headers['x-admin-token'] || req.query.admin_token;

    // Use ADMIN_TOKEN from config/env, or fallback to a default for development
    const expectedToken = config.ADMIN_TOKEN || 'your-secret-admin-token';

    if (adminToken !== expectedToken) {
        throw new AppError('Unauthorized - Admin access required', 401);
    }

    next();
}

/**
 * GET /api/admin/webhook/status - View current webhook subscription
 */
adminRouter.get('/webhook/status', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subscription = await webhookSubscriptionService.viewSubscription();

        res.json({
            success: true,
            data: {
                hasSubscription: !!subscription,
                subscription,
                webhookEndpoint: `${req.protocol}://${req.get('host')}/api/strava/webhook`,
                verifyToken: config.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'configured' : 'missing',
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/webhook/subscribe - Create webhook subscription
 */
adminRouter.post('/webhook/subscribe', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Determine the base URL
        let baseUrl: string;

        if (req.body.callback_url) {
            // Use provided callback URL (for production with custom domain)
            baseUrl = req.body.callback_url;
        } else if (config.isProduction) {
            // In production, use the host header
            baseUrl = `https://${req.get('host')}`;
        } else {
            // In development, construct from request
            baseUrl = `${req.protocol}://${req.get('host')}`;
        }

        const callbackUrl = `${baseUrl}/api/strava/webhook`;

        console.log(`📍 Creating webhook subscription with callback URL: ${callbackUrl}`);

        // First verify the endpoint is accessible
        const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

        if (!isAccessible) {
            throw new AppError(
                'Webhook endpoint is not accessible. Ensure your server is publicly accessible and the webhook endpoint is working.',
                400
            );
        }

        // Create the subscription
        const subscription = await webhookSubscriptionService.createSubscription(callbackUrl);

        res.json({
            success: true,
            message: 'Webhook subscription created successfully',
            data: {
                subscription,
                callbackUrl,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/webhook/unsubscribe - Delete webhook subscription
 */
adminRouter.delete('/webhook/unsubscribe', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // First get the current subscription
        const subscription = await webhookSubscriptionService.viewSubscription();

        if (!subscription) {
            throw new AppError('No webhook subscription found', 404);
        }

        // Delete the subscription
        await webhookSubscriptionService.deleteSubscription(subscription.id);

        res.json({
            success: true,
            message: 'Webhook subscription deleted successfully',
            data: {
                deletedSubscriptionId: subscription.id,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/webhook/verify - Test webhook endpoint
 */
adminRouter.get('/webhook/verify', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const callbackUrl = `${baseUrl}/api/strava/webhook`;

        const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

        res.json({
            success: isAccessible,
            message: isAccessible
                ? 'Webhook endpoint is accessible and working correctly'
                : 'Webhook endpoint verification failed',
            data: {
                callbackUrl,
                verified: isAccessible,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/webhook/setup - One-click webhook setup
 */
adminRouter.post('/webhook/setup', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('🚀 Starting webhook setup process...');

        // Check for existing subscription
        const existing = await webhookSubscriptionService.viewSubscription();

        if (existing) {
            console.log('ℹ️ Found existing subscription:', existing);

            res.json({
                success: true,
                message: 'Webhook subscription already exists',
                data: {
                    subscription: existing,
                    action: 'existing',
                },
            });
            return;
        }

        // Determine the base URL
        let baseUrl: string;

        if (req.body.base_url) {
            baseUrl = req.body.base_url;
        } else if (config.isProduction) {
            baseUrl = `https://${req.get('host')}`;
        } else {
            baseUrl = `${req.protocol}://${req.get('host')}`;
        }

        const callbackUrl = `${baseUrl}/api/strava/webhook`;

        console.log(`📍 Setting up webhook with callback URL: ${callbackUrl}`);

        // Verify endpoint first
        const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

        if (!isAccessible) {
            throw new AppError(
                `Webhook endpoint is not accessible at ${callbackUrl}. ` +
                'Ensure your server is publicly accessible and the webhook endpoint is working. ' +
                'For local development, use a tool like ngrok to expose your local server.',
                400
            );
        }

        // Create subscription
        const subscription = await webhookSubscriptionService.createSubscription(callbackUrl);

        res.json({
            success: true,
            message: 'Webhook subscription created successfully',
            data: {
                subscription,
                callbackUrl,
                action: 'created',
            },
        });

    } catch (error) {
        next(error);
    }
});

export { adminRouter };