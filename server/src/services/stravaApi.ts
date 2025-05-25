import {config} from '../config/environment';
import { encryptionService } from './encryption';

export interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    start_date: string;
    start_date_local: string;
    timezone: string;
    start_latlng: [number, number] | null;
    end_latlng: [number, number] | null;
    location_city?: string;
    location_state?: string;
    location_country?: string;
    achievement_count: number;
    kudos_count: number;
    comment_count: number;
    athlete_count: number;
    photo_count: number;
    description?: string;
    private: boolean;
    visibility: string;
}

export interface StravaUpdateData {
    name?: string;
    type?: string;
    description?: string;
    gear_id?: string;
    trainer?: boolean;
    commute?: boolean;
}

/**
 * Service for interacting with Strava API
 */
export class StravaApiService {
    private readonly baseUrl = 'https://www.strava.com/api/v3';

    /**
     * Get specific activity by ID
     */
    async getActivity(activityId: string, encryptedAccessToken: string): Promise<StravaActivity> {
        try {
            console.log(`🏃 Fetching activity ${activityId} from Strava`);

            // Decrypt the access token
            const accessToken = encryptionService.decrypt(encryptedAccessToken);

            const response = await fetch(`${this.baseUrl}/activities/${activityId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Strava access token expired or invalid');
                }
                if (response.status === 404) {
                    throw new Error('Activity not found or not accessible');
                }
                const errorText = await response.text();
                throw new Error(`Strava API error (${response.status}): ${errorText}`);
            }

            const activity: StravaActivity = await response.json();

            console.log(`✅ Activity retrieved: ${activity.name} (${activity.type})`);

            return activity;

        } catch (error) {
            console.error(`Failed to fetch activity ${activityId}:`, error);
            throw error;
        }
    }

    /**
     * Update an activity on Strava
     */
    async updateActivity(
        activityId: string,
        encryptedAccessToken: string,
        updateData: StravaUpdateData
    ): Promise<StravaActivity> {
        try {
            console.log(`🔄 Updating activity ${activityId} on Strava`);

            // Decrypt the access token
            const accessToken = encryptionService.decrypt(encryptedAccessToken);

            const response = await fetch(`${this.baseUrl}/activities/${activityId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Strava access token expired or invalid');
                }
                if (response.status === 404) {
                    throw new Error('Activity not found or not accessible');
                }
                if (response.status === 403) {
                    throw new Error('Not authorized to update this activity');
                }
                const errorText = await response.text();
                throw new Error(`Strava API error (${response.status}): ${errorText}`);
            }

            const updatedActivity: StravaActivity = await response.json();

            console.log(`✅ Activity ${activityId} updated successfully`);

            return updatedActivity;

        } catch (error) {
            console.error(`Failed to update activity ${activityId}:`, error);
            throw error;
        }
    }

    /**
     * Refresh an expired access token
     */
    async refreshAccessToken(encryptedRefreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: number;
    }> {
        try {
            console.log('🔄 Refreshing Strava access token');

            // Decrypt the refresh token
            const refreshToken = encryptionService.decrypt(encryptedRefreshToken);

            const response = await fetch(config.api.strava.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: config.STRAVA_CLIENT_ID,
                    client_secret: config.STRAVA_CLIENT_SECRET,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
            }

            const tokenData = await response.json();

            console.log('✅ Access token refreshed successfully');

            return {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_at,
            };

        } catch (error) {
            console.error('Failed to refresh access token:', error);
            throw error;
        }
    }

    /**
     * Check if access token needs refresh and refresh if necessary
     * Returns encrypted tokens
     */
    async ensureValidToken(
        encryptedAccessToken: string,
        encryptedRefreshToken: string,
        expiresAt: Date
    ): Promise<{
        accessToken: string;  // Encrypted
        refreshToken: string; // Encrypted
        expiresAt: Date;
        wasRefreshed: boolean;
    }> {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        // If token expires within 5 minutes, refresh it
        if (expiresAt <= fiveMinutesFromNow) {
            console.log('🔄 Access token expires soon, refreshing...');

            const tokenData = await this.refreshAccessToken(encryptedRefreshToken);

            // Encrypt the new tokens before returning
            return {
                accessToken: encryptionService.encrypt(tokenData.access_token),
                refreshToken: encryptionService.encrypt(tokenData.refresh_token),
                expiresAt: new Date(tokenData.expires_at * 1000),
                wasRefreshed: true,
            };
        }

        return {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            wasRefreshed: false,
        };
    }

    /**
     * Revoke access token
     */
    async revokeToken(encryptedAccessToken: string): Promise<void> {
        try {
            console.log('🔐 Revoking Strava access token');

            // Decrypt the access token
            const accessToken = encryptionService.decrypt(encryptedAccessToken);

            const response = await fetch('https://www.strava.com/oauth/deauthorize', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.warn(`Token revocation returned ${response.status}, but continuing...`);
            } else {
                console.log('✅ Access token revoked successfully');
            }

        } catch (error) {
            console.warn('Failed to revoke access token:', error);
            // Don't throw - revocation failure shouldn't prevent logout
        }
    }
}

export const stravaApiService = new StravaApiService();