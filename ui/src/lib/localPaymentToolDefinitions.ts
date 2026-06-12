import type { HttpApiToolDefinition } from '@/client/types.gen';

const BOOKING_RESPONSE_MAPPING = {
    appointment_id: 'appointment.id',
    slot_start: 'appointment.slot.start',
    confirmation_code: 'confirmation_code',
};

export function buildCapturePaymentPromiseToolDefinition(baseUrl: string): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/payment-promises`;
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(
                {
                    account_reference: '{{account_reference}}',
                    promised_amount: '{{promised_amount}}',
                    promised_date: '{{promised_date}}',
                },
                null,
                2,
            ),
            response_mapping: {
                promise_id: 'appointment.id',
                confirmation_code: 'confirmation_code',
                promised_date: 'appointment.slot.start',
            },
        },
    };
}

export function buildConfirmPaymentRedirectToolDefinition(baseUrl: string): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/payments/redirect/confirm`;
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(
                {
                    account_reference: '{{account_reference}}',
                    redirect_url: '{{payment_portal_url}}',
                    reason_code: '{{payment_redirect_reason_code}}',
                },
                null,
                2,
            ),
            response_mapping: {
                redirect_id: 'appointment.id',
                portal_url: 'confirmation_code',
                expires_at: 'appointment.slot.start',
            },
        },
    };
}

export function buildEnrollConciergeVisitToolDefinition(baseUrl: string): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/visits/enroll`;
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(
                {
                    visit_type: '{{concierge_visit_type}}',
                    slot_start: '{{slot_start}}',
                    patient_name: '{{patient_name}}',
                },
                null,
                2,
            ),
            response_mapping: {
                enrollment_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        },
    };
}

export const LOCAL_PAYMENT_TOOL_BUILDERS: Record<
    string,
    (baseUrl: string) => HttpApiToolDefinition
> = {
    capture_payment_promise: buildCapturePaymentPromiseToolDefinition,
    confirm_payment_redirect: buildConfirmPaymentRedirectToolDefinition,
    enroll_concierge_visit: buildEnrollConciergeVisitToolDefinition,
};

/** Tools that use billing_api_base_url vs collections_api_base_url template var. */
export const LOCAL_PAYMENT_TOOL_VAR_KEY: Record<string, 'billing_api_base_url' | 'collections_api_base_url'> = {
    capture_payment_promise: 'collections_api_base_url',
    confirm_payment_redirect: 'billing_api_base_url',
    enroll_concierge_visit: 'billing_api_base_url',
};

export { BOOKING_RESPONSE_MAPPING };
