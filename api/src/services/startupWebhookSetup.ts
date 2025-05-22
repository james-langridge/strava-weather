import { config } from '../config/environment.js';
import { webhookSubscriptionService } from './webhookSubscription.js';

/**
 * Automatically setup webhook subscription on app startup
 */
export async function setupWebhookOnStartup(): Promise<void> {
    try {
        console.log('\n🔄 Checking Strava webhook subscription...');

        // Check if subscription already exists
        const existingSubscription = await webhookSubscriptionService.viewSubscription();

        if (existingSubscription) {
            console.log('✅ Webhook subscription already exists:');
            console.log(`   ID: ${existingSubscription.id}`);
            console.log(`   Callback URL: ${existingSubscription.callback_url}`);
            return;
        }

        console.log('📍 No webhook subscription found. Creating one...');

        // Determine the callback URL based on environment
        let callbackUrl: string;

        if (config.isProduction) {
            // In production, use environment variable or construct from known domain
            const productionUrl = process.env.APP_URL || process.env.VERCEL_URL;

            if (!productionUrl) {
                console.warn('⚠️  No APP_URL or VERCEL_URL found in production.');
                console.warn('   Set APP_URL environment variable to enable automatic webhook setup.');
                console.warn('   Example: APP_URL=https://your-domain.com');
                console.warn('   You can manually setup webhooks using the admin API.');
                return;
            }

            // Ensure URL has protocol
            const baseUrl = productionUrl.startsWith('http')
                ? productionUrl
                : `https://${productionUrl}`;

            callbackUrl = `${baseUrl}/api/strava/webhook`;
        } else {
            // In development, check for ngrok URL or skip
            const ngrokUrl = process.env.NGROK_URL;

            if (!ngrokUrl) {
                console.log('ℹ️  Development mode: No NGROK_URL found.');
                console.log('   To enable webhooks in development:');
                console.log('   1. Install ngrok: https://ngrok.com');
                console.log('   2. Run: ngrok http 3001');
                console.log('   3. Set NGROK_URL=https://your-subdomain.ngrok.io in .env');
                console.log('   4. Restart the server\n');
                return;
            }

            callbackUrl = `${ngrokUrl}/api/strava/webhook`;
        }

        console.log(`📍 Setting up webhook with callback URL: ${callbackUrl}`);

        // Verify the endpoint is accessible before creating subscription
        console.log('🔍 Verifying webhook endpoint accessibility...');
        const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

        if (!isAccessible) {
            console.error('❌ Webhook endpoint is not accessible at:', callbackUrl);
            console.error('   The server may not be fully started or publicly accessible.');
            console.error('   Webhook subscription was not created.');

            if (!config.isProduction) {
                console.log('\n💡 For local development:');
                console.log('   Make sure ngrok is running and NGROK_URL is correct.');
            }
            return;
        }

        // Create the subscription
        const subscription = await webhookSubscriptionService.createSubscription(callbackUrl);

        console.log('\n✅ Webhook subscription created successfully!');
        console.log(`   ID: ${subscription.id}`);
        console.log(`   Callback URL: ${subscription.callback_url}`);
        console.log('   Your app will now receive activity events from Strava.\n');

    } catch (error) {
        // Don't crash the app if webhook setup fails
        console.error('\n❌ Failed to setup webhook subscription:', error instanceof Error ? error.message : error);
        console.error('   The app will continue running without webhooks.');
        console.error('   You can manually setup webhooks later using the admin API.\n');
    }
}

/**
 * Cleanup webhook subscription (for graceful shutdown)
 */
export async function cleanupWebhookOnShutdown(): Promise<void> {
    // Only cleanup in development or if explicitly requested
    if (!config.isDevelopment && process.env.CLEANUP_WEBHOOK_ON_SHUTDOWN !== 'true') {
        return;
    }

    try {
        console.log('\n🧹 Cleaning up webhook subscription...');

        const subscription = await webhookSubscriptionService.viewSubscription();

        if (subscription) {
            await webhookSubscriptionService.deleteSubscription(subscription.id);
            console.log('✅ Webhook subscription deleted');
        }
    } catch (error) {
        console.error('❌ Failed to cleanup webhook:', error instanceof Error ? error.message : error);
    }
}