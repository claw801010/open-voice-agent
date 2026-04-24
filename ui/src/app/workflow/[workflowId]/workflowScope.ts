/** Default first component subgraph key (WE-01-SUBFLOWS). */
export const DEFAULT_COMPONENT_SCOPE_KEY = 'component_1';

/** Tabs shown in [WorkflowFlowScopeBar](components/WorkflowFlowScopeBar.tsx); keys map to `workflow_json.subflows[key]`. */
export const COMPONENT_SCOPE_ENTRIES: readonly { key: string; label: string }[] = [
    { key: 'component_1', label: 'Component 1' },
    { key: 'component_2', label: 'Component 2' },
    { key: 'component_3', label: 'Component 3' },
];
