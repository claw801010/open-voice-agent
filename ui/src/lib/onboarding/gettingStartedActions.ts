import {
    createWorkflowRunApiV1WorkflowWorkflowIdRunsPost,
    installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost,
} from '@/client/sdk.gen';
import { WORKFLOW_RUN_MODES } from '@/constants/workflowRunModes';
import { onboardingVariantForSlug } from '@/lib/onboarding/gettingStarted';
import { getRandomId } from '@/lib/utils';

export type InstallOnboardingPackResult =
    | { ok: true; workflowId: number; catalogSlug: string; variantId: string | undefined }
    | { ok: false; error: string };

export async function installOnboardingPack(
    getAccessToken: () => Promise<string | null>,
    slug: string,
    workflowName: string,
): Promise<InstallOnboardingPackResult> {
    const variantId = onboardingVariantForSlug(slug);
    try {
        const token = await getAccessToken();
        const res = await installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost({
            body: {
                slug,
                workflow_name: workflowName.slice(0, 200),
                ...(variantId ? { variant_id: variantId } : {}),
            },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const workflowId = res.data?.id;
        if (!workflowId) {
            return { ok: false, error: 'Install succeeded but no workflow id returned' };
        }
        return { ok: true, workflowId, catalogSlug: slug, variantId };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Install failed';
        return { ok: false, error: msg };
    }
}

export type StartWebTestResult =
    | { ok: true; workflowId: number; runId: number }
    | { ok: false; error: string };

export async function startOnboardingWebTest(
    getAccessToken: () => Promise<string | null>,
    workflowId: number,
): Promise<StartWebTestResult> {
    try {
        const token = await getAccessToken();
        const runRes = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
            path: { workflow_id: workflowId },
            body: {
                mode: WORKFLOW_RUN_MODES.SMALL_WEBRTC,
                name: `GettingStarted-${getRandomId()}`,
            },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const runId = runRes.data?.id;
        if (!runId) {
            return { ok: false, error: 'Could not start Web test run' };
        }
        return { ok: true, workflowId, runId };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Web test failed';
        return { ok: false, error: msg };
    }
}
