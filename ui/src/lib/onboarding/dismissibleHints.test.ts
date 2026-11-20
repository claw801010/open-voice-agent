import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    DISMISSIBLE_HINT_KEYS,
    dismissHint,
    isHintDismissed,
    resetDismissibleHints,
} from './dismissibleHints';

describe('dismissibleHints', () => {
    beforeEach(() => {
        const store: Record<string, string> = {};
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => {
                store[k] = v;
            },
            removeItem: (k: string) => {
                delete store[k];
            },
        } satisfies Storage);
    });

    afterEach(() => {
        resetDismissibleHints();
        vi.unstubAllGlobals();
    });

    it('starts undismissed', () => {
        expect(isHintDismissed(DISMISSIBLE_HINT_KEYS.catalogQuickStart)).toBe(false);
    });

    it('persists dismiss', () => {
        dismissHint(DISMISSIBLE_HINT_KEYS.catalogQuickStart);
        expect(isHintDismissed(DISMISSIBLE_HINT_KEYS.catalogQuickStart)).toBe(true);
    });
});
