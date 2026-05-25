import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type FillerIntensity = 'off' | 'low' | 'medium';
export type DeliveryTone = 'formal' | 'neutral' | 'warm' | 'empathetic';
export type DeliveryBehavior = 'concise' | 'balanced' | 'consultative';

export type SpeechDeliverySettings = {
    authenticityLevel: number;
    tone: DeliveryTone;
    behavior: DeliveryBehavior;
    enableProfessionalFillers: boolean;
    fillerIntensity: FillerIntensity;
    enableExtendedFillers: boolean;
    extendedFillerPhrases: string[];
    multilingualFillers: Record<string, string[]>;
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
    tone?: string;
    behavior?: string;
    enable_professional_fillers?: boolean;
    filler_intensity?: string;
    enable_extended_fillers?: boolean;
    extended_filler_phrases?: string[];
    multilingual_fillers?: Record<string, string[]>;
    enable_breath_pauses?: boolean;
    stability?: number | null;
    similarity_boost?: number | null;
    speed?: number | null;
};

const TONE_VALUES: DeliveryTone[] = ['formal', 'neutral', 'warm', 'empathetic'];
const BEHAVIOR_VALUES: DeliveryBehavior[] = ['concise', 'balanced', 'consultative'];

function parseTone(raw: string | undefined): DeliveryTone {
    return TONE_VALUES.includes(raw as DeliveryTone) ? (raw as DeliveryTone) : 'neutral';
}

function parseBehavior(raw: string | undefined): DeliveryBehavior {
    return BEHAVIOR_VALUES.includes(raw as DeliveryBehavior)
        ? (raw as DeliveryBehavior)
        : 'balanced';
}

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
        tone: parseTone(raw?.tone),
        behavior: parseBehavior(raw?.behavior),
        enableProfessionalFillers: Boolean(raw?.enable_professional_fillers),
        fillerIntensity,
        enableExtendedFillers: Boolean(raw?.enable_extended_fillers),
        extendedFillerPhrases: Array.isArray(raw?.extended_filler_phrases)
            ? raw!.extended_filler_phrases!.map(String)
            : [],
        multilingualFillers:
            raw?.multilingual_fillers && typeof raw.multilingual_fillers === 'object'
                ? Object.fromEntries(
                      Object.entries(raw.multilingual_fillers).map(([k, v]) => [
                          k,
                          Array.isArray(v) ? v.map(String) : [],
                      ]),
                  )
                : {},
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
        tone: s.tone,
        behavior: s.behavior,
        enable_professional_fillers: s.enableProfessionalFillers,
        filler_intensity: s.fillerIntensity,
        enable_extended_fillers: s.enableExtendedFillers,
        extended_filler_phrases: s.extendedFillerPhrases,
        multilingual_fillers: s.multilingualFillers,
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
    tone: 'neutral',
    behavior: 'balanced',
    enableProfessionalFillers: false,
    fillerIntensity: 'off',
    enableExtendedFillers: false,
    extendedFillerPhrases: [],
    multilingualFillers: {},
    enableBreathPauses: false,
    stability: null,
    similarityBoost: null,
    speed: null,
};

/** Short labels for MK-01 vertical built-in voice profile ids (catalog cards). */
export const VERTICAL_VOICE_PROFILE_LABELS: Record<string, string> = {
    'builtin:vertical_healthcare': 'Healthcare voice',
    'builtin:vertical_retail': 'Retail voice',
    'builtin:vertical_b2b': 'B2B voice',
    'builtin:vertical_insurance': 'Insurance voice',
    'builtin:vertical_hospitality': 'Hospitality voice',
    'builtin:vertical_financial': 'Financial voice',
    'builtin:vertical_smb': 'SMB / franchise voice',
    'builtin:vertical_telecom': 'Telecom / utilities voice',
};

export type CatalogVoicePreview = {
    catalogSlug: string;
    profileId: string;
    profileName: string;
    script: string;
    recommendedVoiceProfileId: string | null;
};

export type VoiceProfilePreviewResult = {
    profileId: string;
    profileName: string;
    script: string;
    audioAvailable: boolean;
    audioBase64: string | null;
    audioContentType: string | null;
    audioSkipReason: string | null;
};

type CatalogVoicePreviewApi = {
    catalog_slug?: string;
    profile_id?: string;
    profile_name?: string;
    script?: string;
    recommended_voice_profile_id?: string | null;
};

type VoiceProfilePreviewApi = {
    profile_id?: string;
    profile_name?: string;
    script?: string;
    audio_available?: boolean;
    audio_base64?: string | null;
    audio_content_type?: string | null;
    audio_skip_reason?: string | null;
};

export async function fetchCatalogVoicePreview(slug: string): Promise<CatalogVoicePreview | null> {
    const base = getBackendPublicBaseUrl();
    try {
        const res = await fetch(
            `${base}/api/v1/catalog/vertical-packs/${encodeURIComponent(slug)}/voice-preview`,
            { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as CatalogVoicePreviewApi;
        return {
            catalogSlug: String(data.catalog_slug ?? slug),
            profileId: String(data.profile_id ?? ''),
            profileName: String(data.profile_name ?? ''),
            script: String(data.script ?? ''),
            recommendedVoiceProfileId: data.recommended_voice_profile_id ?? null,
        };
    } catch {
        return null;
    }
}

export async function previewVoiceProfile(
    getAccessToken: () => Promise<string>,
    profileId: string,
    options?: { text?: string; includeAudio?: boolean },
): Promise<{ ok: true; preview: VoiceProfilePreviewResult } | { ok: false; error: string }> {
    const res = await apiFetch(getAccessToken, `/${encodeURIComponent(profileId)}/preview`, {
        method: 'POST',
        body: JSON.stringify({
            text: options?.text,
            include_audio: options?.includeAudio ?? true,
        }),
    });
    if (!res.ok) return res;
    const data = res.data as VoiceProfilePreviewApi;
    return {
        ok: true,
        preview: {
            profileId: String(data.profile_id ?? profileId),
            profileName: String(data.profile_name ?? ''),
            script: String(data.script ?? ''),
            audioAvailable: Boolean(data.audio_available),
            audioBase64: data.audio_base64 ?? null,
            audioContentType: data.audio_content_type ?? null,
            audioSkipReason: data.audio_skip_reason ?? null,
        },
    };
}
