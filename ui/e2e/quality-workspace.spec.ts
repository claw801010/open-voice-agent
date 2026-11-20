import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Quality workspace (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("quality page shows improvement queue and policy", async ({ page }) => {
        await page.goto("/analytics/quality");
        await expect(page.getByTestId("quality-workspace")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("quality-improvement-queue")).toBeVisible();
        await expect(page.getByTestId("si-policy-mode")).toBeVisible();
        await page.getByRole("tab", { name: "Omnichannel timeline" }).click();
        await expect(page.getByTestId("quality-interaction-timeline")).toBeVisible();
    });

    test("analytics subnav includes quality link", async ({ page }) => {
        await page.goto("/analytics");
        await expect(page.getByRole("link", { name: "Quality & improvement" })).toBeVisible();
    });
});
