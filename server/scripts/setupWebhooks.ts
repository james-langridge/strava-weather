import { config } from '../src/config/environment';
import { webhookSubscriptionService } from '../src/services/webhookSubscription';
import { logger } from '../src/utils/logger';

/**
 * Strava webhook subscription management CLI
 *
 * Manages the lifecycle of Strava webhook subscriptions including
 * creation, deletion, and status checking. Handles both development
 * (with ngrok) and production environments.
 *
 * @example
 * npm run webhook:status
 * npm run webhook:setup -- --url https://your-domain.com
 * npm run webhook:delete
 */

interface CliCommand {
    name: string;
    aliases: string[];
    handler: (args: string[]) => Promise<void>;
    description: string;
}

const commands: CliCommand[] = [
    {
        name: 'status',
        aliases: ['--status', '-s'],
        handler: checkStatus,
        description: 'Check webhook subscription status',
    },
    {
        name: 'setup',
        aliases: ['--setup', 'create', '--create'],
        handler: setupWebhook,
        description: 'Create webhook subscription',
    },
    {
        name: 'delete',
        aliases: ['--delete', 'remove', '--remove'],
        handler: deleteWebhook,
        description: 'Delete webhook subscription',
    },
    {
        name: 'help',
        aliases: ['--help', '-h'],
        handler: async () => showHelp(),
        description: 'Show help message',
    },
];

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const commandName = args[0] || 'status';

    logHeader();

    try {
        const command = findCommand(commandName);

        if (!command) {
            logger.error('Unknown command', { command: commandName });
            showHelp();
            process.exit(1);
        }

        await command.handler(args);
        process.exit(0);
    } catch (error) {
        logger.error('Script execution failed', error);
        process.exit(1);
    }
}

/**
 * Find command by name or alias
 */
function findCommand(name: string): CliCommand | undefined {
    return commands.find(
        cmd => cmd.name === name || cmd.aliases.includes(name)
    );
}

/**
 * Display script header
 */
function logHeader(): void {
    console.log('Strava Webhook Setup Script');
    console.log('===========================\n');
}

/**
 * Check current webhook subscription status
 */
async function checkStatus(): Promise<void> {
    logger.info('Checking webhook subscription status');

    try {
        const subscription = await webhookSubscriptionService.viewSubscription();

        if (subscription) {
            logger.info('Active webhook subscription found', {
                id: subscription.id,
                callbackUrl: subscription.callback_url,
                createdAt: subscription.created_at,
                updatedAt: subscription.updated_at,
            });
        } else {
            logger.warn('No webhook subscription found');
            console.log('\nTo create a subscription:');
            console.log('  npm run webhook:setup');
            console.log('  npm run webhook:setup -- --url https://your-domain.com');
        }
    } catch (error) {
        logger.error('Failed to check webhook status', error);
        throw error;
    }
}

/**
 * Create new webhook subscription
 */
async function setupWebhook(args: string[]): Promise<void> {
    logger.info('Setting up webhook subscription');

    // Check for existing subscription
    const existing = await webhookSubscriptionService.viewSubscription();
    if (existing) {
        logger.warn('Existing subscription found', {
            id: existing.id,
            callbackUrl: existing.callback_url,
        });
        console.log('\nTo replace it:');
        console.log('  1. Delete existing: npm run webhook:delete');
        console.log('  2. Create new: npm run webhook:setup');
        return;
    }

    // Determine callback URL
    const callbackUrl = await resolveCallbackUrl(args);
    logger.info('Using callback URL', { callbackUrl });

    // Verify endpoint accessibility
    logger.info('Verifying webhook endpoint accessibility');
    const isAccessible = await webhookSubscriptionService.verifyEndpoint(callbackUrl);

    if (!isAccessible) {
        logger.error('Webhook endpoint is not accessible', { callbackUrl });
        console.error('\nTroubleshooting:');
        console.error('  - Ensure your server is running');
        console.error('  - Check the URL is publicly accessible');
        console.error('  - Verify firewall/security group settings');

        if (config.isDevelopment) {
            console.error('\nFor local development:');
            console.error('  - Start server: npm run dev:server');
            console.error('  - Start ngrok: ngrok http 3001');
            console.error('  - Update NGROK_URL in .env');
        }

        throw new Error('Webhook endpoint verification failed');
    }

    logger.info('Webhook endpoint verified');

    // Create subscription
    try {
        const subscription = await webhookSubscriptionService.createSubscription(callbackUrl);

        logger.info('Webhook subscription created successfully', {
            id: subscription.id,
            callbackUrl: subscription.callback_url,
        });

        console.log('\nYour app will now receive Strava activity events.');
    } catch (error) {
        logger.error('Failed to create webhook subscription', error);
        throw error;
    }
}

