import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Review inbox (OSS middleware)", () => {
    test("redirects unauthenticated /analytics/review to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto("/analytics/review");

        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});

test.describe("Review inbox (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("loads review inbox shell and privacy notice", async ({ page }) => {
        await page.goto("/analytics/review");

        await expect(page.getByTestId("review-inbox")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Review inbox" })).toBeVisible();
        await expect(page.getByText(/never train models on your patient data/i)).toBeVisible();
        await expect(page.getByRole("tab", { name: "Review" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Approved" })).toBeVisible();
    });

    test("creates pending item via API and approves from inbox", async ({ page, request }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: review inbox API flow not validated in this mode.",
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

        const callsRes = await request.get(`${backendURL}/api/v1/analytics/calls?limit=1`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(callsRes.ok()).toBeTruthy();
        const callsBody = (await callsRes.json()) as { items: { call_id: string }[] };
        const callId = callsBody.items?.[0]?.call_id;
        test.skip(!callId, "No analytics calls in org — run a Web test first for full inbox E2E.");

        const fuRes = await request.post(`${backendURL}/api/v1/analytics/calls/${callId}/follow-ups`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            data: {
                action_type: "sms",
                notes: "E2E prior auth denial review",
                contact_hint: "Maria Rodriguez",
                suggested_message: "We are appealing your MRI prior auth with Blue Cross.",
                requires_review: true,
            },
        });
        expect(fuRes.ok()).toBeTruthy();
        const fu = (await fuRes.json()) as { id: string };

        await page.goto("/analytics/review");

        await expect(page.getByTestId("review-inbox")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText("Maria Rodriguez")).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/appealing your MRI prior auth/i)).toBeVisible();

        await page.getByRole("button", { name: "Approve & send" }).first().click();
        await expect(page.getByText("Approved & queued")).toBeVisible({ timeout: 15_000 });

        const approvedTab = page.getByRole("tab", { name: "Approved" });
        await approvedTab.click();
        await expect(page.getByText("Maria Rodriguez")).toBeVisible({ timeout: 15_000 });

        void fu;
    });
});
