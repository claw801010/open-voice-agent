"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import {
    fetchVoiceProfiles,
    type VoiceProfile,
    type VoiceProfileList,
} from "@/lib/voiceProfiles";

export function useOrgVoiceProfiles() {
    const { getAccessToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState<VoiceProfileList | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        const data = await fetchVoiceProfiles(getAccessToken);
        setList(data);
        setLoading(false);
        return data;
    }, [getAccessToken]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const resolveEffectiveProfile = useCallback(
        (workflowVoiceProfileId?: string | null): VoiceProfile | null => {
            if (!list) return null;
            const id =
                workflowVoiceProfileId || list.defaultProfileId || null;
            if (!id) return null;
            return list.profiles.find((p) => p.id === id) ?? null;
        },
        [list],
    );

    return { loading, list, reload, resolveEffectiveProfile };
}
