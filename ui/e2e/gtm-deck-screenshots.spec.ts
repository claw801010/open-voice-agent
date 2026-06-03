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

import { expect, test, type Page } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";

const slug = "healthcare-clinic-screening";

function gtmImagesDir(): string {
    return path.join(process.cwd(), "..", "docs", "images");
}

async function openCatalogWorkflowEditor(page: Page, workflowId: string) {
    await page.goto(`/workflow/${encodeURIComponent(workflowId)}`);
    const catalogBanner = page.getByText("Installed from catalog");
    if (await catalogBanner.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await page.getByRole("button", { name: "Customize" }).click();
        await expect(catalogBanner).toBeHidden({ timeout: 30_000 });
    }
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

    test("writes gtm-mk01-analytics-live-workflow.png when call id provided", async ({ page }) => {
        const callId = process.env.E2E_GTM_SAMPLE_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_SAMPLE_CALL_ID to capture live workflow timeline.");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        const timeline = page.getByTestId("live-workflow-timeline");
        await timeline.scrollIntoViewIfNeeded();
        await expect(timeline).toBeVisible({ timeout: 30_000 });
        await expect(timeline.getByText("Prior auth verified")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-live-workflow.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-review-inbox.png", async ({ page }) => {
        await page.goto("/analytics/review");

        await expect(page.getByTestId("review-inbox")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("heading", { name: "Review inbox" })).toBeVisible();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-review-inbox.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-settings-local-ehr-records.png", async ({ page }) => {
        await page.goto("/settings");

        const ehrHeading = page.getByRole("heading", { name: "Local demo EHR" });
        await expect(ehrHeading).toBeVisible({ timeout: 30_000 });
        await ehrHeading.scrollIntoViewIfNeeded();

        const section = page.getByTestId("local-ehr-section");
        await expect(section).toBeVisible({ timeout: 15_000 });
        await expect(section.getByTestId("local-ehr-mode-select")).toBeVisible();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-settings-local-ehr-records.png"),
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

    test("writes gtm-mk01-analytics-call-detail-retail-collections.png when retail call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_RETAIL_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_RETAIL_CALL_ID (collections_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("capture_payment_promise")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-retail-collections.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-telecom-outage.png when telecom call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_TELECOM_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_TELECOM_CALL_ID (outage_status_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("lookup_outage_status")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-telecom-outage.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-b2b-conversion.png when B2B call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_B2B_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_B2B_CALL_ID (conversion_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("update_crm_deal_stage")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-b2b-conversion.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-insurance-claims.png when insurance call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_INSURANCE_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_INSURANCE_CALL_ID (claims_lookup_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("lookup_claim_status")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-insurance-claims.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-banking-balance.png when banking call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_BANKING_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_BANKING_CALL_ID (balance_lookup_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("lookup_account_balance")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-banking-balance.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-hospitality-waiver.png when hospitality call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_HOSPITALITY_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_HOSPITALITY_CALL_ID (waiver_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("apply_cancellation_waiver")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-hospitality-waiver.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-smb-leads.png when SMB call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_SMB_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_SMB_CALL_ID (lead_capture_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("capture_lead_intent")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-smb-leads.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-civic-permits.png when civic call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_CIVIC_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_CIVIC_CALL_ID (permit_status_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("lookup_permit_status")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-civic-permits.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-analytics-call-detail-hr-recruiting.png when HR call id provided", async ({
        page,
    }) => {
        const callId = process.env.E2E_GTM_HR_CALL_ID?.trim();
        test.skip(!callId, "Set E2E_GTM_HR_CALL_ID (application_status_complex demo call).");

        await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

        await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
            timeout: 30_000,
        });
        const traceHeading = page.getByRole("heading", { name: "Call trace & quality" });
        await traceHeading.scrollIntoViewIfNeeded();
        await expect(traceHeading).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("lookup_application_status")).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-analytics-call-detail-hr-recruiting.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-settings-local-payments-collections.png", async ({ page }) => {
        await page.goto("/settings#local-payments");

        const heading = page.getByRole("heading", { name: "Local demo payments" });
        await expect(heading).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("local-payments-section")).toBeVisible({ timeout: 15_000 });
        await heading.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-settings-local-payments-collections.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-settings-local-integrations-outage.png", async ({ page }) => {
        await page.goto("/settings#local-integrations");

        const heading = page.getByRole("heading", { name: "Local demo integrations" });
        await expect(heading).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("local-integrations-section")).toBeVisible({ timeout: 15_000 });
        await heading.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-settings-local-integrations-outage.png"),
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

    test("writes gtm-mk01-workflow-wire-retail-payments.png when retail workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_RETAIL_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_RETAIL_WORKFLOW_ID (collections_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("collections_complex")).toBeVisible({ timeout: 15_000 });
        const wirePayments = page.getByTestId("wire-local-payments-button");
        await expect(wirePayments).toBeVisible({ timeout: 15_000 });
        await wirePayments.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-retail-payments.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-telecom-integrations.png when telecom workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_TELECOM_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_TELECOM_WORKFLOW_ID (outage_status_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("outage_status_complex")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-telecom-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-b2b-integrations.png when B2B workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_B2B_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_B2B_WORKFLOW_ID (conversion_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("conversion_complex")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-b2b-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-insurance-integrations.png when insurance workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_INSURANCE_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_INSURANCE_WORKFLOW_ID (claims_lookup_complex catalog workflow).",
        );

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("claims_lookup_complex")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-insurance-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-banking-integrations.png when banking workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_BANKING_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_BANKING_WORKFLOW_ID (balance_lookup_complex catalog workflow).",
        );

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("balance_lookup_complex")).toBeVisible({ timeout: 15_000 });
        await expect(guide.getByText("Buyer story:")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-banking-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-hospitality-integrations.png when hospitality workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_HOSPITALITY_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_HOSPITALITY_WORKFLOW_ID (waiver_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("waiver_complex")).toBeVisible({ timeout: 15_000 });
        await expect(guide.getByText("Buyer story:")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-hospitality-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-smb-integrations.png when SMB workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_SMB_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_SMB_WORKFLOW_ID (lead_capture_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("lead_capture_complex")).toBeVisible({ timeout: 15_000 });
        await expect(guide.getByText("Buyer story:")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-smb-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-civic-integrations.png when civic workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_CIVIC_WORKFLOW_ID?.trim();
        test.skip(!workflowId, "Set E2E_GTM_CIVIC_WORKFLOW_ID (permit_status_complex catalog workflow).");

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("permit_status_complex")).toBeVisible({ timeout: 15_000 });
        await expect(guide.getByText("Buyer story:")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-civic-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-hr-integrations.png when HR workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_HR_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_HR_WORKFLOW_ID (application_status_complex catalog workflow).",
        );

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("application_status_complex")).toBeVisible({ timeout: 15_000 });
        await expect(guide.getByText("Buyer story:")).toBeVisible({ timeout: 15_000 });
        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 15_000 });
        await wireIntegrations.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-hr-integrations.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-wire-ehr-messaging.png when workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_WORKFLOW_ID (ehr_sync_complex catalog workflow) to capture EHR + messaging wire guide.",
        );

        await openCatalogWorkflowEditor(page, workflowId);
        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        const wireEhr = page.getByTestId("wire-local-ehr-button");
        const wireMessaging = page.getByTestId("wire-local-messaging-button");
        await expect(wireEhr).toBeVisible({ timeout: 15_000 });
        await expect(wireMessaging).toBeVisible({ timeout: 15_000 });
        await wireEhr.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-wire-ehr-messaging.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-workflow-catalog-guide-wire-local.png when workflow id provided", async ({
        page,
    }) => {
        const workflowId = process.env.E2E_GTM_WORKFLOW_ID?.trim();
        test.skip(
            !workflowId,
            "Set E2E_GTM_WORKFLOW_ID (catalog-installed workflow) to capture wire-local guide.",
        );

        await openCatalogWorkflowEditor(page, workflowId);

        const wireEhr = page.getByTestId("wire-local-ehr-button");
        const wireCalendar = page.getByRole("button", { name: "Wire local calendar" });
        if (await wireEhr.isVisible({ timeout: 15_000 }).catch(() => false)) {
            await wireEhr.scrollIntoViewIfNeeded();
        } else {
            await expect(wireCalendar).toBeVisible({ timeout: 30_000 });
            await wireCalendar.scrollIntoViewIfNeeded();
        }

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-workflow-catalog-guide-wire-local.png"),
            fullPage: false,
        });
    });

    test("writes gtm-mk01-settings-local-all-in-one.png", async ({ page }) => {
        await page.goto("/settings");

        await expect(page.getByText("Local demo calendar")).toBeVisible({ timeout: 30_000 });
        const payments = page.getByText("Local demo payments");
        await payments.scrollIntoViewIfNeeded();
        await expect(payments).toBeVisible({ timeout: 15_000 });
        const integrations = page.getByText("Local demo integrations");
        await integrations.scrollIntoViewIfNeeded();
        await expect(integrations).toBeVisible({ timeout: 15_000 });

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-mk01-settings-local-all-in-one.png"),
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
        const preset = page.getByText(/Authentic — natural|Professional|Warm —/).first();
        if (await preset.isVisible().catch(() => false)) {
            await preset.scrollIntoViewIfNeeded();
        }

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-voice-profiles-page.png"),
            fullPage: false,
        });
    });

    test("writes gtm-we01-voice-profiles-natural-delivery.png", async ({ page }) => {
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
        await editor.scrollIntoViewIfNeeded();

        await page.screenshot({
            path: path.join(gtmImagesDir(), "gtm-we01-voice-profiles-natural-delivery.png"),
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
        const catalogBanner = page.getByText("Installed from catalog");
        if (await catalogBanner.isVisible({ timeout: 15_000 }).catch(() => false)) {
            await page.getByRole("button", { name: "Customize" }).click();
            await expect(catalogBanner).toBeHidden({ timeout: 30_000 });
        }
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
