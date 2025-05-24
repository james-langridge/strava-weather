import { config } from '../src/config/environment';
import { webhookSubscriptionService } from '../src/services/webhookSubscription';

/**
 * Script to set up Strava webhook subscription
 *
 * Usage:
 * - npm run webhook:setup -- --url https://your-domain.com
 * - npm run webhook:setup -- --delete
 * - npm run webhook:status
 */

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'status';

    console.log('🚀 Strava Webhook Setup Script');
    console.log('==============================\n');

    try {
        switch (command) {
            case 'status':
            case '--status':
                await checkStatus();
                break;

            case 'setup':
            case '--setup':
                const urlIndex = args.findIndex(arg => arg === '--url' || arg === '-u');
                const baseUrl = urlIndex !== -1 ? args[urlIndex + 1] : null;
                await setupWebhook(baseUrl);
                break;

            case 'delete':
            case '--delete':
                await deleteWebhook();
                break;

            case 'help':
            case '--help':
            case '-h':
                showHelp();
                break;

            default:
                console.error(`❌ Unknown command: ${command}\n`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

async function checkStatus() {
    console.log('📍 Checking webhook subscription status...\n');

    const subscription = await webhookSubscriptionService.viewSubscription();

    if (subscription) {
        console.log('✅ Active webhook subscription found:');
        console.log(`   ID: ${subscription.id}`);
        console.log(`   Callback URL: ${subscription.callback_url}`);
        console.log(`   Created: ${subscription.created_at}`);
        console.log(`   Updated: ${subscription.updated_at}`);
    } else {
        console.log('❌ No webhook subscription found');
        console.log('\nTo create a subscription, run:');
        console.log('   npm run webhook:setup -- --url https://your-domain.com');
    }
}

async function setupWebhook(baseUrl: string | null | undefined) {
    console.log('📍 Setting up webhook subscription...\n');

    // Check for existing subscription
    const existing = await webhookSubscriptionService.viewSubscription();
    if (existing) {
        console.log('⚠️  Existing subscription found:');
        console.log(`   ID: ${existing.id}`);
        console.log(`   Callback URL: ${existing.callback_url}`);
        console.log('\nTo delete it and create a new one, run:');
        console.log('   npm run webhook:delete');
        return;
    }

    if (!baseUrl) {
        console.error('❌ Base URL is required for webhook setup\n');
        console.log('Usage:');
        console.log('   npm run webhook:setup -- --url https://your-domain.com');
        console.log('\nFor local development with ngrok:');
        console.log('   npm run webhook:setup -- --url https://your-subdomain.ngrok.io');
        process.exit(1);
    }

    const callbackUrl = `${baseUrl}/api/strava/webhook`;
    console.log(`📍 Callback URL: ${callbackUrl}\n`);

    // Verify endpoint is accessible
    console.log('🔍 Verifying webhook endpoint...');
    const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

    if (!isAccessible) {
        console.error('\n❌ Webhook endpoint is not accessible!');
        console.error('   Make sure your server is running and publicly accessible.');
        console.error('\nFor local development:');
        console.error('   1. Install ngrok: https://ngrok.com');
        console.error('   2. Run: ngrok http 3001');
        console.error('   3. Use the ngrok URL for webhook setup');
        process.exit(1);
    }

    console.log('✅ Webhook endpoint verified\n');

    // Create subscription
    console.log('📝 Creating webhook subscription...');
    const subscription = await webhookSubscriptionService.createSubscription(callbackUrl);

    console.log('\n✅ Webhook subscription created successfully!');
    console.log(`   ID: ${subscription.id}`);
    console.log(`   Callback URL: ${subscription.callback_url}`);
    console.log('\n🎉 Your app will now receive activity events from Strava!');
}

async function deleteWebhook() {
    console.log('🗑️  Deleting webhook subscription...\n');

    const subscription = await webhookSubscriptionService.viewSubscription();

    if (!subscription) {
        console.log('❌ No webhook subscription found to delete');
        return;
    }

    console.log(`📍 Found subscription ID: ${subscription.id}`);
    console.log(`   Callback URL: ${subscription.callback_url}\n`);

    await webhookSubscriptionService.deleteSubscription(subscription.id);

    console.log('✅ Webhook subscription deleted successfully');
}

function showHelp() {
    console.log('Usage:');
    console.log('  npm run webhook:status                           Check webhook subscription status');
    console.log('  npm run webhook:setup -- --url <base-url>        Create webhook subscription');
    console.log('  npm run webhook:delete                           Delete webhook subscription');
    console.log('  npm run webhook:help                             Show this help message');
    console.log('\nExamples:');
    console.log('  npm run webhook:setup -- --url https://your-app.com');
    console.log('  npm run webhook:setup -- --url https://abc123.ngrok.io');
    console.log('\nEnvironment Requirements:');
    console.log('  STRAVA_CLIENT_ID              Your Strava app client ID');
    console.log('  STRAVA_CLIENT_SECRET          Your Strava app client secret');
    console.log('  STRAVA_WEBHOOK_VERIFY_TOKEN   Your webhook verification token');
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});