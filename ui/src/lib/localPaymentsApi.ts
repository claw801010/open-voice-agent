import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type LocalPaymentsConfig = {
    enabled: boolean;
    payment_promises_url: string;
    payment_redirect_confirm_url: string;
    visits_enroll_url: string;
    local_payments_base_url: string;
    message: string;
};

export type LocalPaymentRecord = {
    id: string;
    type: string;
    account_reference?: string | null;
    promised_amount?: string | null;
    promised_date?: string | null;
    redirect_url?: string | null;
    confirmation_code: string;
    created_at: string;
    status: string;
};

export async function fetchLocalPaymentsConfig(): Promise<LocalPaymentsConfig> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-payments/config`);
    if (!res.ok) {
        throw new Error('Failed to load local payments config');
    }
    return res.json() as Promise<LocalPaymentsConfig>;
}

export async function fetchLocalPaymentRecords(token: string): Promise<LocalPaymentRecord[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-payments/records`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load payment records');
    }
    const data = (await res.json()) as { records: LocalPaymentRecord[] };
    return data.records ?? [];
}
