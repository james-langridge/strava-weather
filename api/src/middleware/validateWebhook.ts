import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { AppError } from '../utils/errors';

/**
 * Middleware to validate Strava webhook signatures
 * This ensures the webhook actually came from Strava
 */
export function validateWebhookSignature(req: Request, res: Response, next: NextFunction): void {
    // Skip validation for GET requests (subscription validation)
    if (req.method === 'GET') {
        return next();
    }

    try {
        const signature = req.headers['x-hub-signature'] as string;

        if (!signature) {
            throw new AppError('Missing webhook signature', 401);
        }

        // Get raw body (should be available from express.raw middleware)
        const rawBody = req.body;

        if (!rawBody) {
            throw new AppError('Missing request body for signature validation', 400);
        }

        // Create expected signature
        const expectedSignature = crypto
            .createHmac('sha1', config.STRAVA_WEBHOOK_VERIFY_TOKEN)
            .update(rawBody)
            .digest('hex');

        const expectedSignatureWithPrefix = `sha1=${expectedSignature}`;

        // Compare signatures using timing-safe comparison
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignatureWithPrefix)
        );

        if (!isValid) {
            console.error('❌ Invalid webhook signature:', {
                received: signature,
                expected: expectedSignatureWithPrefix,
            });
            throw new AppError('Invalid webhook signature', 401);
        }

        console.log('✅ Webhook signature validated');
        next();

    } catch (error) {
        if (error instanceof AppError) {
            // Re-throw AppErrors
            next(error);
        } else {
            // Wrap other errors
            next(new AppError('Webhook signature validation failed', 401));
        }
    }
}

/**
 * NOTE: Strava webhook signature validation
 *
 * Currently commented out in the main webhook route because:
 * 1. We're using express.raw() only for webhook endpoint
 * 2. Signature validation needs the raw body, not parsed JSON
 * 3. The middleware order needs to be carefully managed
 *
 * To enable signature validation:
 * 1. Remove express.json() middleware from webhook route
 * 2. Use express.raw() to get raw body
 * 3. Apply this middleware before the webhook handler
 * 4. Parse JSON manually in the webhook handler after validation
 *
 * For MVP, we're skipping this for simplicity, but it should be
 * implemented for production security.
 */