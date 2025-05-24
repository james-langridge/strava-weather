import { config } from '../config/environment';
import { setupWebhookOnStartup } from '../services/startupWebhookSetup';

let initialized = false;

export async function ensureWebhooksInitialized(): Promise<void> {
    if (initialized || !config.isProduction) {
        return;
    }

    initialized = true;

    // Run webhook setup asynchronously
    setupWebhookOnStartup().catch(error => {
        console.error('Failed to setup webhooks:', error);
        // Don't throw - we don't want to break the app if webhook setup fails
    });
}