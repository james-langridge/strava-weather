import { Router } from 'express';
import { config } from '../config/environment';
import { prisma} from "../lib";
import type { Request, Response, NextFunction } from 'express';

const healthRouter = Router();

interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: {
        database: ServiceStatus;
        strava_api: ServiceStatus;
        weather_api: ServiceStatus;
    };
    performance: {
        memory: NodeJS.MemoryUsage;
        cpu: number;
    };
}

interface ServiceStatus {
    status: 'healthy' | 'unhealthy' | 'unknown';
    responseTime?: number;
    error?: string;
    lastChecked: string;
}

/**
 * GET /api/health - Basic health check
 * Fast endpoint for load balancer health checks
 */
healthRouter.get('/', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        // Quick database check
        await prisma.$queryRaw`SELECT 1`;

        const responseTime = Date.now() - startTime;

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            environment: config.NODE_ENV,
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('Health check failed:', error);

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            environment: config.NODE_ENV,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/detailed - Comprehensive health check
 * Detailed status of all services and dependencies
 */
healthRouter.get('/detailed', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const healthStatus: HealthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0',
            environment: config.NODE_ENV,
            services: {
                database: await checkDatabase(),
                strava_api: await checkStravaAPI(),
                weather_api: await checkWeatherAPI(),
            },
            performance: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage().user / 1000000, // Convert to seconds
            },
        };

        // Determine overall status based on service health
        const serviceStatuses = Object.values(healthStatus.services);
        const unhealthyServices = serviceStatuses.filter(s => s.status === 'unhealthy');
        const unknownServices = serviceStatuses.filter(s => s.status === 'unknown');

        if (unhealthyServices.length > 0) {
            healthStatus.status = 'unhealthy';
        } else if (unknownServices.length > 0) {
            healthStatus.status = 'degraded';
        }

        const statusCode = healthStatus.status === 'healthy' ? 200
            : healthStatus.status === 'degraded' ? 200
                : 503;

        res.status(statusCode).json(healthStatus);

    } catch (error) {
        next(error);
    }
});

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now();

    try {
        await prisma.$queryRaw`SELECT 1 as status`;

        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
        };

    } catch (error) {
        return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Database connection failed',
            lastChecked: new Date().toISOString(),
        };
    }
}

/**
 * Check Strava API accessibility
 */
async function checkStravaAPI(): Promise<ServiceStatus> {
    const startTime = Date.now();

    try {
        // Simple request to Strava API to check if it's accessible
        const response = await fetch(`${config.STRAVA_API_BASE_URL}/athlete`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        // We expect 401 (unauthorized) which means API is accessible
        const isAccessible = response.status === 401 || response.status === 200;

        return {
            status: isAccessible ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: !isAccessible ? `Unexpected status: ${response.status}` : '',
        };

    } catch (error) {
        return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Strava API unreachable',
            lastChecked: new Date().toISOString(),
        };
    }
}

/**
 * Check Weather API accessibility
 */
async function checkWeatherAPI(): Promise<ServiceStatus> {
    const startTime = Date.now();

    try {
        // Test request to OpenWeatherMap API
        const testUrl = `${config.OPENWEATHERMAP_API_BASE_URL}/weather?lat=0&lon=0&appid=${config.OPENWEATHERMAP_API_KEY}`;
        const response = await fetch(testUrl);

        const isAccessible = response.status === 200 || response.status === 400; // 400 is acceptable (invalid coords)

        return {
            status: isAccessible ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: !isAccessible ? `Unexpected status: ${response.status}` : '',
        };

    } catch (error) {
        return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Weather API unreachable',
            lastChecked: new Date().toISOString(),
        };
    }
}

/**
 * GET /api/health/ready - Readiness probe
 * For Kubernetes-style readiness checks
 */
healthRouter.get('/ready', async (req: Request, res: Response) => {
    try {
        // Check critical dependencies only
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Critical dependency failure',
        });
    }
});

/**
 * GET /api/health/live - Liveness probe
 * For Kubernetes-style liveness checks
 */
healthRouter.get('/live', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

export { healthRouter  };