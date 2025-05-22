const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import your modules using require
const { config } = require('./src/config/environment');
const { errorHandler } = require('./src/middleware/errorHandler');
const { requestLogger } = require('./src/middleware/requestLogger');

// Route imports
const { healthRouter } = require('./src/routes/health');
const { stravaRouter } = require('./src/routes/strava');
const { authRouter } = require('./src/routes/auth');
const { usersRouter } = require('./src/routes/users');
const { activitiesRouter } = require('./src/routes/activities');

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

// Error handling
app.use(errorHandler);

// Keep this for local development
app.listen(3000, () => console.log('Server ready on port 3000.'));

// Export for Vercel (CommonJS style)
module.exports = app;