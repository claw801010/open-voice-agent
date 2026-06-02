import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

const slug = "healthcare-clinic-screening";

test.describe("OSS local middleware", () => {
    test("redirects unauthenticated /analytics deep link to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });

    test("redirects unauthenticated /analytics/calls to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto("/analytics/calls?catalog_slug=healthcare-clinic-screening");

        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});

test.describe("Stack auth (no OSS middleware redirect)", () => {
    test("unauthenticated /analytics does not send users to /auth/login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH !== "1", "Set E2E_EXPECT_STACK_AUTH=1 for Stack deployments.");

        await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

        await expect(page).not.toHaveURL(/\/auth\/login/);
    });

    test("unauthenticated /analytics/calls does not send users to /auth/login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH !== "1", "Set E2E_EXPECT_STACK_AUTH=1 for Stack deployments.");

        await page.goto("/analytics/calls");

        await expect(page).not.toHaveURL(/\/auth\/login/);
    });
});

test.describe("Analytics authenticated (OSS / Stack)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test.describe("Overview", () => {
        test("catalog_slug query hydrates Overview filters", async ({ page }) => {
            await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

            await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
            await expect(page.getByLabel("Vertical slug (optional)")).toHaveValue(slug);
        });

        test("revenue motions widget links example tools when variant set", async ({ page }) => {
            await page.goto(
                `/analytics?catalog_slug=${slug}&catalog_variant_id=booking_complex&days=7`,
            );

            await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
            await expect(page.getByRole("heading", { name: "Revenue & booking (roadmap vs shipped)" })).toBeVisible({
                timeout: 30_000,
            });

            const bookSlot = page.getByRole("link", { name: "book_slot" });
            await expect(bookSlot).toBeVisible();
            await expect(bookSlot).toHaveAttribute(
                "href",
                /\/analytics\/calls\?.*tool_name=book_slot.*catalog_slug=healthcare-clinic-screening.*catalog_variant_id=booking_complex/,
            );
        });

        test("PII redaction switch is interactive when role may disable", async ({ page }) => {
            test.skip(
                process.env.E2E_STRICT_REDACTION_RBAC === "1" &&
                    process.env.E2E_EXPECT_SUPERUSER_MAY_DISABLE !== "1",
                "Strict RBAC locks the switch for members; superuser phase sets E2E_EXPECT_SUPERUSER_MAY_DISABLE=1.",
            );

            await page.goto("/analytics");

            await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
            await expect(page.getByText("PII redaction (organization)")).toBeVisible();

            const toggle = page.getByRole("switch", { name: "Toggle PII redaction for analytics exports" });
            await expect(toggle).toBeVisible({ timeout: 30_000 });
            await expect(toggle).not.toBeDisabled({ timeout: 30_000 });
        });

        test("PII redaction switch locked when API denies disable (strict local RBAC)", async ({ page }) => {
            test.skip(
                process.env.E2E_STRICT_REDACTION_RBAC !== "1" ||
                    process.env.E2E_EXPECT_SUPERUSER_MAY_DISABLE === "1",
                "Member-only: skip when running superuser may-disable phase.",
            );

            await page.goto("/analytics");

            await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();

            const toggle = page.getByRole("switch", { name: "Toggle PII redaction for analytics exports" });
            await expect(toggle).toBeVisible({ timeout: 30_000 });
            await expect(toggle).toBeChecked({ timeout: 30_000 });
            await expect(toggle).toBeDisabled();
            await expect(
                page.getByText(/Turning redaction off requires an administrator or permitted role/i),
            ).toBeVisible();
        });
    });

    test.describe("Calls list", () => {
        test("shows call list shell and scheduled QM export card", async ({ page }) => {
            await page.goto(`/analytics/calls?catalog_slug=${slug}`);

            await expect(page.getByRole("heading", { name: "Call list" })).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByRole("heading", { name: "Scheduled QM export" })).toBeVisible();
            await expect(page.getByRole("button", { name: "Export CSV (server)" })).toBeVisible();
        });

        test("shows QM scorecard rubric editor on call list", async ({ page }) => {
            await page.goto(`/analytics/calls?catalog_slug=${slug}`);

            await expect(page.getByRole("heading", { name: "QM scorecard rubric" })).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByRole("button", { name: "Copy for QA node" })).toBeVisible();
            await expect(page.getByRole("button", { name: "Save rubric" })).toBeVisible();
        });
    });

    test.describe("Overview quality widget", () => {
        test("CX & containment widget visible with catalog filter", async ({ page }) => {
            await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

            await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
            await expect(page.getByRole("heading", { name: "CX & containment" })).toBeVisible({
                timeout: 30_000,
            });
        });
    });

    test.describe("Call detail (optional sample)", () => {
        test("scorecard and live trace panels when E2E_GTM_SAMPLE_CALL_ID set", async ({ page }) => {
            const callId = process.env.E2E_GTM_SAMPLE_CALL_ID?.trim();
            test.skip(!callId, "Set E2E_GTM_SAMPLE_CALL_ID (e.g. wr-…) for call-detail smoke.");

            await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

            await expect(page.getByRole("heading", { name: "QM scorecard" })).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByRole("heading", { name: "Call trace & quality" })).toBeVisible();
            await expect(page.getByRole("heading", { name: "AI call review" })).toBeVisible();
            await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();

            const reviewDone = page.waitForResponse(
                (r) =>
                    r.url().includes("/ai-review") &&
                    r.request().method() === "POST" &&
                    r.ok(),
                { timeout: 30_000 },
            );
            await page.getByRole("button", { name: "Generate" }).click();
            await reviewDone;
            await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible({
                timeout: 15_000,
            });
            await expect(page.getByText(/Review generated/i)).toBeVisible({ timeout: 10_000 });
        });
    });
});
