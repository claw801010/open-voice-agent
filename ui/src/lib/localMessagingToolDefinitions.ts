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

export type LocalMessagingToolSpec = {
    path: string;
    body: Record<string, string>;
    response_mapping: Record<string, string>;
};

export const LOCAL_MESSAGING_TOOL_SPECS: Record<string, LocalMessagingToolSpec> = {
    send_confirmation_sms: {
        path: '/api/v1/messages/sms',
        body: {
            to: '{{patient_phone}}',
            body: '{{confirmation_sms_body}}',
            patient_name: '{{patient_name}}',
        },
        response_mapping: {
            message_id: 'message_id',
            status_code: 'status_code',
            confirmation_code: 'confirmation_code',
            sent_at: 'sent_at',
        },
    },
    send_confirmation_email: {
        path: '/api/v1/messages/email',
        body: {
            to: '{{patient_email}}',
            subject: '{{confirmation_email_subject}}',
            body: '{{confirmation_email_body}}',
            patient_name: '{{patient_name}}',
        },
        response_mapping: {
            message_id: 'message_id',
            status_code: 'status_code',
            confirmation_code: 'confirmation_code',
            sent_at: 'sent_at',
        },
    },
};

export function buildLocalMessagingToolDefinition(
    baseUrl: string,
    toolName: string,
): HttpApiToolDefinition {
    const spec = LOCAL_MESSAGING_TOOL_SPECS[toolName];
    if (!spec) {
        throw new Error(`Unknown local messaging tool: ${toolName}`);
    }
    return postTool(baseUrl, spec.path, spec.body, spec.response_mapping);
}
