import type { HttpApiToolDefinition } from '@/client/types.gen';

function postTool(
    baseUrl: string,
    path: string,
    body: Record<string, string>,
    response_mapping: Record<string, string>,
): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(body, null, 2),
            response_mapping,
        },
    };
}

export type LocalEhrToolSpec = {
    path: string;
    body: Record<string, string>;
    response_mapping: Record<string, string>;
};

/** Healthcare EHR demo tools — patient context, prior auth, chart sync. */
export const LOCAL_EHR_TOOL_SPECS: Record<string, LocalEhrToolSpec> = {
    lookup_patient_context: {
        path: '/api/v1/patients/context',
        body: {
            patient_token: '{{patient_token}}',
            patient_name: '{{patient_name}}',
        },
        response_mapping: {
            patient_id: 'patient.patient_id',
            record_source: 'record_source',
            record_keeping_mode: 'record_keeping_mode',
            open_care_gaps: 'open_care_gaps',
            ehr_vendor: 'ehr_vendor',
            confirmation_code: 'synced_at',
        },
    },
    verify_prior_auth: {
        path: '/api/v1/prior-auth/status',
        body: {
            patient_token: '{{patient_token}}',
            procedure_code: '{{procedure_code}}',
        },
        response_mapping: {
            prior_auth_id: 'prior_auth_id',
            status_code: 'status_code',
            expires_at: 'expires_at',
            confirmation_code: 'confirmation_code',
        },
    },
    sync_chart_to_ehr: {
        path: '/api/v1/chart/sync',
        body: {
            patient_token: '{{patient_token}}',
            appointment_id: '{{appointment_id}}',
            summary: '{{chart_sync_summary}}',
        },
        response_mapping: {
            chart_sync_id: 'chart_sync_id',
            local_record_id: 'local_record_id',
            status_code: 'status_code',
            connector_sync_status: 'connector_sync_status',
            record_source: 'record_source',
            ehr_vendor: 'ehr_vendor',
            confirmation_code: 'confirmation_code',
        },
    },
};

export function buildLocalEhrToolDefinition(baseUrl: string, toolName: string): HttpApiToolDefinition {
    const spec = LOCAL_EHR_TOOL_SPECS[toolName];
    if (!spec) {
        throw new Error(`Unknown local EHR tool: ${toolName}`);
    }
    return postTool(baseUrl, spec.path, spec.body, spec.response_mapping);
}
