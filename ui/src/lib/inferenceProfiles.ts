import { getBackendPublicBaseUrl } from '@/lib/apiClient';
import type { UserConfigurationRequestResponseSchema } from '@/client/types.gen';

export type InferenceProfileTier = 'cloud' | 'local' | 'hybrid';

export type LocalModelRef = {
    runtime: string;
    model: string;
    size_hint_mb?: number;
    purpose?: string;
};

export type InferenceProfileSummary = {
    id: string;
    label: string;
    tier: InferenceProfileTier;
    summary: string;
    edge_notes: string;
    local_models: LocalModelRef[];
    requires_api_keys: boolean;
};

export type LocalComponentStatus = {
    id: string;
    label: string;
    installed: boolean;
    reachable: boolean;
    ready: boolean;
    models_present: string[];
    models_required: string[];
    endpoint: string;
    hint: string;
};

export type LocalInferenceCapabilities = {
    version: number;
    default_profile_id: string;
    local_stack_ready: boolean;
    docker_available: boolean;
    prefer_local_defaults: boolean;
    components: LocalComponentStatus[];
};

export type InferenceProfileListResponse = {
    version: number;
    profiles: InferenceProfileSummary[];
    active_profile_id: string | null;
    default_profile_id: string;
    capabilities: LocalInferenceCapabilities | null;
};

export type ApplyInferenceProfileResponse = {
    profile_id: string;
    label: string | null;
    tier: InferenceProfileTier | null;
    local_models: LocalModelRef[];
    configuration: UserConfigurationRequestResponseSchema;
    warnings: string[];
};

export type LocalInferenceSetupResponse = {
    steps: { id: string; status: string; message: string }[];
    capabilities: LocalInferenceCapabilities;
    applied_profile_id: string | null;
    configuration: UserConfigurationRequestResponseSchema | null;
};

async function authHeaders(getAccessToken: () => Promise<string | null>): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Sign in to manage inference profiles');
    }
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function fetchInferenceProfiles(
    getAccessToken: () => Promise<string | null>,
): Promise<InferenceProfileListResponse> {
    const base = getBackendPublicBaseUrl();
    const res = await fetch(`${base}/api/v1/inference-profiles`, {
        headers: await authHeaders(getAccessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to load inference profiles (${res.status})`);
    }
    return res.json() as Promise<InferenceProfileListResponse>;
}

export async function fetchLocalInferenceCapabilities(
    getAccessToken: () => Promise<string | null>,
): Promise<LocalInferenceCapabilities> {
    const base = getBackendPublicBaseUrl();
    const res = await fetch(`${base}/api/v1/inference-profiles/capabilities`, {
        headers: await authHeaders(getAccessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to scan local inference (${res.status})`);
    }
    return res.json() as Promise<LocalInferenceCapabilities>;
}

export async function setupLocalInference(
    getAccessToken: () => Promise<string | null>,
    options?: { startSpeaches?: boolean; pullOllama?: boolean; applyProfileId?: string | null },
): Promise<LocalInferenceSetupResponse> {
    const base = getBackendPublicBaseUrl();
    const res = await fetch(`${base}/api/v1/inference-profiles/setup`, {
        method: 'POST',
        headers: await authHeaders(getAccessToken),
        body: JSON.stringify({
            start_speaches: options?.startSpeaches ?? true,
            pull_ollama: options?.pullOllama ?? true,
            apply_profile_id: options?.applyProfileId ?? 'local_edge_lean',
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Setup failed (${res.status})`);
    }
    return res.json() as Promise<LocalInferenceSetupResponse>;
}

export async function applyInferenceProfile(
    profileId: string,
    getAccessToken: () => Promise<string | null>,
): Promise<ApplyInferenceProfileResponse> {
    const base = getBackendPublicBaseUrl();
    const res = await fetch(`${base}/api/v1/inference-profiles/${encodeURIComponent(profileId)}/apply`, {
        method: 'POST',
        headers: await authHeaders(getAccessToken),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Failed to apply profile (${res.status})`);
    }
    return res.json() as Promise<ApplyInferenceProfileResponse>;
}

export function tierBadgeClass(tier: InferenceProfileTier): string {
    switch (tier) {
        case 'local':
            return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
        case 'hybrid':
            return 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/25';
        default:
            return 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/25';
    }
}

export function componentStatusLabel(c: LocalComponentStatus): 'ready' | 'partial' | 'offline' {
    if (c.ready) return 'ready';
    if (c.reachable || c.installed) return 'partial';
    return 'offline';
}
