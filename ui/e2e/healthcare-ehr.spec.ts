import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Healthcare EHR settings (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("settings shows local EHR connector and messaging sections", async ({ page }) => {
        await page.goto("/settings");

        await expect(page.getByRole("heading", { name: "Local demo EHR" })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByTestId("local-ehr-section")).toBeVisible();
        await expect(page.getByTestId("local-ehr-mode-select")).toBeVisible();
        await expect(page.getByTestId("local-ehr-vendor-select")).toBeVisible();
        await expect(page.getByText(/Local patient chart index/i)).toBeVisible({ timeout: 15_000 });

        await expect(page.getByRole("heading", { name: "Local demo messaging" })).toBeVisible();
        await expect(page.getByTestId("local-messaging-section")).toBeVisible();
    });

    test("toggles record keeping mode and shows chart sync log labels", async ({ page, request }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: local EHR mode toggle not validated in this mode.",
        );

        const backendURL = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8000";
        const loginRes = await request.post(`${backendURL}/api/v1/auth/login`, {
            data: {
                email: process.env.E2E_EMAIL!.trim(),
                password: process.env.E2E_PASSWORD!,
            },
        });
        expect(loginRes.ok()).toBeTruthy();
        const { token, user } = (await loginRes.json()) as {
            token: string;
            user: { organization_id?: number | null };
        };
        const orgId = user.organization_id ?? 1;
        const authHeaders = { Authorization: `Bearer ${token}` };

        await request.put(`${backendURL}/api/v1/local-ehr/connector`, {
            headers: authHeaders,
            data: {
                record_keeping_mode: "local_only",
                vendor: "none",
                connector_sync_enabled: false,
            },
        });
        const localSync = await request.post(`${backendURL}/api/v1/local-ehr/api/v1/chart/sync`, {
            data: {
                patient_token: "maria-rodriguez",
                summary: "E2E local-only chart note",
                organization_id: orgId,
            },
        });
        expect(localSync.ok()).toBeTruthy();

        await page.goto("/settings");
        const ehrSection = page.getByTestId("local-ehr-section");
        await expect(ehrSection).toBeVisible({ timeout: 30_000 });
        await expect(ehrSection.getByRole("cell", { name: "Local only" }).first()).toBeVisible({
            timeout: 15_000,
        });

        await page.getByTestId("local-ehr-mode-select").click();
        await page.getByRole("option", { name: /Local \+ sync to connector/i }).click();
        await expect(page.getByText(/Always write locally first/i)).toBeVisible({ timeout: 15_000 });
        await page.getByTestId("local-ehr-vendor-select").click();
        await page.getByRole("option", { name: /athenaHealth/i }).click();

        const connectorSync = await request.post(`${backendURL}/api/v1/local-ehr/api/v1/chart/sync`, {
            data: {
                patient_token: "maria-rodriguez",
                summary: "E2E connector sync chart note",
                organization_id: orgId,
            },
        });
        expect(connectorSync.ok()).toBeTruthy();

        await page.reload();
        const ehrAfter = page.getByTestId("local-ehr-section");
        await expect(ehrAfter).toBeVisible({ timeout: 30_000 });
        await expect(ehrAfter.getByRole("cell", { name: /Synced · athenahealth/i }).first()).toBeVisible({
            timeout: 15_000,
        });
    });
});

test.describe("Live workflow timeline (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("call detail shows live workflow for healthcare catalog slug filter", async ({ page, request }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: call detail timeline not validated in this mode.",
        );

        const backendURL = process.env.E2E_BACKEND_URL || "http://127.0.0.1:8000";
        const loginRes = await request.post(`${backendURL}/api/v1/auth/login`, {
            data: {
                email: process.env.E2E_EMAIL!.trim(),
                password: process.env.E2E_PASSWORD!,
            },
        });
        expect(loginRes.ok()).toBeTruthy();
        const { token } = (await loginRes.json()) as { token: string };

        const callsRes = await request.get(
            `${backendURL}/api/v1/analytics/calls?catalog_slug=healthcare-clinic-screening&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        expect(callsRes.ok()).toBeTruthy();
        const callId = ((await callsRes.json()) as { items: { call_id: string }[] }).items?.[0]?.call_id;
        test.skip(!callId, "No healthcare catalog calls — install ehr_sync_complex and run Web test.");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByTestId("live-workflow-timeline")).toBeVisible({ timeout: 30_000 });
    });
});
