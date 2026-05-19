import type { Client } from '@/client/client';
import type { CreateClientConfig } from '@/client/client.gen';

/** Browser or server origin for REST calls (same rules as generated SDK `createClientConfig`). */
export function getBackendPublicBaseUrl(): string {
    const isServer = typeof window === 'undefined';
    if (isServer) {
        return process.env.BACKEND_URL || 'http://api:8000';
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin;
}

export const createClientConfig: CreateClientConfig = (config) => ({
    ...config,
    baseUrl: getBackendPublicBaseUrl(),
});

const clientsWithAuth = new WeakSet<Client>();

/**
 * Register a request interceptor that attaches a fresh access token
 * to every outgoing SDK request. Idempotent per client instance.
 */
export function setupAuthInterceptor(apiClient: Client, getAccessToken: () => Promise<string>) {
    if (clientsWithAuth.has(apiClient)) {
        return;
    }
    clientsWithAuth.add(apiClient);

    apiClient.interceptors.request.use(async (request) => {
        if (request.headers.get('Authorization')) {
            return request;
        }
        try {
            const token = await getAccessToken();
            request.headers.set('Authorization', `Bearer ${token}`);
        } catch {
            // If token retrieval fails, let the request proceed without auth
        }
        return request;
    });
}
