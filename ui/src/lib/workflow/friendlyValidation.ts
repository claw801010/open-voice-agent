import type { WorkflowError } from '@/client/types.gen';
import type { FlowNode } from '@/components/flow/types';

/**
 * Map backend validation messages to operator-friendly titles and hints (DX-01-NOCODE).
 * Keep in sync with common strings from api/services/workflow/workflow.py validators.
 */
export function friendlyValidationCopy(error: WorkflowError): { title: string; hint?: string } {
    const m = (error.message ?? '').trim();

    if (m.includes('Workflow must have exactly one start node')) {
        return {
            title: 'Add exactly one start node',
            hint: 'Use the left palette → Nodes → add a Start node, or remove duplicate starts.',
        };
    }
    if (m.includes('at most one global node')) {
        return {
            title: 'Too many global nodes',
            hint: 'Keep at most one Global node; remove or merge extras.',
        };
    }
    if (m.includes('EndNode must have at least 1 incoming edge')) {
        return {
            title: 'End node is not reachable',
            hint: 'Connect another node into this End node so the conversation can finish there.',
        };
    }
    if (m.includes('Worker must have at least 1 incoming edge')) {
        return {
            title: 'Agent step is not connected',
            hint: 'Draw an edge from Start or a previous step into this agent node.',
        };
    }
    if (m.toLowerCase().includes('incoming edge')) {
        return {
            title: 'Connection missing',
            hint: 'This step needs an incoming link from the rest of the flow.',
        };
    }

    return {
        title: 'Fix before publish',
        hint: undefined,
    };
}

export function validationLocationLabel(
    error: WorkflowError,
    flowNodes: FlowNode[] | undefined,
): string | null {
    if (error.kind === 'workflow') {
        return 'Whole workflow';
    }
    if (error.kind === 'edge' && error.id) {
        return `Edge ${error.id}`;
    }
    if (error.kind === 'node' && error.id) {
        const node = flowNodes?.find((n) => n.id === error.id);
        const label = node?.data?.name?.trim();
        return label ? `Node “${label}”` : `Node ${error.id}`;
    }
    return null;
}
