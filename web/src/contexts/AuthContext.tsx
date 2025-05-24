import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type User } from '../lib/api.ts';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (token?: string) => Promise<void>;
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
        // Skip if we're already in the process of setting a user
        if (user) return;

        try {
            setLoading(true);
            setError(null);

            const isAuthenticated = await api.checkAuth();

            if (!isAuthenticated) {
                setUser(null);
                return;
            }

            const currentUser = await api.getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.log('Not authenticated:', error);
            setUser(null);
        } finally {
            setLoading(false);
            setHasChecked(true);
        }
    };

    const login = async () => {
        try {
            setError(null);

            console.log('🔍 Checking authentication status...');
            const isAuthenticated = await api.checkAuth();
            console.log('🔐 Authentication check result:', isAuthenticated);

            if (isAuthenticated) {
                console.log('✅ User is authenticated, fetching user data...');
                try {
                    const currentUser = await api.getCurrentUser();
                    console.log('👤 User data fetched:', currentUser);
                    setUser(currentUser);
                    console.log('✅ Login successful:', currentUser.displayName);
                } catch (userError) {
                    console.error('❌ Failed to fetch user data:', userError);
                    throw userError;
                }
            } else {
                console.log('❌ Not authenticated');
                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                window.location.href = `${apiBase}/api/auth/strava`;
            }

        } catch (error) {
            console.error('❌ Login failed:', error);
            setUser(null);
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            setError(errorMessage);
            throw error;
        }
    };

    const logout = async () => {
        try {
            setError(null);

            // First, clear the user state immediately
            setUser(null);

            // Then call logout endpoint to clear cookie
            await api.logout();

            // Force a hard refresh to clear any cached state
            window.location.replace('/');  // Use replace instead of href

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Logout failed';
            setError(errorMessage);
            // Even if logout fails, clear user and redirect
            setUser(null);
            window.location.replace('/');
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
        try {
            setError(null);

            // Check if still authenticated
            const isAuthenticated = await api.checkAuth();
            if (!isAuthenticated) {
                setUser(null);
                return;
            }

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