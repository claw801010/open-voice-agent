/**
 * WE-01-HEADER: GET /workflow/{id}/estimate-cost — heuristic Dograh token / cost dry-run.
 */

import { client } from '@/client/client.gen';

export type WorkflowCostDryRunResponse = {
    estimated_total_cost_usd: number;
    estimated_dograh_tokens: number;
    pricing_model_label: string;
    assumptions: string[];
    main_agent_nodes: number;
    subflow_agent_nodes_total: number;
    estimated_turns: number;
    reference_call_duration_seconds: number;
};

export function formatCostDryRunHint(r: WorkflowCostDryRunResponse): string {
    const t = Math.round(r.estimated_dograh_tokens);
    return `Est. dry-run: ~${t} Dograh tokens (~${Math.round(r.reference_call_duration_seconds / 60)} min reference)`;
}

export function costDryRunTooltip(r: WorkflowCostDryRunResponse): string {
    return [r.pricing_model_label, ...r.assumptions].join('\n');
}

export async function fetchWorkflowCostDryRun(
    workflowId: number,
): Promise<WorkflowCostDryRunResponse | null> {
    const res = await client.get({
        url: '/api/v1/workflow/{workflow_id}/estimate-cost',
        path: { workflow_id: workflowId },
    });
    if (res.error || res.data == null) {
        return null;
    }
    return res.data as WorkflowCostDryRunResponse;
}
