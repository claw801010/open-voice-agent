export enum NodeType {
    START_CALL = 'startCall',
    AGENT_NODE = 'agentNode',
    END_CALL = 'endCall',
    GLOBAL_NODE = 'globalNode',
    TRIGGER = 'trigger',
    WEBHOOK = 'webhook',
    QA = 'qa'
}

export type FlowNodeData = {
    prompt: string;
    name: string;
    is_start?: boolean;
    is_static?: boolean;
    is_end?: boolean;
    invalid?: boolean;
    validationMessage?: string | null;
    selected_through_edge?: boolean;
    hovered_through_edge?: boolean;
    allow_interrupt?: boolean;
    extraction_enabled?: boolean;
    extraction_prompt?: string;
    extraction_variables?: ExtractionVariable[];
    add_global_prompt?: boolean;
    greeting?: string;
    greeting_type?: 'text' | 'audio';
    greeting_recording_id?: string;
    wait_for_user_greeting?: boolean;
    detect_voicemail?: boolean;
    delayed_start?: boolean;
    delayed_start_duration?: number;
    // Pre-call data fetch (StartCall only)
    pre_call_fetch_enabled?: boolean;
    pre_call_fetch_url?: string;
    pre_call_fetch_credential_uuid?: string;
    // Trigger node specific
    trigger_path?: string;
    // Webhook node specific
    enabled?: boolean;
    http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    endpoint_url?: string;
    credential_uuid?: string;
    custom_headers?: Array<{ key: string; value: string }>;
    payload_template?: Record<string, unknown>;
    retry_config?: {
        enabled: boolean;
        max_retries: number;
        retry_delay_seconds: number;
    };
    // QA node specific
    qa_enabled?: boolean;
    qa_system_prompt?: string;
    qa_use_workflow_llm?: boolean;
    qa_provider?: string;
    qa_model?: string;
    qa_api_key?: string;
    qa_min_call_duration?: number;
    qa_voicemail_calls?: boolean;
    qa_sample_rate?: number;
    // Tools - array of tool UUIDs that can be invoked by this node
    tool_uuids?: string[];
    // Documents - array of knowledge base document UUIDs that can be referenced by this node
    document_uuids?: string[];
}

export type FlowNode = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: FlowNodeData;
    measured?: {
        width: number;
        height: number;
    };
    selected?: boolean;
    dragging?: boolean;
};

export type FlowEdgeData = {
    condition: string;
    label: string;
    transition_speech?: string;
    transition_speech_type?: 'text' | 'audio';
    transition_speech_recording_id?: string;
    /** WE-01-SUBFLOWS: main graph only — run this named subgraph first, then continue at target */
    enter_subflow?: string;
    invalid?: boolean;
    validationMessage?: string | null;
}

export type FlowEdge = {
    id: string;
    source: string;
    target: string;
    type?: string;
    data: FlowEdgeData;
    animated?: boolean;
    invalid?: boolean;
};

/** One named subgraph (WE-01-SUBFLOWS); same shape as root graph JSON without nested `subflows`. */
export type WorkflowSubflowDefinition = {
    nodes: FlowNode[];
    edges: FlowEdge[];
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    };
};

/**
 * Persisted as `workflow_json`. Backend validates via `ReactFlowDTO` (`api/services/workflow/dto.py`).
 * Optional `subflows` is stored; validated on load. Main-flow edges may set `enter_subflow` to run a subgraph before the edge target (voice Pipecat).
 */
export interface WorkflowDefinition {
    nodes: FlowNode[];
    edges: FlowEdge[];
    viewport: {
        x: number;
        y: number;
        zoom: number;
    };
    subflows?: Record<string, WorkflowSubflowDefinition>;
}

export interface WorkflowData {
    name: string;
    workflow_definition: WorkflowDefinition;
}

export type WorkflowValidationError = {
    kind: 'node' | 'edge' | 'workflow';
    id: string;
    field: string;
    message: string;
}

export type ExtractionVariable = {
    name: string;
    type: 'string' | 'number' | 'boolean';
    prompt?: string;
};

// Credential types for webhook authentication
export type CredentialType = 'none' | 'api_key' | 'bearer_token' | 'basic_auth' | 'custom_header';

export interface Credential {
    uuid: string;
    name: string;
    description?: string;
    credential_type: CredentialType;
    created_at: string;
    updated_at: string;
}

