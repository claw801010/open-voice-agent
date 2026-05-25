"use client";

import { VoiceProfilesManager } from "@/components/voice/VoiceProfilesManager";

export default function VoiceProfilesPage() {
    return (
        <div className="flex justify-center py-12 px-4">
            <div className="w-full max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Voice profiles</h1>
                    <p className="text-muted-foreground">
                        Tune how agents sound: tone, behavior, fillers (including extended and multilingual),
                        breath pauses, and TTS stability. Vertical built-ins ship with MK-01 catalog packs — clone
                        any preset to customize and save as your own profile.
                    </p>
                </div>
                <VoiceProfilesManager />
            </div>
        </div>
    );
}
