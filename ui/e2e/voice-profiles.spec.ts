import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Voice profiles (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("voice profiles page lists built-in presets", async ({ page }) => {
        await page.goto("/voice-profiles");

        await expect(page.getByRole("heading", { name: "Voice profiles" })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByText(/Authentic|Professional/).first()).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByRole("button", { name: "New profile" })).toBeVisible();
    });

    test("authentic natural preset shows natural delivery controls", async ({ page }) => {
        const profilesLoaded = page.waitForResponse(
            (res) => res.url().includes("/api/v1/voice-profiles") && res.status() === 200,
            { timeout: 30_000 },
        );
        await page.goto("/voice-profiles");

        await expect(page.getByRole("heading", { name: "Voice profiles" })).toBeVisible({
            timeout: 30_000,
        });
        await profilesLoaded;

        const card = page.getByTestId("voice-profile-card-builtin:authentic_natural");
        await expect(card).toBeVisible({ timeout: 30_000 });
        await card.scrollIntoViewIfNeeded();
        await card.click();

        const editor = page.getByTestId("natural-delivery-editor");
        await expect(editor).toBeVisible({ timeout: 15_000 });
        await expect(editor.getByText("Natural delivery")).toBeVisible();
        await expect(editor.getByText("Short filler intensity")).toBeVisible();
        await expect(editor.getByText("Soft breath", { exact: true })).toBeVisible();
        await expect(editor.getByText("Key projection", { exact: true })).toBeVisible();
    });

    test("clone profile persists natural delivery toggle", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: voice profile CRUD not validated in this mode.",
        );

        await page.goto("/voice-profiles");
        await expect(page.getByRole("heading", { name: "Voice profiles" })).toBeVisible({
            timeout: 30_000,
        });

        await page.getByRole("button", { name: "New profile" }).click();
        await expect(page.getByRole("heading", { name: "Create voice profile" })).toBeVisible();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Name").fill(`E2E natural delivery ${suffix}`);
        await dialog.getByRole("combobox").click();
        await page.getByRole("option", { name: /Authentic — natural/i }).click();
        await dialog.getByRole("button", { name: "Create", exact: true }).click();

        await expect(page.getByText("Profile created")).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId("natural-delivery-editor")).toBeVisible();
    });

    test("workflow canvas quick-pick saves voice profile override", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: catalog install + voice profile save not validated in this mode.",
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
        await page.getByLabel("Workflow name").fill(`E2E voice profile ${suffix}`);

        const installSubmit = dialog.getByRole("button", { name: "Install", exact: true });
        await expect(installSubmit).toBeEnabled({ timeout: 15_000 });
        await installSubmit.click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();
        await expect(page.getByText("Installed from catalog")).toBeHidden({ timeout: 30_000 });

        const quickPick = page.getByTestId("voice-profile-canvas-quick-pick");
        await expect(quickPick).toBeVisible({ timeout: 30_000 });

        const trigger = quickPick.getByRole("combobox");
        await trigger.click();
        await page.getByRole("option", { name: /Warm — conversational/i }).click();

        await expect(page.getByText("Voice profile updated")).toBeVisible({ timeout: 20_000 });
    });
});
