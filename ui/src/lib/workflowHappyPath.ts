/**
 * WE-01 — workflow editor happy-path checklist (operator nudges).
 */
import type { FlowNode } from '@/components/flow/types';
import { verticalHttpProofHintForSlug } from '@/lib/analyticsVerticalHttpHints';

export type WorkflowHappyPathStepId =
    | 'flow'
    | 'http_tools'
    | 'valid'
    | 'published';

export type WorkflowHappyPathStep = {
    id: WorkflowHappyPathStepId;
    label: string;
    done: boolean;
    detail: string;
};

function collectToolUuidsFromNodes(nodes: ReadonlyArray<FlowNode>): string[] {
    const uuids = new Set<string>();
    for (const node of nodes) {
        const list = node.data?.tool_uuids;
        if (Array.isArray(list)) {
            for (const id of list) {
                if (typeof id === 'string' && id.trim()) {
                    uuids.add(id.trim());
                }
            }
        }
    }
    return [...uuids];
}

export function flowHasAgentSpine(nodes: ReadonlyArray<FlowNode>): boolean {
    const hasStart = nodes.some((n) => n.type === 'startCall');
    const hasAgent = nodes.some((n) => n.type === 'agentNode');
    const hasEnd = nodes.some((n) => n.type === 'endCall');
    return hasStart && hasAgent && hasEnd;
}

export function httpToolsStepDone(input: {
    nodes: ReadonlyArray<FlowNode>;
    toolNamesByUuid: ReadonlyMap<string, string>;
    catalogSlug?: string | null;
}): boolean {
    const uuids = collectToolUuidsFromNodes(input.nodes);
    if (uuids.length === 0) {
        return false;
    }
    const hint = verticalHttpProofHintForSlug(input.catalogSlug);
    if (!hint) {
        return true;
    }
    const names = uuids
        .map((id) => (input.toolNamesByUuid.get(id) || '').trim().toLowerCase())
        .filter(Boolean);
    if (names.length === 0) {
        return true;
    }
    return hint.example_tool_names.some((example) =>
        names.some((n) => n === example.toLowerCase() || n.includes(example.toLowerCase())),
    );
}

export function buildWorkflowHappyPathSteps(input: {
    nodes: ReadonlyArray<FlowNode>;
    validationErrorCount: number;
    hasPublishedVersion: boolean;
    toolNamesByUuid: ReadonlyMap<string, string>;
    catalogSlug?: string | null;
}): WorkflowHappyPathStep[] {
    const flowDone = flowHasAgentSpine(input.nodes);
    const toolsDone = httpToolsStepDone({
        nodes: input.nodes,
        toolNamesByUuid: input.toolNamesByUuid,
        catalogSlug: input.catalogSlug,
    });
    const validDone = input.validationErrorCount === 0 && input.nodes.length > 0;
    const publishedDone = input.hasPublishedVersion;

    const hint = verticalHttpProofHintForSlug(input.catalogSlug);
    const toolsDetail = !toolsDone
        ? hint
            ? `Attach HTTP tools (e.g. ${hint.example_tool_names.slice(0, 2).join(', ')}) on Agent or Start`
            : 'Attach at least one HTTP API tool on Agent or Start'
        : hint
          ? 'HTTP tools wired for this vertical'
          : 'At least one tool attached';

    return [
        {
            id: 'flow',
            label: 'Flow wired',
            done: flowDone,
            detail: flowDone
                ? 'Start, Agent, and End nodes present'
                : 'Add Start → Agent → End from the left palette and connect edges',
        },
        {
            id: 'http_tools',
            label: 'HTTP tools',
            done: toolsDone,
            detail: toolsDetail,
        },
        {
            id: 'valid',
            label: 'Validates',
            done: validDone,
            detail: validDone
                ? 'No blocking validation errors'
                : 'Fix issues in the header validation popover',
        },
        {
            id: 'published',
            label: 'Published',
            done: publishedDone,
            detail: publishedDone
                ? 'Live version available for calls'
                : 'Publish when the graph and tools are ready',
        },
    ];
}

export function workflowHappyPathComplete(steps: WorkflowHappyPathStep[]): boolean {
    return steps.every((s) => s.done);
}
