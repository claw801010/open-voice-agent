import { expect, test } from "@playwright/test";

import { loginAnalyticsE2E } from "./loginForE2E";
import {
    buyerDemoCallsListHref,
    buyerDemoSeededCallCases,
} from "../src/lib/catalog/buyerDemoSeededCalls";

test.describe("Analytics call detail (buyer-demo seeded calls)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    for (const { envVar, catalogSlug, catalogVariantId } of buyerDemoSeededCallCases()) {
        test(`calls list shows ${catalogSlug} demo when ${envVar} set`, async ({ page }) => {
            const callId = process.env[envVar]?.trim();
            test.skip(!callId, `Set ${envVar} (seed_gtm_all_buyer_demo_calls.py).`);

            await page.goto(buyerDemoCallsListHref(catalogSlug, catalogVariantId));

            await expect(page.getByRole("heading", { name: "Calls", exact: true })).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByRole("link", { name: callId }).or(page.getByText(callId))).toBeVisible({
                timeout: 30_000,
            });
        });

        test(`call trace panel for ${envVar}`, async ({ page }) => {
            const callId = process.env[envVar]?.trim();
            test.skip(!callId, `Set ${envVar} (seed_gtm_all_buyer_demo_calls.py).`);

            await page.goto(`/analytics/calls/${encodeURIComponent(callId)}`);

            await expect(page.getByRole("heading", { level: 1, name: callId })).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByRole("heading", { name: "Call trace & quality" })).toBeVisible({
                timeout: 30_000,
            });
        });
    }
});
