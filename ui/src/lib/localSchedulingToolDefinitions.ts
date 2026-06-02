import type { HttpApiToolDefinition } from '@/client/types.gen';

const BOOKING_RESPONSE_MAPPING = {
    appointment_id: 'appointment.id',
    slot_start: 'appointment.slot.start',
    confirmation_code: 'confirmation_code',
    invite_download_url: 'invite_download_url',
};

const INTERVIEW_RESPONSE_MAPPING = {
    interview_id: 'appointment.id',
    slot_start: 'appointment.slot.start',
    confirmation_code: 'confirmation_code',
    invite_download_url: 'invite_download_url',
};

function postTool(
    url: string,
    body: Record<string, unknown>,
    response_mapping: Record<string, string>,
): HttpApiToolDefinition {
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

export function buildLocalBookSlotToolDefinition(appointmentsUrl: string): HttpApiToolDefinition {
    return postTool(
        appointmentsUrl,
        {
            slot_start: '{{slot_start}}',
            patient_name: '{{patient_name}}',
            visit_type: '{{preferred_visit_type}}',
            attendee_email: '{{attendee_email}}',
            duration_minutes: 30,
        },
        BOOKING_RESPONSE_MAPPING,
    );
}

export function buildLocalRescheduleToolDefinition(
    baseUrl: string,
    response_mapping: Record<string, string>,
): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/appointments/reschedule`;
    return postTool(
        url,
        {
            appointment_id: '{{appointment_id}}',
            slot_start: '{{slot_start}}',
            patient_name: '{{patient_name}}',
        },
        response_mapping,
    );
}

export const LOCAL_SCHEDULING_TOOL_BUILDERS: Record<
    string,
    (baseUrl: string, appointmentsUrl?: string) => HttpApiToolDefinition
> = {
    book_slot: (_base, appointmentsUrl) =>
        buildLocalBookSlotToolDefinition(appointmentsUrl ?? `${_base}/api/v1/appointments`),
    book_demo: (_base, appointmentsUrl) =>
        buildLocalBookSlotToolDefinition(appointmentsUrl ?? `${_base}/api/v1/appointments`),
    book_qbr: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            {
                slot_start: '{{slot_start}}',
                patient_name: '{{account_name}}',
                visit_type: '{{qbr_meeting_type_default}}',
                attendee_email: '{{attendee_email}}',
                duration_minutes: 45,
            },
            BOOKING_RESPONSE_MAPPING,
        ),
    schedule_interview: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            {
                slot_start: '{{slot_start}}',
                patient_name: '{{candidate_name}}',
                visit_type: '{{interview_type_default}}',
            },
            INTERVIEW_RESPONSE_MAPPING,
        ),
    schedule_service_callback: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            { slot_start: '{{slot_start}}', patient_name: '{{caller_name}}' },
            {
                callback_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        ),
    schedule_adjuster_callback: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            { slot_start: '{{slot_start}}', patient_name: '{{caller_name}}' },
            {
                callback_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        ),
    schedule_branch_appointment: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            {
                slot_start: '{{slot_start}}',
                patient_name: '{{caller_name}}',
                visit_type: '{{preferred_branch_code}}',
            },
            BOOKING_RESPONSE_MAPPING,
        ),
    schedule_civic_callback: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            { slot_start: '{{slot_start}}', patient_name: '{{caller_name}}' },
            {
                callback_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        ),
    schedule_lead_callback: (_base, appointmentsUrl) =>
        postTool(
            appointmentsUrl ?? `${_base}/api/v1/appointments`,
            {
                slot_start: '{{slot_start}}',
                patient_name: '{{lead_name}}',
                visit_type: '{{crm_lead_source_code}}',
            },
            {
                callback_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        ),
    reschedule_appointment: (baseUrl) =>
        buildLocalRescheduleToolDefinition(baseUrl, BOOKING_RESPONSE_MAPPING),
    confirm_or_reschedule_interview: (baseUrl) =>
        buildLocalRescheduleToolDefinition(baseUrl, INTERVIEW_RESPONSE_MAPPING),
};

export const LOCAL_SCHEDULING_TOOL_NAMES = Object.keys(LOCAL_SCHEDULING_TOOL_BUILDERS);

export { BOOKING_RESPONSE_MAPPING };
