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

    test("healthcare pack card shows natural delivery voice hint", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Patient screening & triage" });
        await expect(packCard.getByText(/natural delivery/i)).toBeVisible({ timeout: 15_000 });
        await expect(packCard.getByText(/Healthcare voice/i)).toBeVisible();
    });

    test("healthcare pack card links analytics proof for complex variant", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const proofLink = page.getByTestId("catalog-analytics-proof-healthcare-clinic-screening");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        await expect(proofLink).toHaveAttribute("href", /\/analytics\/calls\?/);
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=healthcare-clinic-screening");
        expect(href).toContain("catalog_variant_id=ehr_sync_complex");
        expect(href).toContain("tool_name=lookup_patient_context");

        const reviewLink = page.getByTestId("catalog-review-inbox-healthcare-clinic-screening");
        await expect(reviewLink).toBeVisible({ timeout: 15_000 });
        await expect(reviewLink).toHaveAttribute("href", "/analytics/review");
    });

    test("retail pack card links local payments settings", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const settingsLink = page.getByTestId("catalog-settings-local-retail-wismo-faq");
        await expect(settingsLink).toBeVisible({ timeout: 15_000 });
        await expect(settingsLink).toHaveAttribute("href", "/settings#local-payments");
        await expect(settingsLink).toHaveText("Local demo payments");
    });

    test("retail pack card links analytics proof for collections variant", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const proofLink = page.getByTestId("catalog-analytics-proof-retail-wismo-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        await expect(proofLink).toHaveAttribute("href", /\/analytics\/calls\?/);
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=retail-wismo-faq");
        expect(href).toContain("catalog_variant_id=collections_complex");
        expect(href).toContain("tool_name=capture_payment_promise");
    });

    test("telecom pack card links local integrations settings", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const settingsLink = page.getByTestId("catalog-settings-local-telecom-utilities-outage-faq");
        await expect(settingsLink).toBeVisible({ timeout: 15_000 });
        await expect(settingsLink).toHaveAttribute("href", "/settings#local-integrations");
    });

    test("telecom pack card links analytics proof for outage variant", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const proofLink = page.getByTestId("catalog-analytics-proof-telecom-utilities-outage-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        await expect(proofLink).toHaveAttribute("href", /\/analytics\/calls\?/);
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=telecom-utilities-outage-faq");
        expect(href).toContain("catalog_variant_id=outage_status_complex");
        expect(href).toContain("tool_name=lookup_outage_status");
    });

    test("B2B pack card links local integrations settings", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const settingsLink = page.getByTestId("catalog-settings-local-b2b-saas-trial-nurture");
        await expect(settingsLink).toBeVisible({ timeout: 15_000 });
        await expect(settingsLink).toHaveAttribute("href", "/settings#local-integrations");
    });

    test("B2B pack card links analytics proof for conversion variant", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const proofLink = page.getByTestId("catalog-analytics-proof-b2b-saas-trial-nurture");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        await expect(proofLink).toHaveAttribute("href", /\/analytics\/calls\?/);
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=b2b-saas-trial-nurture");
        expect(href).toContain("catalog_variant_id=conversion_complex");
        expect(href).toContain("tool_name=update_crm_deal_stage");
    });

    test("insurance pack card links local integrations settings", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const settingsLink = page.getByTestId("catalog-settings-local-insurance-fnol-faq");
        await expect(settingsLink).toBeVisible({ timeout: 15_000 });
        await expect(settingsLink).toHaveAttribute("href", "/settings#local-integrations");
    });

    test("insurance pack card links analytics proof for claims lookup variant", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const proofLink = page.getByTestId("catalog-analytics-proof-insurance-fnol-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        await expect(proofLink).toHaveAttribute("href", /\/analytics\/calls\?/);
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=insurance-fnol-faq");
        expect(href).toContain("catalog_variant_id=claims_lookup_complex");
        expect(href).toContain("tool_name=lookup_claim_status");
    });

    test("banking pack card shows buyer demo hint and analytics proof", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const hint = page.getByTestId("catalog-buyer-demo-hint-financial-services-banking-faq");
        await hint.scrollIntoViewIfNeeded();
        await expect(hint).toBeVisible({ timeout: 15_000 });
        await expect(hint).toContainText("tokenized balance");

        const proofLink = page.getByTestId("catalog-analytics-proof-financial-services-banking-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=financial-services-banking-faq");
        expect(href).toContain("catalog_variant_id=balance_lookup_complex");
        expect(href).toContain("tool_name=lookup_account_balance");

        const settingsLink = page.getByTestId("catalog-settings-local-financial-services-banking-faq");
        await expect(settingsLink).toHaveAttribute("href", "/settings#local-integrations");
    });

    test("hospitality pack card shows buyer demo hint and analytics proof", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const hint = page.getByTestId("catalog-buyer-demo-hint-hospitality-travel-concierge");
        await expect(hint).toBeVisible({ timeout: 15_000 });
        await expect(hint).toContainText("cancellation fee waiver");

        const proofLink = page.getByTestId("catalog-analytics-proof-hospitality-travel-concierge");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=hospitality-travel-concierge");
        expect(href).toContain("catalog_variant_id=waiver_complex");
        expect(href).toContain("tool_name=apply_cancellation_waiver");
    });

    test("SMB pack card shows buyer demo hint and analytics proof", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const hint = page.getByTestId("catalog-buyer-demo-hint-smb-franchise-location-faq");
        await expect(hint).toBeVisible({ timeout: 15_000 });
        await expect(hint).toContainText("lead capture");

        const proofLink = page.getByTestId("catalog-analytics-proof-smb-franchise-location-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=smb-franchise-location-faq");
        expect(href).toContain("catalog_variant_id=lead_capture_complex");
        expect(href).toContain("tool_name=capture_lead_intent");
    });

    test("civic pack card shows buyer demo hint and analytics proof", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const hint = page.getByTestId("catalog-buyer-demo-hint-public-sector-civic-services-faq");
        await expect(hint).toBeVisible({ timeout: 15_000 });
        await expect(hint).toContainText("Permit status");

        const proofLink = page.getByTestId("catalog-analytics-proof-public-sector-civic-services-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=public-sector-civic-services-faq");
        expect(href).toContain("catalog_variant_id=permit_status_complex");
        expect(href).toContain("tool_name=lookup_permit_status");
    });

    test("HR pack card shows buyer demo hint and analytics proof", async ({ page }) => {
        await page.goto("/workflow/catalog");

        const hint = page.getByTestId("catalog-buyer-demo-hint-hr-staffing-recruiting-faq");
        await expect(hint).toBeVisible({ timeout: 15_000 });
        await expect(hint).toContainText("ATS");

        const proofLink = page.getByTestId("catalog-analytics-proof-hr-staffing-recruiting-faq");
        await expect(proofLink).toBeVisible({ timeout: 15_000 });
        const href = await proofLink.getAttribute("href");
        expect(href).toContain("catalog_slug=hr-staffing-recruiting-faq");
        expect(href).toContain("catalog_variant_id=application_status_complex");
        expect(href).toContain("tool_name=lookup_application_status");
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

test.describe("Catalog guide — wire local all-in-one (authenticated + API)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    test("healthcare install shows Wire local calendar and wires successfully", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Patient screening & triage" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("heading", { name: "Name your workflow" })).toBeVisible();

        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Booking-ready prompts/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire calendar ${suffix}`);

        const installSubmit = dialog.getByRole("button", { name: "Install", exact: true });
        await expect(installSubmit).toBeEnabled({ timeout: 15_000 });
        await installSubmit.click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();
        await expect(page.getByText("Installed from catalog")).toBeHidden({ timeout: 30_000 });

        const wireCalendar = page.getByRole("button", { name: "Wire local calendar" });
        await expect(wireCalendar).toBeVisible({ timeout: 30_000 });
        await wireCalendar.click();

        await expect(page.getByText("Local calendar wired")).toBeVisible({ timeout: 30_000 });
    });

    test("healthcare ehr_sync_complex wires local EHR and messaging", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Patient screening & triage" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Full context \+ EHR sync/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire ehr sync ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("ehr_sync_complex")).toBeVisible();

        const wireEhr = page.getByTestId("wire-local-ehr-button");
        await expect(wireEhr).toBeVisible({ timeout: 15_000 });
        await wireEhr.click();
        await expect(page.getByText("Local EHR wired")).toBeVisible({ timeout: 30_000 });

        const wireMessaging = page.getByTestId("wire-local-messaging-button");
        await expect(wireMessaging).toBeVisible();
        await wireMessaging.click();
        await expect(page.getByText("Local messaging wired")).toBeVisible({ timeout: 30_000 });
    });

    test("telecom outage variant shows Wire local integrations", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Outage & billing FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Live outage status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire integrations ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("outage_status_complex")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("retail collections variant wires local payments", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "WISMO & store policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Collections \/ payment promise/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire payments ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("collections_complex")).toBeVisible();

        const wirePayments = page.getByTestId("wire-local-payments-button");
        await expect(wirePayments).toBeVisible({ timeout: 30_000 });
        await wirePayments.click();

        await expect(page.getByText("Local payments wired")).toBeVisible({ timeout: 30_000 });
    });

    test("retail collections variant shows payments wire only", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "WISMO & store policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Collections \/ payment promise/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E variant payments only ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        await expect(page.getByTestId("wire-local-payments-button")).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByTestId("wire-local-integrations-button")).not.toBeVisible();
        await expect(page.getByTestId("wire-local-ehr-button")).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Wire local calendar" })).not.toBeVisible();
    });

    test("telecom outage variant shows integrations wire only", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Outage & billing FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Live outage status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E variant integrations only ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        await expect(page.getByTestId("wire-local-integrations-button")).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByTestId("wire-local-payments-button")).not.toBeVisible();
        await expect(page.getByTestId("wire-local-ehr-button")).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Wire local calendar" })).not.toBeVisible();
    });

    test("outage variant shows catalog_variant_id on guide card", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: catalog guide variant badge not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Outage & billing FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Live outage status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E telecom variant badge ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("outage_status_complex")).toBeVisible();
    });

    test("catalog guide Preview analytics link includes variant and tool filters", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: catalog guide analytics link not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "WISMO & store policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Collections \/ payment promise/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E analytics link ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const previewAnalytics = page.getByRole("link", { name: "Preview analytics" });
        await expect(previewAnalytics).toBeVisible({ timeout: 30_000 });
        await expect(previewAnalytics).toHaveAttribute(
            "href",
            /catalog_slug=retail-wismo-faq/,
        );
        await expect(previewAnalytics).toHaveAttribute(
            "href",
            /catalog_variant_id=collections_complex/,
        );
        await expect(previewAnalytics).toHaveAttribute(
            "href",
            /tool_name=capture_payment_promise/,
        );
    });

    test("collections variant shows catalog_variant_id on guide card", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: catalog guide variant badge not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "WISMO & store policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Collections \/ payment promise/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E variant badge ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("collections_complex")).toBeVisible();
    });

    test("B2B conversion variant wires local integrations", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Trial nurture & PQL voice qual" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Trial → paid conversion/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire b2b conversion ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("conversion_complex")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("insurance claims lookup variant wires local integrations", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "FNOL guidance & policy FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Claims status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire insurance claims ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("claims_lookup_complex")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("banking balance variant wires local integrations with buyer story", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Card & branch banking FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Tokenized balance lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire banking balance ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("balance_lookup_complex")).toBeVisible();
        await expect(guide.getByText("Buyer story:")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("hospitality waiver variant wires local integrations with buyer story", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Travel concierge & booking FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Cancellation fee waiver/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire hospitality waiver ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("waiver_complex")).toBeVisible();
        await expect(guide.getByText("Buyer story:")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("SMB lead capture variant wires local integrations with buyer story", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Multi-location FAQ & lead callback" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /CRM lead capture/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire smb leads ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("lead_capture_complex")).toBeVisible();
        await expect(guide.getByText("Buyer story:")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("civic permit status variant wires local integrations with buyer story", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Civic services & permits FAQ" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Permit status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire civic permits ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("permit_status_complex")).toBeVisible();
        await expect(guide.getByText("Buyer story:")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("HR application status variant wires local integrations with buyer story", async ({ page }) => {
        test.skip(
            process.env.E2E_EXPECT_STACK_AUTH === "1",
            "Stack auth E2E: wire-local flow not validated in this mode.",
        );

        await page.goto("/workflow/catalog");

        const packCard = page.locator("article").filter({ hasText: "Candidate FAQ & interview scheduling" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await page.locator("#catalog-variant").click();
        await page.getByRole("option", { name: /Application status lookup/i }).click();

        const suffix = process.env.GITHUB_RUN_ID?.trim() || String(Date.now());
        await page.getByLabel("Workflow name").fill(`E2E wire hr recruiting ${suffix}`);

        await dialog.getByRole("button", { name: "Install", exact: true }).click();

        await expect(page).toHaveURL(/\/workflow\/\d+(\?|$)/, { timeout: 60_000 });
        await page.getByRole("button", { name: "Customize" }).click();

        const guide = page.getByTestId("catalog-guide-card");
        await expect(guide).toBeVisible({ timeout: 30_000 });
        await expect(guide.getByText("application_status_complex")).toBeVisible();
        await expect(guide.getByText("Buyer story:")).toBeVisible();

        const wireIntegrations = page.getByTestId("wire-local-integrations-button");
        await expect(wireIntegrations).toBeVisible({ timeout: 30_000 });
        await wireIntegrations.click();

        await expect(page.getByText("Local integrations wired")).toBeVisible({ timeout: 30_000 });
    });

    test("all vertical pack cards expose buyer demo hint strip", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const slugs = [
            "healthcare-clinic-screening",
            "retail-wismo-faq",
            "b2b-saas-trial-nurture",
            "insurance-fnol-faq",
            "hospitality-travel-concierge",
            "financial-services-banking-faq",
            "smb-franchise-location-faq",
            "telecom-utilities-outage-faq",
            "public-sector-civic-services-faq",
            "hr-staffing-recruiting-faq",
        ];

        for (const slug of slugs) {
            await expect(page.getByTestId(`catalog-buyer-demo-hint-${slug}`)).toBeVisible({
                timeout: 15_000,
            });
        }
    });

    test("healthcare install dialog defaults to ehr_sync with buyer hint", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Patient screening" });
        await packCard.getByRole("button", { name: "Install into my org" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(dialog.locator("#catalog-variant")).toContainText(/EHR/i);
        await expect(dialog.getByTestId("catalog-install-variant-hint")).toBeVisible();
        await expect(dialog.getByText(/chart to local EHR/i)).toBeVisible();
    });

    test("B2B LoopTalk dialog pre-selects conversion variant with buyer hint", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "Trial nurture" });
        await packCard.getByRole("button", { name: "Try (LoopTalk persona)" }).click();

        const dialog = page.getByRole("dialog", { name: "Try with LoopTalk (simulated caller)" });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByTestId("catalog-looptalk-variant-hint")).toBeVisible();
        await expect(dialog.getByText(/CRM/i)).toBeVisible();
        await expect(dialog.locator("#looptalk-variant")).toContainText(/Conversion/i);
    });

    test("retail voice preview dialog loads hosted audio", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "WISMO" });
        await packCard.getByRole("button", { name: "Preview voice script" }).click();

        const dialog = page.getByRole("dialog", { name: "Voice preview" });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(dialog.locator("audio")).toHaveAttribute("src", /voice-preview\/audio/, {
            timeout: 15_000,
        });
        await expect(dialog.getByText(/Buyer story:/i)).toBeVisible();
        await expect(dialog.getByText(/silent placeholder/i)).toBeVisible();
    });

    test("retail Try dialog pre-selects collections variant with buyer hint", async ({ page }) => {
        await page.goto("/workflow/catalog");

        await expect(page.getByRole("heading", { name: "Template catalog" })).toBeVisible({
            timeout: 30_000,
        });

        const packCard = page.locator("article").filter({ hasText: "WISMO" });
        await packCard.scrollIntoViewIfNeeded();
        await packCard.getByRole("button", { name: "Try (Web only)" }).click();

        const dialog = page.getByRole("dialog", { name: "Try in browser (Web only)" });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByTestId("catalog-try-variant-hint")).toBeVisible();
        await expect(dialog.getByText(/payment promise/i)).toBeVisible();
        await expect(dialog.locator("#try-variant")).toContainText(/Collections/i);
    });
});
