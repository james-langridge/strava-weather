import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, isDevelopment } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Route imports
import { healthRouter } from './routes/health';
import { stravaRouter } from './routes/strava';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { activitiesRouter } from './routes/activities'; // ← ADD THIS

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
app.use('/api/activities', activitiesRouter); // ← ADD THIS

// Error handling
app.use(errorHandler);

// Start server
const port = parseInt(config.PORT);
app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`🏥 Health check: http://localhost:${port}/api/health`);
    console.log(`🔗 Webhook endpoint: http://localhost:${port}/api/strava/webhook`);
    console.log(`🔐 OAuth flow: http://localhost:${port}/api/auth/strava`);
});