/**
 * WE-01-TEST: POST /workflow/{id}/simulation/text-turn (OpenAPI client may lag; fetch + auth).
 */

export type SimulationChatTurn = { role: 'user' | 'assistant'; content: string };

export type SimulationTextTurnPayload = {
    message: string;
    conversation_history: { role: string; content: string }[];
    /** Optional role-play hint prepended to each user turn on the server (WE-01-TEST). */
    user_persona?: string;
};

function backendBaseUrl(): string {
    if (typeof window === 'undefined') {
        return process.env.BACKEND_URL || 'http://127.0.0.1:8000';
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin;
}

async function parseApiError(res: Response): Promise<string> {
    const j: unknown = await res.json().catch(() => null);
    if (!j || typeof j !== 'object') return res.statusText || 'Request failed';
    const detail = (j as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e: unknown) =>
                typeof e === 'object' && e !== null && 'msg' in e
                    ? String((e as { msg: string }).msg)
                    : JSON.stringify(e),
            )
            .join('; ');
    }
    return JSON.stringify(j);
}

export async function postSimulationTextTurn(
    workflowId: number,
    payload: SimulationTextTurnPayload,
    getAccessToken: () => Promise<string | null | undefined>,
): Promise<{ reply: string }> {
    const token = await getAccessToken();
    const res = await fetch(`${backendBaseUrl()}/api/v1/workflow/${workflowId}/simulation/text-turn`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(await parseApiError(res));
    }
    return res.json() as Promise<{ reply: string }>;
}
