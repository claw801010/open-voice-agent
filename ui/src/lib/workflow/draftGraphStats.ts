import { FlowEdge, FlowNode, NodeType, type WorkflowSubflowDefinition } from '@/components/flow/types';

/**
 * WE-01-HEADER: one-line **structural** summary of the **main** graph (no API; not a token/cost estimate).
 */
export function formatMainDraftGraphStats(mainNodes: FlowNode[], mainEdges: FlowEdge[]): string | null {
    if (mainNodes.length === 0) return null;
    const agents = mainNodes.filter((n) => n.type === NodeType.AGENT_NODE).length;
    const parts: string[] = [`${mainNodes.length} nodes`, `${mainEdges.length} edges`];
    if (agents > 0) {
        parts.push(`${agents} agent${agents === 1 ? '' : 's'}`);
    }
    return `Main graph: ${parts.join(' · ')}`;
}

function isSubflowNonEmpty(s: WorkflowSubflowDefinition | undefined): boolean {
    if (!s) return false;
    return (s.nodes?.length ?? 0) > 0 || (s.edges?.length ?? 0) > 0;
}

/**
 * WE-01-SUBFLOWS + WE-01-HEADER: non-empty **subflows** keys in the editor store; voice may **enter_subflow** from main edges (see `FlowEdgeData`).
 */
export function formatSubflowInventory(subflows: Record<string, WorkflowSubflowDefinition>): string | null {
    const keys = Object.keys(subflows).filter((k) => isSubflowNonEmpty(subflows[k]));
    if (keys.length === 0) return null;
    const sorted = [...keys].sort();
    const list = sorted.join(', ');
    return `Subgraphs saved: ${keys.length} (${list})`;
}