/**
 * Delete existing webhook subscription
 */
async function deleteWebhook(): Promise<void> {
    logger.info('Deleting webhook subscription');

    const subscription = await webhookSubscriptionService.viewSubscription();

    if (!subscription) {
        logger.warn('No webhook subscription found to delete');
        return;
    }

    logger.info('Found subscription to delete', {
        id: subscription.id,
        callbackUrl: subscription.callback_url,
    });

    try {
        await webhookSubscriptionService.deleteSubscription(subscription.id);
        logger.info('Webhook subscription deleted successfully');
    } catch (error) {
        logger.error('Failed to delete webhook subscription', error);
        throw error;
    }
}

/**
 * Resolve callback URL based on environment and arguments
 */
async function resolveCallbackUrl(args: string[]): Promise<string> {
    // Check for custom URL argument
    const urlIndex = args.findIndex(arg => arg === '--url' || arg === '-u');
    const customUrl = urlIndex !== -1 ? args[urlIndex + 1] : null;

    if (customUrl) {
        return `${customUrl}/api/strava/webhook`;
    }

    // Development environment requires public URL
    if (config.isDevelopment) {
        const ngrokUrl = process.env.NGROK_URL;

        if (!ngrokUrl) {
            console.error('\nDevelopment environment requires a public URL.');
            console.error('\nOption 1 - Use ngrok:');
            console.error('  1. Install: https://ngrok.com');
            console.error('  2. Start tunnel: ngrok http 3001');
            console.error('  3. Run: npm run webhook:setup -- --url https://[subdomain].ngrok.io');
            console.error('\nOption 2 - Set environment variable:');
            console.error('  1. Add to .env: NGROK_URL=https://[subdomain].ngrok.io');
            console.error('  2. Run: npm run webhook:setup');

            throw new Error('Public URL required for development environment');
        }

        return `${ngrokUrl}/api/strava/webhook`;
    }

    // Production uses configured APP_URL
    return `${config.APP_URL}/api/strava/webhook`;
}

/**
 * Display help information
 */
function showHelp(): void {
    console.log('\nUsage: npm run webhook:<command> [options]');
    console.log('\nCommands:');

    commands.forEach(cmd => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        console.log(`  ${cmd.name.padEnd(10)} ${cmd.description}${aliases}`);
    });

    console.log('\nOptions:');
    console.log('  --url, -u <url>  Specify custom callback URL');

    console.log('\nExamples:');
    console.log('  npm run webhook:status');
    console.log('  npm run webhook:setup -- --url https://your-app.vercel.app');
    console.log('  npm run webhook:setup -- --url https://abc123.ngrok.io');
    console.log('  npm run webhook:delete');

    console.log('\nRequired Environment Variables:');
    console.log('  APP_URL                      - Application base URL');
    console.log('  STRAVA_CLIENT_ID             - Strava OAuth client ID');
    console.log('  STRAVA_CLIENT_SECRET         - Strava OAuth client secret');
    console.log('  STRAVA_WEBHOOK_VERIFY_TOKEN  - Webhook verification token');

    console.log('\nOptional Environment Variables:');
    console.log('  NGROK_URL                    - Public tunnel URL for development');
}

// Execute script
if (require.main === module) {
    main().catch(error => {
        logger.error('Fatal error', error);
        process.exit(1);
    });
}