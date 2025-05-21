import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, type User } from '../lib/api.ts';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    revokeAccess: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasChecked, setHasChecked] = useState(false);

    // Check if user is authenticated on mount
    useEffect(() => {
        if (!hasChecked) {
            checkAuthStatus();
        }
    }, [hasChecked]);

    const checkAuthStatus = async () => {
        try {
            setLoading(true);
            setError(null);

            const currentUser = await api.getCurrentUser();
            setUser(currentUser);

        } catch (error) {
            console.log('Not authenticated:', error);
            setUser(null);
            // Don't set error for unauthenticated users

        } finally {
            setLoading(false);
            setHasChecked(true);
        }
    };

    const login = () => {
        try {
            setError(null);

            // Direct browser redirect to the backend OAuth endpoint
            // This avoids CORS issues by not using fetch/AJAX
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            window.location.href = `${apiBase}/api/auth/strava`;

            // Note: No need to catch errors here as the browser is redirecting
            return Promise.resolve();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            setError(errorMessage);
            throw error;
        }
    };

    const logout = async () => {
        try {
            setError(null);

            await api.logout();
            setUser(null);

            // Redirect to home page
            window.location.href = '/';

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Logout failed';
            setError(errorMessage);
            throw error;
        }
    };

    const revokeAccess = async () => {
        try {
            setError(null);

            await api.revokeAccess();
            setUser(null);

            // Redirect to home page
            window.location.href = '/';

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to revoke access';
            setError(errorMessage);
            throw error;
        }
    };

    const updateUser = (updates: Partial<User>) => {
        if (user) {
            setUser({ ...user, ...updates });
        }
    };

    const refreshUser = async () => {
        if (!user) return;

        try {
            setError(null);
            const currentUser = await api.getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.log('Failed to refresh user:', error);
            // If refresh fails, the user might be logged out
            setUser(null);
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        error,
        login,
        logout,
        revokeAccess,
        updateUser,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}