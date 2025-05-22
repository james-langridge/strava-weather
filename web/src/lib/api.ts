const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

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

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    private getAuthHeaders(): HeadersInit {
        const token = localStorage.getItem('authToken');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`;
        const requestId = `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        console.log(`🌐 [${requestId}] API Request: ${options.method || 'GET'} ${endpoint}`);

        const config: RequestInit = {
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers,
            },
            // Remove credentials: 'include' since we're using Authorization headers now
        };

        try {
            const response = await fetch(url, config);

            console.log(`📡 [${requestId}] API Response: ${response.status} ${endpoint}`);

            if (!response.ok) {
                if (response.status === 401) {
                    console.log(`🔒 [${requestId}] Authentication required for ${endpoint}`);
                    // Clear invalid token and redirect to login
                    localStorage.removeItem('authToken');
                    window.location.href = '/';
                    throw new Error('Authentication required');
                }

                const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
                console.error(`❌ [${requestId}] API Error: ${response.status} ${endpoint}`, errorData);
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ [${requestId}] API Success: ${endpoint}`);
            return data;

        } catch (error) {
            console.error(`💥 [${requestId}] API Exception: ${endpoint}`, error);

            if (error instanceof Error) {
                throw error;
            }

            throw new Error('Network error');
        }
    }

    async getCurrentUser(): Promise<User> {
        const response = await this.request<User>('/api/users/me');
        return response.data!;
    }

    async logout(): Promise<void> {
        // Clear token locally (no need to call backend for token-based auth)
        localStorage.removeItem('authToken');
    }

    async revokeAccess(): Promise<void> {
        await this.request('/api/auth/revoke', { method: 'DELETE' });
        // Clear token after successful revocation
        localStorage.removeItem('authToken');
    }

    // User management
    async updateUserPreferences(preferences: { weatherEnabled?: boolean }): Promise<User> {
        const response = await this.request<User>('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify(preferences),
        });
        return response.data!;
    }

    async deleteAccount(): Promise<void> {
        await this.request('/api/users/me', { method: 'DELETE' });
        // Clear token after account deletion
        localStorage.removeItem('authToken');
    }

    // Health check
    async getHealth(): Promise<{ status: string; timestamp: string; environment: string }> {
        const response = await this.request<{ status: string; timestamp: string; environment: string }>('/api/health');
        return response.data!;
    }

    // Token management methods
    setToken(token: string): void {
        localStorage.setItem('authToken', token);
    }

    getToken(): string | null {
        return localStorage.getItem('authToken');
    }

    clearToken(): void {
        localStorage.removeItem('authToken');
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }
}

// Create singleton instance
export const api = new ApiClient();

// Export types
export type { User, ApiResponse };