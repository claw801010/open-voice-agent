/**
 * Opt-in: writes 1280×720 PNGs into repo `docs/images/` for GTM / deck (see
 * catalog/recipes/http-api-analytics-redaction-gtm-demo.md § Screenshot pack).
 *
 * Run from `ui/` with API + UI up, same auth envs as analytics E2E:
 *   E2E_GTM_DECK_SCREENSHOTS=1 E2E_EMAIL=… E2E_PASSWORD=… PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e -- gtm-deck
 *
 * Optional: `E2E_GTM_SAMPLE_CALL_ID` — analytics `call_id` for call-detail capture
 * (e.g. from the Calls list after a test run).
 */
import path from "node:path";

import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

const slug = "healthcare-clinic-screening";

function gtmImagesDir(): string {
    return path.join(process.cwd(), "..", "docs", "images");
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("GTM deck screenshots (opt-in)", () => {
    test.beforeEach(async ({ page }) => {
        test.skip(
            process.env.E2E_GTM_DECK_SCREENSHOTS !== "1",
            "Set E2E_GTM_DECK_SCREENSHOTS=1 to capture docs/images/gtm-*.png (1280×720).",
        );

        await page.setViewportSize({ width: 1280, height: 720 });
        await loginAnalyticsE2E(page);
    });

    test("writes gtm-mk01-analytics-overview.png", async ({ page }) => {
        await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

        await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByLabel("Vertical slug (optional)")).toHaveValue(slug);

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-overview.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-calls.png", async ({ page }) => {
        await page.goto(`/analytics/calls?catalog_slug=${slug}`);

        await expect(page.getByRole("heading", { name: "Call list" })).toBeVisible({
            timeout: 30_000,
        });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-calls.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-scorecard-rubric.png", async ({ page }) => {
        await page.goto(`/analytics/calls?catalog_slug=${slug}`);

        const rubricHeading = page.getByRole("heading", { name: "QM scorecard rubric" });
        await expect(rubricHeading).toBeVisible({ timeout: 30_000 });
        await rubricHeading.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-scorecard-rubric.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-qm-schedule.png", async ({ page }) => {
        await page.goto(`/analytics/calls?catalog_slug=${slug}`);

        const qmHeading = page.getByRole("heading", { name: "Scheduled QM export" });
        await expect(qmHeading).toBeVisible({ timeout: 30_000 });
        await qmHeading.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-qm-schedule.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail.png when call id provided", async ({ page }) => {
        const callId = process.env.E2E_GTM_SAMPLE_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_SAMPLE_CALL_ID to capture call detail (e.g. wr-… from Calls list).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });

        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-review.png when call id provided", async ({ page }) => {
        const callId = process.env.E2E_GTM_SAMPLE_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_SAMPLE_CALL_ID to capture AI call review panel.");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        const reviewHeading = page.getByRole("heading", { name: "AI call review" });
        await reviewHeading.scrollIntoViewIfNeeded();
        await expect(reviewHeading).toBeVisible({ timeout: 30_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-review.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-quality-widget.png", async ({ page }) => {
        await page.goto(`/analytics?catalog_slug=${slug}&days=7`);

        await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible({
            timeout: 30_000,
        });
        const qualityHeading = page.getByRole("heading", { name: "CX & containment" });
        await qualityHeading.scrollIntoViewIfNeeded();
        await expect(qualityHeading).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-quality-widget.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-http-tool-happy-path.png when tool uuid provided", async ({ page }) => {
        const toolUuid = process.env.E2E_GTM_HTTP_TOOL_UUID?.trim();
        test.skip(!toolUuid, "Set E2E_GTM_HTTP_TOOL_UUID to capture HTTP tool editor (Tools list UUID).");

        await page.goto(`/tools/${encodeURIComponent(toolUuid)}`);
        await expect(page.getByText("Happy path", { exact: true })).toBeVisible({
            timeout: 30_000,
        });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-http-tool-happy-path.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-import-dialog.png", async ({ page }) => {
        await page.goto("/workflow");
        await expect(page.getByRole("heading", { name: "Your Agents" })).toBeVisible({
            timeout: 30_000,
        });
        await page.getByRole("button", { name: "Import external" }).click();
        await expect(page.getByRole("dialog", { name: "Import external flow" })).toBeVisible();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-import-dialog.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-workflow-get-started.png", async ({ page }) => {
        await page.goto("/workflow");
        await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible({
            timeout: 30_000,
        });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-workflow-get-started.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-workflow-editor-outcome-checklist.png when workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_WORKFLOW_ID to capture workflow editor guidance rail.");

        await page.goto(`/workflow/${encodeURIComponent(workflowId)}`);
        await expect(page.getByLabel("Workflow outcome checklist")).toBeVisible({
            timeout: 30_000,
        });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-workflow-editor-outcome-checklist.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-settings-http-cache-policy.png", async ({ page }) => {
        await page.goto("/settings");

        const cardTitle = page.getByText("HTTP integration cache (draft)");
        await expect(cardTitle).toBeVisible({ timeout: 30_000 });
        await cardTitle.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-settings-http-cache-policy.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-voice-profiles-page.png", async ({ page }) => {
        await page.goto("/voice-profiles");

        await expect(page.getByRole("heading", { name: "Voice profiles" })).toBeVisible({
            timeout: 30_000,
        });
        // Built-in preset names appear when GET /api/v1/voice-profiles is available (restart API after deploy).
        const preset = page.getByText(/Authentic|Professional|Warm —/).first();
        if (await preset.isVisible().catch(() => false)) {
            await preset.scrollIntoViewIfNeeded();
        }

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-voice-profiles-page.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-workflow-voice-profile-quick-pick.png", async ({ page }) => {
        const workflowId = process.env.E2E_GTM_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_WORKFLOW_ID (editable workflow) to capture canvas voice profile quick-pick.",
        );

        await page.goto(`/workflow/${encodeURIComponent(workflowId)}`);
        const quickPick = page.getByTestId("voice-profile-canvas-quick-pick");
        await expect(quickPick).toBeVisible({ timeout: 30_000 });

        await page.screenshot({
            path: path.join(
                gtmImagesDir(),
                "gtm-we01-workflow-voice-profile-quick-pick.png",
            ),
            fullPage: false,
        });
    });
});
