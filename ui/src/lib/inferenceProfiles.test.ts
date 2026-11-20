import { describe, expect, it } from 'vitest';

import { componentStatusLabel, tierBadgeClass } from '@/lib/inferenceProfiles';

describe('inferenceProfiles', () => {
    it('tierBadgeClass returns distinct classes per tier', () => {
        expect(tierBadgeClass('local')).toContain('emerald');
        expect(tierBadgeClass('hybrid')).toContain('amber');
        expect(tierBadgeClass('cloud')).toContain('sky');
    });

    it('componentStatusLabel reflects readiness', () => {
        expect(
            componentStatusLabel({
                id: 'ollama',
                label: 'Ollama',
                installed: true,
                reachable: true,
                ready: true,
                models_present: [],
                models_required: [],
                endpoint: '',
                hint: '',
            }),
        ).toBe('ready');
        expect(
            componentStatusLabel({
                id: 'x',
                label: 'X',
                installed: true,
                reachable: false,
                ready: false,
                models_present: [],
                models_required: [],
                endpoint: '',
                hint: '',
            }),
        ).toBe('partial');
    });
});
