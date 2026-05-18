import type { HttpApiToolDefinition } from '@/client/types.gen';

/** Pre-filled HTTP tool for local demo calendar (MK-01 / GTM booking proof). */
export function buildLocalBookSlotToolDefinition(bookSlotUrl: string): HttpApiToolDefinition {
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url: bookSlotUrl,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(
                {
                    slot_start: '{{slot_start}}',
                    patient_name: '{{patient_name}}',
                    visit_type: '{{preferred_visit_type}}',
                },
                null,
                2,
            ),
            response_mapping: {
                appointment_id: 'appointment.id',
                slot_start: 'appointment.slot.start',
                confirmation_code: 'confirmation_code',
            },
        },
    };
}
