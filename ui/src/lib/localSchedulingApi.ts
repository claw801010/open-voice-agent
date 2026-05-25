import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type LocalSchedulingConfig = {
    enabled: boolean;
    book_slot_url: string;
    lookup_availability_url: string;
    appointments_url: string;
    scheduling_api_base_url: string;
    open_schedule_url: string;
    default_open_slot_times_utc: string[];
    message: string;
};

export type LocalAppointmentRow = {
    id: string;
    slot_start: string;
    patient_name: string;
    visit_type: string;
    status: string;
    confirmation_code: string;
    created_at: string;
    attendee_email?: string | null;
    duration_minutes?: number;
    invite_download_url?: string;
};

export type LocalBookAppointmentResult = {
    appointment: { id: string; status: string; slot: { start: string } };
    confirmation_code: string;
    invite_download_url?: string;
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
    body: {
        slot_start: string;
        patient_name: string;
        visit_type?: string;
        attendee_email?: string;
        duration_minutes?: number;
    },
): Promise<LocalBookAppointmentResult> {
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
    return res.json() as Promise<LocalBookAppointmentResult>;
}

export async function fetchOpenSchedule(token: string): Promise<{ slot_times_utc: string[] }> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-scheduling/open-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load open schedule');
    }
    return res.json() as Promise<{ slot_times_utc: string[] }>;
}

export async function saveOpenSchedule(
    token: string,
    slot_times_utc: string[],
): Promise<{ slot_times_utc: string[] }> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-scheduling/open-schedule`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slot_times_utc }),
    });
    if (!res.ok) {
        throw new Error('Failed to save open schedule');
    }
    return res.json() as Promise<{ slot_times_utc: string[] }>;
}
