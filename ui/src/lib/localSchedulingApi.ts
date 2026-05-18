import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type LocalSchedulingConfig = {
    enabled: boolean;
    book_slot_url: string;
    lookup_availability_url: string;
};

export type LocalAppointmentRow = {
    id: string;
    slot_start: string;
    patient_name: string;
    visit_type: string;
    status: string;
    confirmation_code: string;
    created_at: string;
};

export async function fetchLocalSchedulingConfig(): Promise<LocalSchedulingConfig> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-scheduling/config`);
    if (!res.ok) {
        throw new Error('Failed to load local scheduling config');
    }
    return res.json() as Promise<LocalSchedulingConfig>;
}

export async function fetchLocalAppointments(token: string): Promise<LocalAppointmentRow[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-scheduling/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load appointments');
    }
    const data = (await res.json()) as { appointments: LocalAppointmentRow[] };
    return data.appointments ?? [];
}

export async function cancelLocalAppointment(token: string, appointmentId: string): Promise<void> {
    const res = await fetch(
        `${getBackendPublicBaseUrl()}/api/v1/local-scheduling/appointments/${encodeURIComponent(appointmentId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
        throw new Error('Failed to cancel appointment');
    }
}

export async function bookLocalAppointmentDemo(
    token: string,
    body: { slot_start: string; patient_name: string; visit_type?: string },
): Promise<void> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-scheduling/appointments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error('Failed to book appointment');
    }
}
