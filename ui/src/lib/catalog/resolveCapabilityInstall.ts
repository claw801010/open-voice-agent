/**
 * MK-01-CAPABILITY-MODULES slice 3 — preview + install from selected capability modules.
 */

import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type CapabilityInstallResolution = {
    slug: string;
    variant_id: string | null;
    display_name: string;
    industry: string;
    variant_label: string | null;
    matched_module_ids: string[];
    matched_module_labels: string[];
    requested_module_ids: string[];
    coverage_score: number;
};

export type CapabilityPlanInstall = {
    slug: string;
    variant_id: string | null;
    display_name: string;
    industry: string;
    variant_label: string | null;
    module_ids: string[];
    module_labels: string[];
};

export type CapabilityComposePlan = {
    requested_module_ids: string[];
    single_pack_sufficient: boolean;
    primary: CapabilityInstallResolution;
    installs: CapabilityPlanInstall[];
    uncovered_module_ids: string[];
};

export async function fetchCapabilityComposePlan(
    moduleIds: string[],
): Promise<CapabilityComposePlan | null> {
    if (moduleIds.length === 0) return null;
    const base = getBackendPublicBaseUrl().replace(/\/$/, '');
    const q = new URLSearchParams({ module_ids: moduleIds.join(',') });
    const res = await fetch(`${base}/api/v1/catalog/capability-modules/compose-plan?${q}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as CapabilityComposePlan;
}

export async function fetchCapabilityInstallResolution(
    moduleIds: string[],
): Promise<CapabilityInstallResolution | null> {
    if (moduleIds.length === 0) return null;
    const base = getBackendPublicBaseUrl().replace(/\/$/, '');
    const q = new URLSearchParams({ module_ids: moduleIds.join(',') });
    const res = await fetch(`${base}/api/v1/catalog/capability-modules/resolve?${q}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as CapabilityInstallResolution;
}

export async function installWorkflowFromCapabilityModules(
    getAccessToken: () => Promise<string | null>,
    moduleIds: string[],
    workflowName: string,
): Promise<{ ok: true; workflowId: number; resolution: CapabilityInstallResolution } | { ok: false; error: string }> {
    const token = await getAccessToken();
    const base = getBackendPublicBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/workflow/install-from-capability-modules`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ module_ids: moduleIds, workflow_name: workflowName }),
    });
    if (!res.ok) {
        let detail = `Install failed (${res.status})`;
        try {
            const err = (await res.json()) as { detail?: string };
            if (err.detail) detail = err.detail;
        } catch {
            /* ignore */
        }
        return { ok: false, error: detail };
    }
    const data = (await res.json()) as {
        id: number;
        capability_resolution?: CapabilityInstallResolution;
    };
    const resolution = data.capability_resolution;
    if (!resolution) {
        return { ok: false, error: 'Missing capability_resolution in response' };
    }
    return { ok: true, workflowId: data.id, resolution };
}

export async function installCapabilityComposePlan(
    getAccessToken: () => Promise<string | null>,
    moduleIds: string[],
    workflowNamePrefix: string,
): Promise<
    | { ok: true; workflowIds: number[]; plan: CapabilityComposePlan }
    | { ok: false; error: string }
> {
    const token = await getAccessToken();
    const base = getBackendPublicBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/workflow/install-from-capability-modules/plan`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            module_ids: moduleIds,
            workflow_name_prefix: workflowNamePrefix,
        }),
    });
    if (!res.ok) {
        let detail = `Install plan failed (${res.status})`;
        try {
            const err = (await res.json()) as { detail?: string };
            if (err.detail) detail = err.detail;
        } catch {
            /* ignore */
        }
        return { ok: false, error: detail };
    }
    const data = (await res.json()) as {
        plan: CapabilityComposePlan;
        workflows: { id: number }[];
    };
    return {
        ok: true,
        workflowIds: (data.workflows ?? []).map((w) => w.id),
        plan: data.plan,
    };
}
