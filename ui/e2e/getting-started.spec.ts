import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Getting started wizard", () => {
    test("OSS redirects overview to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth: no OSS login redirect.");
        await page.goto("/overview");
        await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
    });

    test.describe("authenticated", () => {
        test.beforeEach(async ({ page }) => {
            await loginAnalyticsE2E(page);
        });

        test("overview shows getting started wizard with local models step", async ({ page }) => {
            await page.goto("/overview");
            await expect(page.getByTestId("getting-started-wizard")).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByTestId("getting-started-step-local_models")).toBeVisible();
            await expect(page.getByTestId("getting-started-panel-local")).toBeVisible();
            await expect(page.getByTestId("local-inference-setup-panel")).toBeVisible();
            await expect(page.getByTestId("getting-started-apply-local")).toBeVisible();
        });

        test("dismiss hides wizard for session storage", async ({ page }) => {
            await page.goto("/overview");
            await expect(page.getByTestId("getting-started-wizard")).toBeVisible({
                timeout: 30_000,
            });
            await page.getByTestId("getting-started-dismiss").click();
            await expect(page.getByTestId("getting-started-wizard")).toBeHidden();
            await page.reload();
            await expect(page.getByTestId("getting-started-wizard")).toBeHidden();
        });
    });
});
