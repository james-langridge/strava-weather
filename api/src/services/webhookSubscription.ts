import { config } from '../config/environment.js';

export interface WebhookSubscription {
    id: number;
    callback_url: string;
    created_at: string;
    updated_at: string;
}

/**
 * Service for managing Strava webhook subscriptions
 */
export class WebhookSubscriptionService {
    private readonly subscriptionUrl = 'https://www.strava.com/api/v3/push_subscriptions';

    /**
     * View current webhook subscription (if any)
     */
    async viewSubscription(): Promise<WebhookSubscription | null> {
        try {
            console.log('🔍 Checking for existing webhook subscription...');

            const url = new URL(this.subscriptionUrl);
            url.searchParams.set('client_id', config.STRAVA_CLIENT_ID);
            url.searchParams.set('client_secret', config.STRAVA_CLIENT_SECRET);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to view subscription: ${response.status} ${errorText}`);
            }

            const data = await response.json();

            // Strava returns an array of subscriptions
            if (Array.isArray(data) && data.length > 0) {
                console.log('✅ Found existing subscription:', data[0]);
                return data[0];
            }

            console.log('ℹ️ No existing webhook subscription found');
            return null;

        } catch (error) {
            console.error('❌ Failed to view webhook subscription:', error);
            throw error;
        }
    }

    /**
     * Create a new webhook subscription
     */
    async createSubscription(callbackUrl: string): Promise<WebhookSubscription> {
        try {
            console.log('🚀 Creating webhook subscription...');
            console.log(`📍 Callback URL: ${callbackUrl}`);

            // First, check if a subscription already exists
            const existing = await this.viewSubscription();
            if (existing) {
                console.log('⚠️ Subscription already exists. Delete it first before creating a new one.');
                throw new Error('Subscription already exists. Delete existing subscription first.');
            }

            const formData = new URLSearchParams({
                client_id: config.STRAVA_CLIENT_ID,
                client_secret: config.STRAVA_CLIENT_SECRET,
                callback_url: callbackUrl,
                verify_token: config.STRAVA_WEBHOOK_VERIFY_TOKEN,
            });

            const response = await fetch(this.subscriptionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create subscription: ${response.status} ${errorText}`);
            }

            const subscription = await response.json();
            console.log('✅ Webhook subscription created successfully:', subscription);

            return subscription;

        } catch (error) {
            console.error('❌ Failed to create webhook subscription:', error);
            throw error;
        }
    }

    /**
     * Delete a webhook subscription
     */
    async deleteSubscription(subscriptionId: number): Promise<void> {
        try {
            console.log(`🗑️ Deleting webhook subscription ${subscriptionId}...`);

            const url = `${this.subscriptionUrl}/${subscriptionId}`;
            const params = new URLSearchParams({
                client_id: config.STRAVA_CLIENT_ID,
                client_secret: config.STRAVA_CLIENT_SECRET,
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'DELETE',
            });

            if (response.status === 204) {
                console.log('✅ Webhook subscription deleted successfully');
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete subscription: ${response.status} ${errorText}`);
            }

        } catch (error) {
            console.error('❌ Failed to delete webhook subscription:', error);
            throw error;
        }
    }

    /**
     * Verify webhook endpoint is accessible
     */
    async verifyEndpoint(callbackUrl: string): Promise<boolean> {
        try {
            console.log('🔍 Verifying webhook endpoint accessibility...');

            const testUrl = new URL(callbackUrl);
            testUrl.searchParams.set('hub.mode', 'subscribe');
            testUrl.searchParams.set('hub.verify_token', config.STRAVA_WEBHOOK_VERIFY_TOKEN);
            testUrl.searchParams.set('hub.challenge', 'test_challenge_123');

            const response = await fetch(testUrl.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`❌ Webhook endpoint returned ${response.status}`);
                return false;
            }

            const data = await response.json();

            if (data['hub.challenge'] === 'test_challenge_123') {
                console.log('✅ Webhook endpoint verified successfully');
                return true;
            }

            console.error('❌ Webhook endpoint did not return expected challenge');
            return false;

        } catch (error) {
            console.error('❌ Failed to verify webhook endpoint:', error);
            return false;
        }
    }
}

export const webhookSubscriptionService = new WebhookSubscriptionService();