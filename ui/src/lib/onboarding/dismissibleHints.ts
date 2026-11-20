/** localStorage keys for one-time dismissible CX hints (not the run-page onboarding tooltips). */

export const DISMISSIBLE_HINT_KEYS = {
    catalogQuickStart: 'catalog_quick_start_v1',
    analyticsFiltersOverview: 'analytics_filters_overview_v1',
    analyticsFiltersCalls: 'analytics_filters_calls_v1',
    editorLineageLinks: 'editor_lineage_links_v1',
    overviewOperatorPath: 'overview_operator_path_v1',
    simulationRail: 'simulation_rail_v1',
    settingsRecipes: 'settings_recipes_v1',
} as const;

export type DismissibleHintKey = (typeof DISMISSIBLE_HINT_KEYS)[keyof typeof DISMISSIBLE_HINT_KEYS];

const STORAGE_PREFIX = 'ovo_hint_dismissed:';

function hintStorage(): Storage | null {
    try {
        if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
            return globalThis.localStorage;
        }
    } catch {
        return null;
    }
    return null;
}

export function isHintDismissed(key: DismissibleHintKey): boolean {
    const storage = hintStorage();
    if (!storage) return false;
    return storage.getItem(`${STORAGE_PREFIX}${key}`) === '1';
}

export function dismissHint(key: DismissibleHintKey): void {
    hintStorage()?.setItem(`${STORAGE_PREFIX}${key}`, '1');
}

export function resetDismissibleHints(): void {
    const storage = hintStorage();
    if (!storage) return;
    for (const key of Object.values(DISMISSIBLE_HINT_KEYS)) {
        storage.removeItem(`${STORAGE_PREFIX}${key}`);
    }
}
