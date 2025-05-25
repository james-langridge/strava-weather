import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../src/config/environment';
import { errorHandler} from "../src/middleware/errorHandler";
import { requestLogger} from "../src/middleware/requestLogger";

import { healthRouter} from "../src/routes/health";
import { stravaRouter } from '../src/routes/strava';
import { authRouter } from '../src/routes/auth';
import { usersRouter } from '../src/routes/users';
import { activitiesRouter } from '../src/routes/activities';
import { adminRouter } from '../src/routes/admin';

const app = express();

// CORS configuration
const corsOptions = {
    // In production, we're on the same domain so no CORS needed
    // In development, Vite proxy handles it, so we can be permissive
    origin: config.isProduction ? false : true,
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser()); // Must be before routes
app.use(requestLogger);

app.use('/api/health', healthRouter);
app.use('/api/strava', stravaRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
    const port = config.PORT;
    const server = app.listen(port, async () => {
        console.log(`✅ Server running on http://localhost:${port}`);
        console.log(`🌍 Environment: ${config.NODE_ENV}`);
        console.log(`🏥 Health check: http://localhost:${port}/api/health`);
        console.log(`🔗 Webhook endpoint: http://localhost:${port}/api/strava/webhook`);
        console.log(`🔐 OAuth flow: http://localhost:${port}/api/auth/strava`);
        console.log(`👨‍💼 Admin endpoints: http://localhost:${port}/api/admin/webhook/*`);
        console.log(`🍪 Cookie domain: ${config.APP_URL}`);
        console.log(`\n💡 Frontend dev server should be running on ${config.APP_URL}`);
        console.log(`   API requests will be proxied from ${config.APP_URL}/api/* to this server`);
    });

    const gracefulShutdown = async (signal: string) => {
        console.log(`\n📴 ${signal} received, starting graceful shutdown...`);

        server.close(async () => {
            console.log('🚪 Server closed');

            // Cleanup webhook if needed (only in dev by default)
            const { cleanupWebhookOnShutdown } = await import('../src/services/startupWebhookSetup');
            await cleanupWebhookOnShutdown();

            process.exit(0);
        });

        setTimeout(() => {
            console.error('❌ Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;