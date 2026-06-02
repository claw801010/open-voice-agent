/**
 * Healthcare live workflow steps from HTTP tool spans (Saga-style EHR sync timeline).
 */
import type { AnalyticsCallDetail } from '@/lib/analyticsCallsApi';

export type LiveWorkflowStep = {
    id: string;
    label: string;
    detail?: string;
    status: 'done' | 'pending';
};

const TOOL_STEP_LABELS: Record<string, string> = {
    lookup_patient_context: 'Patient context loaded',
    verify_prior_auth: 'Prior auth verified',
    book_slot: 'Appointment scheduled',
    reschedule_appointment: 'Appointment rescheduled',
    send_confirmation_sms: 'Confirmation SMS sent',
    send_confirmation_email: 'Confirmation email sent',
    sync_chart_to_ehr: 'Chart synced to EHR',
};

function mappedSummary(toolName: string, mapped: Record<string, unknown> | undefined): string | undefined {
    if (!mapped || typeof mapped !== 'object') {
        return undefined;
    }
    if (toolName === 'verify_prior_auth') {
        const status = mapped.status_code ?? mapped.status;
        const exp = mapped.expires_at;
        if (status && exp) {
            return `Approved · expires ${String(exp).slice(0, 10)}`;
        }
    }
    if (toolName === 'book_slot' || toolName === 'reschedule_appointment') {
        const slot = mapped.slot_start;
        if (slot) {
            return String(slot).replace('T', ' · ').slice(0, 24);
        }
    }
    if (toolName === 'sync_chart_to_ehr') {
        const vendor = mapped.ehr_vendor;
        const status = mapped.connector_sync_status ?? mapped.status_code;
        if (status === 'local_only') {
            return 'Stored in local compliant chart';
        }
        if (vendor) {
            return `Synced to ${String(vendor)}`;
        }
    }
    if (toolName === 'send_confirmation_sms') {
        return 'SMS with date, time & prep instructions';
    }
    return undefined;
}

export function buildHealthcareLiveWorkflowSteps(detail: AnalyticsCallDetail): LiveWorkflowStep[] {
    const steps: LiveWorkflowStep[] = [
        {
            id: 'call-in',
            label: 'Patient calls in',
            detail: detail.outcomes?.customer_outcome ?? detail.outcomes?.outcome_key ?? undefined,
            status: 'done',
        },
    ];

    const spans = detail.tool_spans ?? [];
    for (const span of spans) {
        const name = span.tool_name?.trim();
        if (!name || !(name in TOOL_STEP_LABELS)) {
            continue;
        }
        const mapped = span.http?.mapped_data as Record<string, unknown> | undefined;
        steps.push({
            id: `tool-${name}-${steps.length}`,
            label: TOOL_STEP_LABELS[name]!,
            detail: mappedSummary(name, mapped),
            status: 'done',
        });
    }

    if (steps.length === 1 && (detail.workflow_slug === 'healthcare-clinic-screening' || detail.catalog_variant_id?.includes('ehr'))) {
        steps.push({
            id: 'await-tools',
            label: 'Wire EHR + scheduling tools to see live sync steps',
            status: 'pending',
        });
    }

    return steps;
}

export function showHealthcareLiveWorkflow(detail: AnalyticsCallDetail): boolean {
    return (
        detail.workflow_slug === 'healthcare-clinic-screening' ||
        (detail.catalog_variant_id ?? '').includes('ehr') ||
        (detail.tool_spans ?? []).some((s) => s.tool_name && s.tool_name in TOOL_STEP_LABELS)
    );
}
