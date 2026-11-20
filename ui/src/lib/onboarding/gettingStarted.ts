/**
 * First-run getting started wizard — local models → template → Web test → analytics proof.
 * Persists in localStorage (per browser); not synced server-side.
 */

import { buyerDemoDefaultVariant } from '@/lib/catalog/buyerDemoDefaults';

export const GETTING_STARTED_STORAGE_KEY = 'ovo_getting_started_v1';

export type GettingStartedStepId = 'local_models' | 'install_template' | 'web_test' | 'prove_value';

export type StepStatus = 'pending' | 'done' | 'skipped';

export type OnboardingPackChoice = {
    slug: string;
    displayName: string;
    tagline: string;
    recommended?: boolean;
};

/** SMB-friendly packs with local stubs — no buyer API keys required. */
export const ONBOARDING_PACK_CHOICES: OnboardingPackChoice[] = [
    {
        slug: 'barber-beauty-salon-faq',
        displayName: 'Salon booking',
        tagline: 'Book cuts and color with local calendar — great first demo.',
        recommended: true,
    },
    {
        slug: 'handyman-home-services-faq',
        displayName: 'Handyman quote',
        tagline: 'Capture job quotes into local CRM after a services FAQ.',
    },
    {
        slug: 'solopreneur-coach-faq',
        displayName: 'Coach intake',
        tagline: 'Discovery calls and client intake for owner-led businesses.',
    },
];

export const DEFAULT_ONBOARDING_SLUG = ONBOARDING_PACK_CHOICES[0].slug;

export function onboardingVariantForSlug(slug: string): string | undefined {
    return buyerDemoDefaultVariant(slug);
}

export type GettingStartedStepState = {
    status: StepStatus;
    at?: string;
    workflowId?: number;
    runId?: number;
    catalogSlug?: string;
    variantId?: string;
};

export type GettingStartedState = {
    version: 1;
    dismissed: boolean;
    completedAt: string | null;
    selectedPackSlug: string;
    steps: Record<GettingStartedStepId, GettingStartedStepState>;
};

export const GETTING_STARTED_STEP_ORDER: GettingStartedStepId[] = [
    'local_models',
    'install_template',
    'web_test',
    'prove_value',
];

export const GETTING_STARTED_STEP_LABELS: Record<GettingStartedStepId, string> = {
    local_models: 'Local voice stack',
    install_template: 'Install a template',
    web_test: 'Place a Web test call',
    prove_value: 'See your proof',
};

function emptyStep(): GettingStartedStepState {
    return { status: 'pending' };
}

export function defaultGettingStartedState(): GettingStartedState {
    return {
        version: 1,
        dismissed: false,
        completedAt: null,
        selectedPackSlug: DEFAULT_ONBOARDING_SLUG,
        steps: {
            local_models: emptyStep(),
            install_template: emptyStep(),
            web_test: emptyStep(),
            prove_value: emptyStep(),
        },
    };
}

function storage(): Storage | null {
    try {
        if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
            return globalThis.localStorage;
        }
    } catch {
        return null;
    }
    return null;
}

export function loadGettingStartedState(): GettingStartedState {
    const raw = storage()?.getItem(GETTING_STARTED_STORAGE_KEY);
    if (!raw) return defaultGettingStartedState();
    try {
        const parsed = JSON.parse(raw) as Partial<GettingStartedState>;
        const base = defaultGettingStartedState();
        return {
            ...base,
            ...parsed,
            version: 1,
            steps: { ...base.steps, ...(parsed.steps ?? {}) },
        };
    } catch {
        return defaultGettingStartedState();
    }
}

export function saveGettingStartedState(state: GettingStartedState): void {
    storage()?.setItem(GETTING_STARTED_STORAGE_KEY, JSON.stringify(state));
}

export function markStep(
    state: GettingStartedState,
    stepId: GettingStartedStepId,
    patch: Partial<GettingStartedStepState> & { status: StepStatus },
): GettingStartedState {
    const next: GettingStartedState = {
        ...state,
        steps: {
            ...state.steps,
            [stepId]: {
                ...state.steps[stepId],
                ...patch,
                at: patch.at ?? new Date().toISOString(),
            },
        },
    };
    if (isGettingStartedComplete(next) && !next.completedAt) {
        next.completedAt = new Date().toISOString();
    }
    return next;
}

export function dismissGettingStarted(state: GettingStartedState): GettingStartedState {
    return { ...state, dismissed: true };
}

export function resetGettingStarted(): void {
    storage()?.removeItem(GETTING_STARTED_STORAGE_KEY);
}

export function isStepDone(state: GettingStartedState, stepId: GettingStartedStepId): boolean {
    const s = state.steps[stepId].status;
    return s === 'done' || s === 'skipped';
}

export function isGettingStartedComplete(state: GettingStartedState): boolean {
    return GETTING_STARTED_STEP_ORDER.every((id) => isStepDone(state, id));
}

export function shouldShowGettingStartedWizard(state: GettingStartedState): boolean {
    if (state.dismissed) return false;
    if (state.completedAt) return false;
    return true;
}

export function activeGettingStartedStep(state: GettingStartedState): GettingStartedStepId {
    for (const id of GETTING_STARTED_STEP_ORDER) {
        if (!isStepDone(state, id)) return id;
    }
    return 'prove_value';
}

export function completedStepCount(state: GettingStartedState): number {
    return GETTING_STARTED_STEP_ORDER.filter((id) => isStepDone(state, id)).length;
}

export function buildGettingStartedProofHref(opts: {
    workflowId?: number;
    catalogSlug?: string;
    variantId?: string;
}): string {
    const q = new URLSearchParams();
    if (opts.workflowId != null) q.set('workflow_id', String(opts.workflowId));
    if (opts.catalogSlug?.trim()) q.set('catalog_slug', opts.catalogSlug.trim());
    if (opts.variantId?.trim()) q.set('catalog_variant_id', opts.variantId.trim());
    const qs = q.toString();
    return qs ? `/analytics/calls?${qs}` : '/analytics/calls';
}

export function installedWorkflowId(state: GettingStartedState): number | undefined {
    return state.steps.install_template.workflowId;
}

export function shouldShowResumeSetup(state: GettingStartedState): boolean {
    if (state.completedAt || isGettingStartedComplete(state)) return false;
    return state.dismissed || completedStepCount(state) > 0;
}

export function onboardingProgressLabel(state: GettingStartedState): string {
    const done = completedStepCount(state);
    const total = GETTING_STARTED_STEP_ORDER.length;
    return `Setup ${done}/${total}`;
}
