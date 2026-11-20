import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    activeGettingStartedStep,
    buildGettingStartedProofHref,
    completedStepCount,
    defaultGettingStartedState,
    dismissGettingStarted,
    GETTING_STARTED_STORAGE_KEY,
    isGettingStartedComplete,
    isStepDone,
    loadGettingStartedState,
    markStep,
    resetGettingStarted,
    saveGettingStartedState,
    shouldShowGettingStartedWizard,
    shouldShowResumeSetup,
} from './gettingStarted';

describe('gettingStarted', () => {
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
        resetGettingStarted();
        vi.unstubAllGlobals();
    });

    it('starts with local_models as active step', () => {
        const state = defaultGettingStartedState();
        expect(activeGettingStartedStep(state)).toBe('local_models');
        expect(shouldShowGettingStartedWizard(state)).toBe(true);
    });

    it('marks steps and completes when all done', () => {
        let state = defaultGettingStartedState();
        for (const id of ['local_models', 'install_template', 'web_test', 'prove_value'] as const) {
            state = markStep(state, id, { status: 'done' });
        }
        expect(isGettingStartedComplete(state)).toBe(true);
        expect(state.completedAt).toBeTruthy();
        expect(shouldShowGettingStartedWizard(state)).toBe(false);
    });

    it('skipped local_models still counts toward completion', () => {
        let state = markStep(defaultGettingStartedState(), 'local_models', { status: 'skipped' });
        state = markStep(state, 'install_template', { status: 'done', workflowId: 42 });
        state = markStep(state, 'web_test', { status: 'done', runId: 7 });
        state = markStep(state, 'prove_value', { status: 'done' });
        expect(isGettingStartedComplete(state)).toBe(true);
    });

    it('persists to localStorage', () => {
        const state = markStep(defaultGettingStartedState(), 'local_models', { status: 'done' });
        saveGettingStartedState(state);
        const loaded = loadGettingStartedState();
        expect(isStepDone(loaded, 'local_models')).toBe(true);
    });

    it('dismiss hides wizard', () => {
        const dismissed = dismissGettingStarted(defaultGettingStartedState());
        saveGettingStartedState(dismissed);
        expect(shouldShowGettingStartedWizard(loadGettingStartedState())).toBe(false);
    });

    it('builds analytics proof href with workflow and catalog', () => {
        expect(buildGettingStartedProofHref({ workflowId: 9, catalogSlug: 'salon' })).toBe(
            '/analytics/calls?workflow_id=9&catalog_slug=salon',
        );
    });

    it('completedStepCount tracks progress', () => {
        let state = markStep(defaultGettingStartedState(), 'local_models', { status: 'done' });
        expect(completedStepCount(state)).toBe(1);
        state = markStep(state, 'install_template', { status: 'done' });
        expect(completedStepCount(state)).toBe(2);
    });

    it('reset clears storage key', () => {
        saveGettingStartedState(defaultGettingStartedState());
        resetGettingStarted();
        expect(localStorage.getItem(GETTING_STARTED_STORAGE_KEY)).toBeNull();
    });

    it('shouldShowResumeSetup when dismissed and incomplete', () => {
        let state = dismissGettingStarted(defaultGettingStartedState());
        state = markStep(state, 'local_models', { status: 'done' });
        expect(shouldShowResumeSetup(state)).toBe(true);
        for (const id of ['install_template', 'web_test', 'prove_value'] as const) {
            state = markStep(state, id, { status: 'done' });
        }
        expect(shouldShowResumeSetup(state)).toBe(false);
    });
});
