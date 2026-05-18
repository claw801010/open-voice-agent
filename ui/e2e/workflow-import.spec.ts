import { test } from "@playwright/test";

import { catalogFixturePath, importExternalFlowFromFixture } from "./importExternalFlow";
import { loginAnalyticsE2E } from "./loginForE2E";

const OSS_SKIP =
    process.env.E2E_EXPECT_STACK_AUTH === "1"
        ? "Stack auth E2E: import flow not validated in this mode yet."
        : undefined;

const VENDOR_FIXTURES = [
    { vendor: "n8n" as const, fixture: "n8n-minimal-http-request.json" },
    { vendor: "make" as const, fixture: "make-set-http.json" },
    { vendor: "zapier" as const, fixture: "zapier-platform-nodes-map.json" },
    { vendor: "skill" as const, fixture: "skill-booking-draft.sample.md" },
] as const;

test.describe("External workflow import (authenticated)", () => {
    test.beforeEach(async ({ page }) => {
        await loginAnalyticsE2E(page);
    });

    for (const { vendor, fixture } of VENDOR_FIXTURES) {
        test(`imports ${vendor} export from dialog and opens editor`, async ({ page }) => {
            test.skip(!!OSS_SKIP, OSS_SKIP);
            test.skip(!catalogFixturePath(fixture), `Missing fixture: ${fixture}`);

            await importExternalFlowFromFixture(page, vendor, fixture);
        });
    }
});
