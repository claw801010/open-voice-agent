import { describe, expect, it } from 'vitest';

import {
    buildHttpToolHappyPathSteps,
    hasFilledResponseMapping,
    httpToolHappyPathComplete,
    urlIsValidForHappyPath,
} from './httpToolHappyPath';

describe('httpToolHappyPath', () => {
    it('validates http(s) URLs', () => {
        expect(urlIsValidForHappyPath('https://api.example.com/v1')).toBe(true);
        expect(urlIsValidForHappyPath('ftp://x')).toBe(false);
        expect(urlIsValidForHappyPath('')).toBe(false);
    });

    it('detects response mapping rows', () => {
        expect(hasFilledResponseMapping([{ key: '', value: 'a' }])).toBe(false);
        expect(hasFilledResponseMapping([{ key: 'slot_id', value: 'data.id' }])).toBe(true);
    });

    it('builds four checklist steps', () => {
        const steps = buildHttpToolHappyPathSteps({
            url: 'https://httpbin.org/post',
            testCallSucceeded: true,
            responseMappings: [{ key: 'ok', value: 'success' }],
            isSaved: false,
        });
        expect(steps).toHaveLength(4);
        expect(steps.find((s) => s.id === 'saved')?.done).toBe(false);
        expect(httpToolHappyPathComplete(steps)).toBe(false);
    });

    it('complete when all steps done', () => {
        const steps = buildHttpToolHappyPathSteps({
            url: 'https://httpbin.org/post',
            testCallSucceeded: true,
            responseMappings: [{ key: 'ok', value: 'success' }],
            isSaved: true,
        });
        expect(httpToolHappyPathComplete(steps)).toBe(true);
    });
});
