import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../src/config/environment.js';
import { errorHandler} from "../src/middleware/errorHandler.js";
import { requestLogger} from "../src/middleware/requestLogger.js";

// Route imports
import { healthRouter} from "../src/routes/health.js";
import { stravaRouter } from '../src/routes/strava.js';
import { authRouter } from '../src/routes/auth.js';
import { usersRouter } from '../src/routes/users.js';
import { activitiesRouter } from '../src/routes/activities.js';
import { adminRouter } from '../src/routes/admin.js';

const app = express();

// Middleware
app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/strava', stravaRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/admin', adminRouter);

// Error handling
app.use(errorHandler);

// Start server
const port = config.PORT;
const server = app.listen(port, async () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`🏥 Health check: http://localhost:${port}/api/health`);
    console.log(`🔗 Webhook endpoint: http://localhost:${port}/api/strava/webhook`);
    console.log(`🔐 OAuth flow: http://localhost:${port}/api/auth/strava`);
    console.log(`👨‍💼 Admin endpoints: http://localhost:${port}/api/admin/webhook/*`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`\n📴 ${signal} received, starting graceful shutdown...`);

    // Close server to stop accepting new connections
    server.close(async () => {
        console.log('🚪 Server closed');

        // Cleanup webhook if needed (only in dev by default)
        const { cleanupWebhookOnShutdown } = await import('../src/services/startupWebhookSetup.js');
        await cleanupWebhookOnShutdown();

        // Exit process
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));