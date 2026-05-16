import type { Page } from "@playwright/test";

type LoginResponseBody = {
    token: string;
    user: {
        id: number;
        email?: string | null;
        name?: string | null;
        organization_id?: number | null;
        provider_id?: string | null;
    };
};

/** Log in via OSS API + Next `/api/auth/session` so middleware allows `/analytics`. */
export async function loginOssSessionFromBackend(
    page: Page,
    opts: {
        baseURL: string;
        backendURL: string;
        email: string;
        password: string;
    },
): Promise<void> {
    const loginRes = await page.request.post(`${opts.backendURL}/api/v1/auth/login`, {
        data: { email: opts.email, password: opts.password },
        headers: { "Content-Type": "application/json" },
    });
    if (!loginRes.ok()) {
        throw new Error(`OSS login failed (${loginRes.status()}): ${await loginRes.text()}`);
    }
    const body = (await loginRes.json()) as LoginResponseBody;
    const sessionRes = await page.request.post(`${opts.baseURL}/api/auth/session`, {
        data: { token: body.token, user: body.user },
        headers: { "Content-Type": "application/json" },
    });
    if (sessionRes.ok()) {
        return;
    }
    // Dev servers sometimes fail on route-handler `cookies()`; set OSS cookies directly.
    const host = new URL(opts.baseURL).hostname;
    const cookieBase = {
        domain: host,
        path: "/",
        httpOnly: true,
        sameSite: "Lax" as const,
    };
    await page.context().addCookies([
        { ...cookieBase, name: "dograh_auth_token", value: body.token },
        {
            ...cookieBase,
            name: "dograh_auth_user",
            value: JSON.stringify(body.user),
        },
    ]);
}
