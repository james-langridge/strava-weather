import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api, type User } from "../lib/api.ts";
import { logger } from "../lib/logger.ts";

/**
 * Authentication context type definition
 *
 * Provides authentication state and methods for the entire application
 */
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

/**
 * Authentication context
 * @internal
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook to access authentication context
 *
 * Must be used within an AuthProvider component tree.
 * Provides access to authentication state and methods.
 *
 * @returns Authentication context value
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, login, logout } = useAuth();
 *   // Use authentication state and methods
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * AuthProvider component props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component
 *
 * Manages authentication state for the entire application.
 * Handles initial authentication check, login/logout flows,
 * and provides authentication context to child components.
 *
 * Features:
 * - Automatic authentication check on mount
 * - Persistent authentication state
 * - Error handling and loading states
 * - Token refresh capabilities
 *
 * @param props - Component props containing children
 * @returns Provider component wrapping children with auth context
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  /**
   * Check authentication status on component mount
   */
  useEffect(() => {
    if (!hasChecked) {
      checkAuthStatus();
    }
  }, [hasChecked]);

  /**
   * Check current authentication status
   *
   * Verifies if the user has a valid session and fetches
   * user data if authenticated. Runs once on mount.
   */
  const checkAuthStatus = async () => {
    // Skip if user is already set
    if (user) return;

    logger.debug("Checking authentication status on mount");

    try {
      setLoading(true);
      setError(null);

      const isAuthenticated = await api.checkAuth();
      logger.debug("Initial auth check result", { isAuthenticated });

      if (!isAuthenticated) {
        logger.info("User not authenticated on mount");
        setUser(null);
        return;
      }

      const currentUser = await api.getCurrentUser();
      logger.info("User authenticated on mount", {
        userId: currentUser.id,
        displayName: currentUser.displayName,
      });

      setUser(currentUser);
    } catch (error) {
      logger.debug("User not authenticated", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setUser(null);
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  };

  /**
   * Handle user login
   *
   * Checks authentication status and fetches user data if authenticated.
   * If not authenticated, redirects to Strava OAuth flow.
   *
   * @throws Error if login fails
   */
  const login = async () => {
    logger.info("Login initiated");

    try {
      setError(null);

      const isAuthenticated = await api.checkAuth();
      logger.debug("Authentication check during login", { isAuthenticated });

      if (isAuthenticated) {
        logger.debug("User authenticated, fetching user data");

        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);

          logger.info("Login successful", {
            userId: currentUser.id,
            displayName: currentUser.displayName,
            stravaAthleteId: currentUser.stravaAthleteId,
          });
        } catch (userError) {
          logger.error(
            "Failed to fetch user data after authentication",
            userError,
          );
          throw userError;
        }
      } else {
        logger.info("User not authenticated, redirecting to Strava OAuth");
        window.location.href = `/api/auth/strava`;
      }
    } catch (error) {
      logger.error("Login failed", error);
      setUser(null);
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";
      setError(errorMessage);
      throw error;
    }
  };

  /**
   * Handle user logout
   *
   * Clears user state, calls logout API endpoint to clear session,
   * and redirects to home page.
   */
  const logout = async () => {
    logger.info("Logout initiated");

    try {
      setError(null);

      // Clear user state immediately for responsive UI
      setUser(null);

      // Call logout endpoint to clear server session
      await api.logout();
      logger.info("Logout successful");

      // Force hard refresh to clear any cached state
      window.location.replace("/");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Logout failed";
      logger.error("Logout failed", error, { errorMessage });
      setError(errorMessage);

      // Even if logout fails, clear user and redirect
      setUser(null);
      window.location.replace("/");
    }
  };

  /**
   * Revoke Strava access
   *
   * Revokes the application's access to user's Strava account,
   * clears user state, and redirects to home page.
   *
   * @throws Error if revocation fails
   */
  const revokeAccess = async () => {
    logger.info("Access revocation initiated");

    try {
      setError(null);

      await api.revokeAccess();
      logger.info("Access revoked successfully");

      setUser(null);

      // Redirect to home page
      window.location.href = "/";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to revoke access";
      logger.error("Failed to revoke access", error, { errorMessage });
      setError(errorMessage);
      throw error;
    }
  };

  /**
   * Update user data locally
   *
   * Updates the user object in state without making an API call.
   * Useful for optimistic updates after settings changes.
   *
   * @param updates - Partial user object with fields to update
   */
  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);

      logger.debug("User state updated locally", {
        userId: user.id,
        updatedFields: Object.keys(updates),
      });
    } else {
      logger.warn("Attempted to update user when no user is logged in");
    }
  };

  /**
   * Refresh user data from server
   *
   * Fetches fresh user data from the API and updates local state.
   * Useful after operations that might change user data on the server.
   */
  const refreshUser = async () => {
    logger.debug("Refreshing user data");

    try {
      setError(null);

      // Verify authentication status
      const isAuthenticated = await api.checkAuth();
      if (!isAuthenticated) {
        logger.info("User no longer authenticated during refresh");
        setUser(null);
        return;
      }

      const currentUser = await api.getCurrentUser();
      setUser(currentUser);

      logger.info("User data refreshed successfully", {
        userId: currentUser.id,
        displayName: currentUser.displayName,
      });
    } catch (error) {
      logger.error("Failed to refresh user data", error);
      // If refresh fails, user might be logged out
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
