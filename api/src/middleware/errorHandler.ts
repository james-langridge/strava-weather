import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/environment.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly timestamp: string;

    constructor(
        message: string,
        statusCode: number = 500,
        isOperational: boolean = true
    ) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): AppError {
    const messages = error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
    );

    return new AppError(
        `Validation failed: ${messages.join(', ')}`,
        400
    );
}

/**
 * Handle Prisma errors
 */
function handlePrismaError(error: any): AppError {
    switch (error.code) {
        case 'P2002':
            return new AppError('Duplicate entry. Resource already exists.', 409);

        case 'P2025':
            return new AppError('Record not found.', 404);

        case 'P2003':
            return new AppError('Foreign key constraint failed.', 400);

        case 'P2014':
            return new AppError('Invalid data provided.', 400);

        default:
            return new AppError('Database operation failed.', 500);
    }
}

/**
 * Handle Strava API errors
 */
function handleStravaError(error: any): AppError {
    if (error.response?.status === 401) {
        return new AppError('Strava authentication failed. Please reconnect your account.', 401);
    }

    if (error.response?.status === 403) {
        return new AppError('Insufficient permissions for Strava API operation.', 403);
    }

    if (error.response?.status === 429) {
        return new AppError('Strava API rate limit exceeded. Please try again later.', 429);
    }

    if (error.response?.status >= 400 && error.response?.status < 500) {
        return new AppError('Invalid request to Strava API.', 400);
    }

    return new AppError('Strava API is temporarily unavailable.', 503);
}

/**
 * Main error handling middleware
 */
export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    let appError: AppError;

    // Convert known error types to AppError
    if (error instanceof AppError) {
        appError = error;
    } else if (error instanceof ZodError) {
        appError = handleZodError(error);
    } else if (error.name === 'PrismaClientKnownRequestError') {
        appError = handlePrismaError(error);
    } else if (error.message?.includes('strava') || error.message?.includes('Strava')) {
        appError = handleStravaError(error);
    } else {
        // Generic error
        appError = new AppError(
            config.isProduction ? 'Something went wrong.' : error.message,
            500,
            false
        );
    }

    // Log error details
    console.error('🚨 Error occurred:', {
        timestamp: appError.timestamp,
        method: req.method,
        url: req.url,
        statusCode: appError.statusCode,
        message: appError.message,
        stack: config.isDevelopment ? appError.stack : undefined,
        userId: (req as any).user?.id,
        requestId: (req as any).requestId,
    });

    // Send error response
    const errorResponse = {
        error: {
            message: appError.message,
            statusCode: appError.statusCode,
            timestamp: appError.timestamp,
            ...(config.isDevelopment && {
                stack: appError.stack,
                details: error,
            }),
        },
    };

    res.status(appError.statusCode).json(errorResponse);
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);

    // In production, we might want to exit gracefully
    if (config.isProduction) {
        console.error('🛑 Shutting down due to unhandled promise rejection...');
        process.exit(1);
    }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
    console.error('🚨 Uncaught Exception:', error);

    // Always exit on uncaught exceptions
    console.error('🛑 Shutting down due to uncaught exception...');
    process.exit(1);
});

/**
 * Async wrapper for route handlers
 * Catches async errors and passes them to error middleware
 */
export function asyncHandler<T extends Request, U extends Response>(
    fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
    return (req: T, res: U, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
}