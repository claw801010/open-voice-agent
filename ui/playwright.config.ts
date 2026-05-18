import fs from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * MK-01-ANALYTICS-VERTICAL — OSS/local middleware smoke (`/analytics`, `/analytics/calls` → login).
 *
 * CI sets `CI=true`; Playwright starts `next start` after `npm run build`.
 * Locally: run `npm run dev` or `npm run build && npm run start`, then `npm run test:e2e`
 * (reuseExistingServer avoids spawning a second server when port 3000 is already up).
 *
 * Authenticated flows: set `E2E_EMAIL`, `E2E_PASSWORD`, and run API + UI; optional `E2E_BACKEND_URL`
 * (default `http://127.0.0.1:8000`). Use `PLAYWRIGHT_SKIP_WEBSERVER=1` when the UI is already running.
 *
 * Stack deployments: `E2E_EXPECT_STACK_AUTH=1` skips OSS redirect expectations; authenticate with
 * `E2E_STACK_REFRESH_TOKEN` (impersonate) and/or `E2E_PLAYWRIGHT_STORAGE_STATE` (saved cookies JSON).
 *
 * GTM deck PNGs (local): `E2E_GTM_DECK_SCREENSHOTS=1` with auth envs runs `e2e/gtm-deck-screenshots.spec.ts`
 * and writes `../docs/images/gtm-*.png` (optional `E2E_GTM_SAMPLE_CALL_ID` for call detail).
 */
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

const stackE2E = process.env.E2E_EXPECT_STACK_AUTH === "1";
const stackStatePath = process.env.E2E_PLAYWRIGHT_STORAGE_STATE;
const storageStateFromEnv =
    stackE2E && stackStatePath && fs.existsSync(stackStatePath) ? stackStatePath : undefined;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
    use: {
        baseURL,
        trace: "on-first-retry",
        ...(storageStateFromEnv ? { storageState: storageStateFromEnv } : {}),
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
        ? undefined
        : {
              command: "npm run start",
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 180_000,
              stdout: "pipe",
              stderr: "pipe",
          },
});
