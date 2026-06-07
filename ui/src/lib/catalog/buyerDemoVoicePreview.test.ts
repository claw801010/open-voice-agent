import { describe, expect, it } from 'vitest';

import { mapCatalogVoicePreviewApiResponse } from '@/lib/voiceProfiles';

describe('mapCatalogVoicePreviewApiResponse', () => {
    it('maps hosted_preview_is_silent_placeholder from API', () => {
        const mapped = mapCatalogVoicePreviewApiResponse('retail-wismo-faq', {
            catalog_slug: 'retail-wismo-faq',
            profile_id: 'builtin:vertical_retail',
            profile_name: 'Retail',
            script: 'Thanks for calling.',
            preview_audio_url: '/api/v1/catalog/vertical-packs/retail-wismo-faq/voice-preview/audio',
            hosted_preview_is_silent_placeholder: true,
        });
        expect(mapped.hostedPreviewIsSilentPlaceholder).toBe(true);
    });
});
