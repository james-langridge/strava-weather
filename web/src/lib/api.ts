import { logger } from "../lib/logger";

/**
 * API configuration
 *
 * API requests always use relative paths:
 * - In production: served from same domain
 * - In development: Vite proxies /api/* to Express server
 */
const API_BASE = "/api";

/**
 * Standard API response wrapper
 *
 * All API endpoints return responses in this format for consistency
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * User model interface
 *
 * Represents the authenticated user with their profile
 * information and activity statistics
 */
interface User {
  id: string;
  stravaAthleteId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  location: string | null;
  weatherEnabled: boolean;
  stats: {
    totalActivitiesProcessed: number;
    activitiesLast30Days: number;
    failedLast30Days: number;
  };
  memberSince: string;
  lastUpdated: string;
}

/**
 * API error class for better error handling
 */
class ApiError extends Error {
  status?: number;
  endpoint?: string;

  constructor(message: string, status?: number, endpoint?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

/**
 * API client for frontend-backend communication
 *
 * Handles all HTTP requests to the backend API with:
 * - Automatic JSON parsing
 * - Cookie-based authentication
 * - Consistent error handling
 * - Request/response logging
 * - Automatic redirects for auth failures
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
    logger.debug("API client initialized", { baseUrl });
  }

  /**
   * Generate unique request ID for tracing
   *
   * @returns Unique request identifier
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Make HTTP request to API endpoint
   *
   * @param endpoint - API endpoint path (e.g., '/users/me')
   * @param options - Fetch API options
   * @returns Parsed API response
   * @throws ApiError for non-2xx responses
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestId = this.generateRequestId();
    const method = options.method || "GET";

    logger.debug("API request initiated", {
      requestId,
      method,
      endpoint,
      hasBody: !!options.body,
    });

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      // Include cookies with every request for session auth
      credentials: "include",
    };

    try {
      const startTime = performance.now();
      const response = await fetch(url, config);
      const duration = Math.round(performance.now() - startTime);

      logger.debug("API response received", {
        requestId,
        status: response.status,
        endpoint,
        durationMs: duration,
      });

      // Handle non-OK responses
      if (!response.ok) {
        await this.handleErrorResponse(response, endpoint, requestId);
      }

      // Parse successful response
      const data = await response.json();

      logger.info("API request successful", {
        requestId,
        endpoint,
        method,
        status: response.status,
        durationMs: duration,
      });

      return data;
    } catch (error) {
      // Log network errors or other exceptions
      logger.error("API request failed", error, {
        requestId,
        endpoint,
        method,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        error instanceof Error ? error.message : "Network error",
        undefined,
        endpoint,
      );
    }
  }

  /**
   * Handle error responses from API
   *
   * @param response - Fetch response object
   * @param endpoint - API endpoint that failed
   * @param requestId - Request ID for tracing
   * @throws ApiError with appropriate message
   */
  private async handleErrorResponse(
    response: Response,
    endpoint: string,
    requestId: string,
  ): Promise<never> {
    let errorData: any;

    try {
      errorData = await response.json();
    } catch {
      errorData = { error: "Request failed" };
    }

    const errorMessage =
      errorData.error || errorData.message || `HTTP ${response.status}`;

    // Handle authentication errors
    if (response.status === 401) {
      logger.info("Authentication required", {
        requestId,
        endpoint,
        status: response.status,
      });

      // Don't redirect for auth check endpoint
      if (!endpoint.includes("/auth/check")) {
        logger.info("Redirecting to login", { requestId });
        window.location.href = "/";
      }

      throw new ApiError("Authentication required", 401, endpoint);
    }

    // Log other errors
    logger.error("API error response", new Error(errorMessage), {
      requestId,
      endpoint,
      status: response.status,
      errorData,
    });

    throw new ApiError(errorMessage, response.status, endpoint);
  }

  /**
   * Get current authenticated user
   *
   * @returns Current user data
   * @throws ApiError if not authenticated or request fails
   */
  async getCurrentUser(): Promise<User> {
    const response = await this.request<User>("/users/me");

    if (!response.data) {
      throw new ApiError("No user data returned", undefined, "/users/me");
    }

    return response.data;
  }

  /**
   * Log out current user
   *
   * Clears session cookie on the server
   *
   * @throws ApiError if logout fails
   */
  async logout(): Promise<void> {
    await this.request("/auth/logout", { method: "POST" });
  }

  /**
   * Revoke Strava access
   *
   * Revokes the application's access to user's Strava account
   * and removes user data from the system
   *
   * @throws ApiError if revocation fails
   */
  async revokeAccess(): Promise<void> {
    await this.request("/auth/revoke", { method: "DELETE" });
  }

  /**
   * Check if user is authenticated
   *
   * Verifies if the current session cookie is valid
   *
   * @returns True if authenticated, false otherwise
   */
  async checkAuth(): Promise<boolean> {
    try {
      const response = await this.request<{ authenticated: boolean }>(
        "/auth/check",
      );
      return response.data?.authenticated === true;
    } catch (error) {
      // Log at debug level as this is expected when not authenticated
      logger.debug("Authentication check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Update user preferences
   *
   * @param preferences - Preferences to update
   * @returns Updated user data
   * @throws ApiError if update fails
   */
  async updateUserPreferences(preferences: {
    weatherEnabled?: boolean;
  }): Promise<User> {
    const response = await this.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });

    if (!response.data) {
      throw new ApiError("No user data returned", undefined, "/users/me");
    }

    return response.data;
  }

  /**
   * Delete user account
   *
   * Permanently deletes the user account and all associated data
   *
   * @throws ApiError if deletion fails
   */
  async deleteAccount(): Promise<void> {
    await this.request("/users/me", { method: "DELETE" });
  }

  /**
   * Get API health status
   *
   * @returns Health check data including status and environment
   * @throws ApiError if health check fails
   */
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    environment: string;
  }> {
    const response = await this.request<{
      status: string;
      timestamp: string;
      environment: string;
    }>("/health");

    if (!response.data) {
      throw new ApiError("No health data returned", undefined, "/health");
    }

    return response.data;
  }
}

// Create singleton instance
export const api = new ApiClient();

// Export types
export type { User, ApiResponse, ApiError };
