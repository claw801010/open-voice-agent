import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type FillerIntensity = 'off' | 'low' | 'medium';

export type SpeechDeliverySettings = {
    authenticityLevel: number;
    enableProfessionalFillers: boolean;
    fillerIntensity: FillerIntensity;
    enableBreathPauses: boolean;
    stability: number | null;
    similarityBoost: number | null;
    speed: number | null;
};

export type VoiceProfile = {
    id: string;
    name: string;
    slug: string;
    description: string;
    source: 'builtin' | 'custom' | 'clone';
    isBuiltin: boolean;
    clonedFromId: string | null;
    ttsOverrides: Record<string, unknown>;
    speechSettings: SpeechDeliverySettings;
    tags: string[];
};

export type VoiceProfileList = {
    profiles: VoiceProfile[];
    defaultProfileId: string | null;
};

function formatDetail(detail: unknown): string {
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
            .filter(Boolean)
            .join('; ');
    }
    return 'Request failed';
}

type SpeechSettingsApi = {
    authenticity_level?: number;
    enable_professional_fillers?: boolean;
    filler_intensity?: string;
    enable_breath_pauses?: boolean;
    stability?: number | null;
    similarity_boost?: number | null;
    speed?: number | null;
};

type ProfileApi = {
    id?: string;
    name?: string;
    slug?: string;
    description?: string;
    source?: string;
    is_builtin?: boolean;
    cloned_from_id?: string | null;
    tts_overrides?: Record<string, unknown>;
    speech_settings?: SpeechSettingsApi;
    tags?: string[];
};

function mapSpeechSettings(raw: SpeechSettingsApi | undefined): SpeechDeliverySettings {
    const intensity = raw?.filler_intensity;
    const fillerIntensity: FillerIntensity =
        intensity === 'low' || intensity === 'medium' ? intensity : 'off';
    return {
        authenticityLevel: Number(raw?.authenticity_level ?? 0.65),
        enableProfessionalFillers: Boolean(raw?.enable_professional_fillers),
        fillerIntensity,
        enableBreathPauses: Boolean(raw?.enable_breath_pauses),
        stability: raw?.stability ?? null,
        similarityBoost: raw?.similarity_boost ?? null,
        speed: raw?.speed ?? null,
    };
}

export function mapProfileApi(row: ProfileApi): VoiceProfile {
    return {
        id: String(row.id),
        name: String(row.name),
        slug: String(row.slug ?? ''),
        description: String(row.description ?? ''),
        source: (row.source === 'custom' || row.source === 'clone' ? row.source : 'builtin') as VoiceProfile['source'],
        isBuiltin: Boolean(row.is_builtin),
        clonedFromId: row.cloned_from_id ?? null,
        ttsOverrides: row.tts_overrides ?? {},
        speechSettings: mapSpeechSettings(row.speech_settings),
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    };
}

function mapListApi(data: { profiles?: ProfileApi[]; default_profile_id?: string | null }): VoiceProfileList {
    return {
        profiles: (data.profiles ?? []).map(mapProfileApi),
        defaultProfileId: data.default_profile_id ?? null,
    };
}

function speechSettingsToApi(s: SpeechDeliverySettings): SpeechSettingsApi {
    return {
        authenticity_level: s.authenticityLevel,
        enable_professional_fillers: s.enableProfessionalFillers,
        filler_intensity: s.fillerIntensity,
        enable_breath_pauses: s.enableBreathPauses,
        stability: s.stability,
        similarity_boost: s.similarityBoost,
        speed: s.speed,
    };
}

async function apiFetch(
    getAccessToken: () => Promise<string>,
    path: string,
    init?: RequestInit,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/voice-profiles${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...init?.headers,
        },
    });
    let payload: unknown = null;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }
    if (!res.ok) {
        const detail =
            payload && typeof payload === 'object' && 'detail' in payload
                ? formatDetail((payload as { detail: unknown }).detail)
                : res.statusText;
        return { ok: false, error: detail };
    }
    return { ok: true, data: payload };
}

export async function fetchVoiceProfiles(
    getAccessToken: () => Promise<string>,
): Promise<VoiceProfileList | null> {
    const res = await apiFetch(getAccessToken, '');
    if (!res.ok) return null;
    return mapListApi(res.data as { profiles?: ProfileApi[]; default_profile_id?: string | null });
}

export async function createVoiceProfile(
    getAccessToken: () => Promise<string>,
    body: {
        name: string;
        description?: string;
        speechSettings?: SpeechDeliverySettings;
        tags?: string[];
        cloneFromProfileId?: string;
    },
): Promise<{ ok: true; profile: VoiceProfile } | { ok: false; error: string }> {
    const res = await apiFetch(getAccessToken, '', {
        method: 'POST',
        body: JSON.stringify({
            name: body.name,
            description: body.description ?? '',
            speech_settings: body.speechSettings ? speechSettingsToApi(body.speechSettings) : undefined,
            tags: body.tags ?? [],
            clone_from_profile_id: body.cloneFromProfileId,
        }),
    });
    if (!res.ok) return res;
    return { ok: true, profile: mapProfileApi(res.data as ProfileApi) };
}

export async function cloneVoiceProfile(
    getAccessToken: () => Promise<string>,
    profileId: string,
    name: string,
    description?: string,
): Promise<{ ok: true; profile: VoiceProfile } | { ok: false; error: string }> {
    const res = await apiFetch(getAccessToken, `/${encodeURIComponent(profileId)}/clone`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
    });
    if (!res.ok) return res;
    return { ok: true, profile: mapProfileApi(res.data as ProfileApi) };
}

export async function updateVoiceProfile(
    getAccessToken: () => Promise<string>,
    profileId: string,
    body: {
        name?: string;
        description?: string;
        speechSettings?: SpeechDeliverySettings;
        tags?: string[];
    },
): Promise<{ ok: true; profile: VoiceProfile } | { ok: false; error: string }> {
    const res = await apiFetch(getAccessToken, `/${encodeURIComponent(profileId)}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: body.name,
            description: body.description,
            speech_settings: body.speechSettings ? speechSettingsToApi(body.speechSettings) : undefined,
            tags: body.tags,
        }),
    });
    if (!res.ok) return res;
    return { ok: true, profile: mapProfileApi(res.data as ProfileApi) };
}

export async function deleteVoiceProfile(
    getAccessToken: () => Promise<string>,
    profileId: string,
): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(getAccessToken, `/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true };
}

export async function setOrgDefaultVoiceProfile(
    getAccessToken: () => Promise<string>,
    profileId: string,
): Promise<{ ok: true; list: VoiceProfileList } | { ok: false; error: string }> {
    const res = await apiFetch(getAccessToken, '/org-default', {
        method: 'PUT',
        body: JSON.stringify({ profile_id: profileId }),
    });
    if (!res.ok) return res;
    return { ok: true, list: mapListApi(res.data as { profiles?: ProfileApi[]; default_profile_id?: string | null }) };
}

export const DEFAULT_SPEECH_SETTINGS: SpeechDeliverySettings = {
    authenticityLevel: 0.65,
    enableProfessionalFillers: false,
    fillerIntensity: 'off',
    enableBreathPauses: false,
    stability: null,
    similarityBoost: null,
    speed: null,
};
