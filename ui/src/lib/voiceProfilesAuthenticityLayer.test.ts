import { describe, expect, it } from 'vitest';

import {
    DEFAULT_AUTHENTICITY_LAYER,
    mapProfileApi,
    naturalDeliveryCatalogHint,
    type SpeechDeliverySettings,
} from './voiceProfiles';

describe('authenticity layer profile mapping', () => {
    it('maps authenticity_layer from API snake_case', () => {
        const profile = mapProfileApi({
            id: 'custom:1',
            name: 'Test',
            speech_settings: {
                authenticity_layer: {
                    enabled: true,
                    filler_intensity: 'medium',
                    one_word_fillers: ['Sure'],
                    two_word_fillers: ['Got it'],
                    three_word_fillers: ['Just a moment'],
                    enable_soft_breath: true,
                    soft_breath_intensity: 'natural',
                    enable_key_projection: true,
                    key_projection_intensity: 'moderate',
                    key_projection_terms: ['confirmation'],
                },
            },
        });
        const layer = profile.speechSettings.authenticityLayer;
        expect(layer.enabled).toBe(true);
        expect(layer.fillerIntensity).toBe('medium');
        expect(layer.oneWordFillers).toEqual(['Sure']);
        expect(layer.enableSoftBreath).toBe(true);
        expect(layer.keyProjectionTerms).toEqual(['confirmation']);
    });

    it('defaults missing authenticity_layer to disabled layer', () => {
        const profile = mapProfileApi({ id: 'builtin:x', name: 'X' });
        expect(profile.speechSettings.authenticityLayer).toEqual(DEFAULT_AUTHENTICITY_LAYER);
    });
});

describe('naturalDeliveryCatalogHint', () => {
    it('returns hint for consumer vertical profiles', () => {
        expect(naturalDeliveryCatalogHint('builtin:vertical_healthcare')).toBe('natural delivery');
        expect(naturalDeliveryCatalogHint('builtin:vertical_retail')).toBe('natural delivery');
    });

    it('returns null for formal profiles without natural delivery', () => {
        expect(naturalDeliveryCatalogHint('builtin:vertical_b2b')).toBeNull();
        expect(naturalDeliveryCatalogHint('builtin:vertical_financial')).toBeNull();
        expect(naturalDeliveryCatalogHint('')).toBeNull();
    });
});
