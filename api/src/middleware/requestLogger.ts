import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment.js';

/**
 * Enhanced request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // Add request ID to request object for use in other middleware
    (req as any).requestId = requestId;

    // Get client IP address
    const clientIp = getClientIp(req);

    // Log incoming request
    if (config.isDevelopment || shouldLogRequest(req)) {
        console.log(`📥 ${req.method} ${req.url}`, {
            requestId,
            ip: clientIp,
            userAgent: req.headers['user-agent'],
            contentType: req.headers['content-type'],
            timestamp: new Date().toISOString(),
        });
    }

    // Listen for response finish event (cleaner than overriding res.end)
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;

        // Log response details
        if (config.isDevelopment || shouldLogResponse(req, res)) {
            const logLevel = getLogLevel(res.statusCode);
            const logData = {
                requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                responseTime: `${responseTime}ms`,
                contentLength: res.get('content-length') || 0,
                ip: clientIp,
                timestamp: new Date().toISOString(),
            };

            switch (logLevel) {
                case 'error':
                    console.error(`❌ ${req.method} ${req.url} - ${res.statusCode}`, logData);
                    break;
                case 'warn':
                    console.warn(`⚠️ ${req.method} ${req.url} - ${res.statusCode}`, logData);
                    break;
                case 'info':
                default:
                    console.log(`📤 ${req.method} ${req.url} - ${res.statusCode}`, logData);
                    break;
            }
        }
    });

    next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
    return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] as string ||
        req.socket.remoteAddress ||
        'unknown'
    );
}

/**
 * Determine if request should be logged
 */
function shouldLogRequest(req: Request): boolean {
    // Always log webhook requests
    if (req.url.includes('/webhook')) {
        return true;
    }

    // Skip health check logs in production (too noisy)
    if (req.url.includes('/health') && config.isProduction) {
        return false;
    }

    // Log API requests
    if (req.url.startsWith('/api/')) {
        return true;
    }

    return false;
}

/**
 * Determine if response should be logged
 */
function shouldLogResponse(req: Request, res: Response): boolean {
    // Always log errors
    if (res.statusCode >= 400) {
        return true;
    }

    // Always log webhook responses
    if (req.url.includes('/webhook')) {
        return true;
    }

    // Skip health check responses in production
    if (req.url.includes('/health') && config.isProduction) {
        return false;
    }

    return shouldLogRequest(req);
}

/**
 * Get appropriate log level based on status code
 */
function getLogLevel(statusCode: number): 'info' | 'warn' | 'error' {
    if (statusCode >= 500) {
        return 'error';
    }

    if (statusCode >= 400) {
        return 'warn';
    }

    return 'info';
}
