import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("OSS local middleware", () => {
    test("redirects unauthenticated /overview to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto("/overview");

        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });

    test("redirects unauthenticated /reports to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto("/reports");

        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});

test.describe("Stack auth (no OSS middleware redirect)", () => {
    test("unauthenticated /overview does not send users to /auth/login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH !== "1", "Set E2E_EXPECT_STACK_AUTH=1 for Stack deployments.");

        await page.goto("/overview");

        await expect(page).not.toHaveURL(/\/auth\/login/);
    });

    test("unauthenticated /reports does not send users to /auth/login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH !== "1", "Set E2E_EXPECT_STACK_AUTH=1 for Stack deployments.");

        await page.goto("/reports");

        await expect(page).not.toHaveURL(/\/auth\/login/);
    });
});

test.describe("Operator shell authenticated (OSS / Stack)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("overview hub renders bento quick actions", async ({ page }) => {
        await page.goto("/overview");

        await expect(page.getByRole("heading", { name: /Welcome to Dograh|Welcome,/ })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByRole("link", { name: "Go to agents" })).toBeVisible();
        const usageLink = page.getByRole("link", { name: "Usage" });
        await usageLink.scrollIntoViewIfNeeded();
        await expect(usageLink).toBeVisible();
        const analyticsLink = page.getByRole("link", { name: "Analytics" });
        await analyticsLink.scrollIntoViewIfNeeded();
        await expect(analyticsLink).toBeVisible();
    });

    test("reports page renders daily shell and filters", async ({ page }) => {
        await page.goto("/reports");

        await expect(page.getByRole("heading", { name: "Daily reports" })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByText("Showing data for")).toBeVisible();
        await expect(page.getByRole("combobox")).toBeVisible();
    });
});
