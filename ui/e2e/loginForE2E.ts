import { test, type Page } from "@playwright/test";

import { loginOssSessionFromBackend } from "./ossSession";
import { loginStackSessionViaImpersonate } from "./stackSession";

/**
 * Shared login for authenticated MK-01 Playwright specs (OSS signup or Stack).
 */
export async function loginAnalyticsE2E(page: Page): Promise<void> {
    const stackMode = process.env.E2E_EXPECT_STACK_AUTH === "1";
    const stackRefresh = process.env.E2E_STACK_REFRESH_TOKEN?.trim();
    const stackStorage = process.env.E2E_PLAYWRIGHT_STORAGE_STATE;

    test.skip(
        stackMode
            ? !stackRefresh && !stackStorage
            : !process.env.E2E_EMAIL?.trim() || !process.env.E2E_PASSWORD,
        stackMode
            ? "Stack E2E: set E2E_STACK_REFRESH_TOKEN and/or E2E_PLAYWRIGHT_STORAGE_STATE (file must exist for storage path)."
            : "Set E2E_EMAIL and E2E_PASSWORD for authenticated Playwright runs.",
    );

    const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
    const backendURL = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8000";

    if (stackMode) {
        if (!stackStorage) {
            await loginStackSessionViaImpersonate(page, {
                baseURL,
                refreshToken: stackRefresh!,
                redirectPath: "/templates",
            });
        }
        return;
    }

    await loginOssSessionFromBackend(page, {
        baseURL,
        backendURL,
        email: process.env.E2E_EMAIL!.trim(),
        password: process.env.E2E_PASSWORD!,
    });
}
