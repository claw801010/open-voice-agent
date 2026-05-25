import { expect, test, type Page } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

/** Mark the graph dirty via the canvas **Tidy up layout** control (stable vs mouse-drag). */
async function markGraphDirtyViaTidyUp(page: Page): Promise<void> {
    const tidyUp = page.getByRole("button", { name: "Tidy up layout" });
    await expect(tidyUp).toBeVisible({ timeout: 30_000 });
    await tidyUp.click();
}

test.describe("Template catalog (OSS middleware)", () => {
    test("redirects unauthenticated /workflow/catalog to login", async ({ page }) => {
        test.skip(process.env.E2E_EXPECT_STACK_AUTH === "1", "Stack auth skips OSS login redirect");

        await page.goto("/workflow/catalog");

        await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});

test.describe("Template catalog (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("loads marketplace shell and vertical packs", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByText("Could not load catalog")).not.toBeVisible();
        await expect(page.getByText("Invalid catalog response")).not.toBeVisible();
    });
});

test.describe("Install from catalog → editor (authenticated + API)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("installs Patient screening pack, unlocks, saves draft, and publishes when valid", async ({
        page,
    }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: install flow not validated in this mode (session/API parity).",
        );

        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Patient screening & triage" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("heading", { name: "Name your workflow" })).toBeVisible();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E catalog install ${suffix}`);

        const installSubmit = dialog.getByRole("button", { name: "Install", exact: true });
        await expect(installSubmit).toBeEnabled({ timeout: 15_000 });
        await installSubmit.click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await expect(page.getByText("Installed from catalog")).toBeVisible({ timeout: 30_000 });
        const customize = page.getByRole("button", { name: "Customize" });
        await expect(customize).toBeVisible();

        await customize.click();

        await expect(page.getByText("Installed from catalog")).toBeHidden({ timeout: 30_000 });
        await expect(customize).toBeHidden();

        await markGraphDirtyViaTidyUp(page);

        await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible({ timeout: 15_000 });

        const saveBtn = page.getByRole("button", { name: "Save", exact: true });
        await expect(saveBtn).toBeEnabled({ timeout: 15_000 });
        await saveBtn.click();

        await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden({ timeout: 45_000 });
        await expect(saveBtn).toBeDisabled();

        const publishBtn = page.getByRole("button", { name: "Publish", exact: true });
        await expect(publishBtn).toBeVisible();
        if (await publishBtn.isEnabled()) {
            await publishBtn.click();
            await expect(page.getByText("Workflow published successfully")).toBeVisible({
                timeout: 45_000,
            });
            await expect(page.getByText("(Published)")).toBeVisible({ timeout: 15_000 });
        } else {
            await expect(
                page.getByRole("button", { name: /\d+ errors?/i }),
            ).toBeVisible({ timeout: 10_000 });
        }
    });
});

test.describe("Install complex variant from catalog → editor", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("installs retail collections_complex variant with graph agent label", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: variant install flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "WISMO & store policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("heading", { name: "Name your workflow" })).toBeVisible();

        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Collections \/ payment promise/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E retail collections ${suffix}`);

        const installSubmit = dialog.getByRole("button", { name: "Install", exact: true });
        await expect(installSubmit).toBeEnabled({ timeout: 15_000 });
        await installSubmit.click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await expect(page.getByText("Installed from catalog")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText("WISMO & collections")).toBeVisible({ timeout: 30_000 });
    });
});
