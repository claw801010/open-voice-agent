import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

test.describe("Inference profiles (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("model configurations shows inference profile quick switch", async ({ page }) => {
        const profilesLoaded = page.waitForResponse(
            (res) => res.url().includes("/api/v1/inference-profiles") && res.status() === 200,
            { timeout: 30_000 },
        );
        await page.goto("/model-configurations");
        await profilesLoaded;

        await expect(page.getByTestId("inference-profile-quick-switch")).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByTestId("inference-profile-card-local_edge_lean")).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByTestId("inference-profile-card-hybrid_edge")).toBeVisible();
        await expect(page.getByTestId("inference-profile-card-cloud_balanced")).toBeVisible();
        await expect(page.getByTestId("local-inference-setup-panel")).toBeVisible();
    });

    test("switch cloud then local inference profile", async ({ page }) => {
        const profilesLoaded = page.waitForResponse(
            (res) => res.url().includes("/api/v1/inference-profiles") && res.status() === 200,
            { timeout: 30_000 },
        );

        await page.goto("/model-configurations");
        await expect(page.getByTestId("inference-profile-quick-switch")).toBeVisible({
            timeout: 30_000,
        });
        await profilesLoaded;

        const applyCloud = page.getByTestId("inference-profile-apply-cloud_balanced");
        const applyLocal = page.getByTestId("inference-profile-apply-local_edge_lean");

        await expect(applyCloud).toBeVisible();
        await expect(applyLocal).toBeVisible();

        const cloudActive = (await applyCloud.textContent())?.includes("Active");
        if (!cloudActive) {
            const applyCloudReq = page.waitForResponse(
                (res) =>
                    res.url().includes("/api/v1/inference-profiles/cloud_balanced/apply") &&
                    res.status() === 200,
                { timeout: 30_000 },
            );
            await applyCloud.click();
            await applyCloudReq;
            await expect(page.getByText(/Switched to Cloud balanced/i)).toBeVisible({
                timeout: 20_000,
            });
            await expect(applyCloud).toHaveText("Active");
        }

        const applyLocalReq = page.waitForResponse(
            (res) =>
                res.url().includes("/api/v1/inference-profiles/local_edge_lean/apply") &&
                res.status() === 200,
            { timeout: 30_000 },
        );
        await applyLocal.click();
        await applyLocalReq;
        await expect(page.getByText(/Switched to Local edge \(lean\)/i)).toBeVisible({
            timeout: 20_000,
        });
        await expect(applyLocal).toHaveText("Active");
    });

    test("workflow settings shows inference profile override", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: catalog install not validated in this mode.",
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
        await page.getByLabel("Workflow name").fill(`E2E inference profile ${suffix}`);

        const installSubmit = dialog.getByRole("button", { name: "Install", exact: true });
        await expect(installSubmit).toBeEnabled({ timeout: 15_000 });
        await installSubmit.click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();
        await expect(page.getByText("Installed from catalog")).toBeHidden({ timeout: 30_000 });

        await page.getByRole("link", { name: "Workflow settings" }).click();
        await expect(page.getByTestId("workflow-inference-profile-select")).toBeVisible({
            timeout: 30_000,
        });
    });
});
