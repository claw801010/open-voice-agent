import type { Page } from "@playwright/test";

/**
 * Stack auth: seed session cookies via `/impersonate` (refresh token).
 * Requires UI built with `NEXT_PUBLIC_STACK_PROJECT_ID` matching the token's project.
 * Use only in staging / disposable accounts — the token travels in the query string.
 */
export async function loginStackSessionViaImpersonate(
    page: Page,
    opts: {
        baseURL: string;
        refreshToken: string;
        /** Path + optional query on the same origin (e.g. `/analytics` or `/templates`). */
        redirectPath?: string;
    },
): Promise<void> {
    const redirect = opts.redirectPath ?? "/templates";
    const url = new URL("/impersonate", opts.baseURL);
    url.searchParams.set("refresh_token", opts.refreshToken);
    url.searchParams.set("redirect_path", redirect);
    await page.goto(url.toString());
}
