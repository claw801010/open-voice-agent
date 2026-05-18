import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

export type ImportVendorE2E = "n8n" | "make" | "zapier" | "skill";

const VENDOR_SELECT_LABEL: Record<ImportVendorE2E, string> = {
    n8n: "n8n",
    make: "Make.com",
    zapier: "Zapier",
    skill: "Agent skill (SKILL.md)",
};

export function catalogFixturePath(...segments: string[]): string {
    return path.join(process.cwd(), "..", "catalog", "fixtures", ...segments);
}

export async function openImportExternalDialog(page: Page): Promise<void> {
    await page.goto("/workflow");
    await expect(page.getByRole("heading", { name: "Your Agents" })).toBeVisible({
        timeout: 30_000,
    });
    await page.getByRole("button", { name: "Import external" }).click();
    await expect(page.getByRole("dialog", { name: "Import external flow" })).toBeVisible();
}

export async function importExternalFlowFromFixture(
    page: Page,
    vendor: ImportVendorE2E,
    fixtureRelativePath: string,
): Promise<void> {
    const fixturePath = catalogFixturePath(fixtureRelativePath);
    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Missing fixture: ${fixturePath}`);
    }
    const content = fs.readFileSync(fixturePath, "utf-8");

    await openImportExternalDialog(page);

    await page.locator("#import-vendor").click();
    await page.getByRole("option", { name: VENDOR_SELECT_LABEL[vendor] }).click();

    const fieldLabel = vendor === "skill" ? "Skill markdown" : "Export JSON";
    await page.getByLabel(fieldLabel).fill(content);

    await page.getByRole("button", { name: "Import & open editor" }).click();

    await expect(page).toHaveURL(/\/workflow\/\d+/, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Tidy up layout" })).toBeVisible({
        timeout: 30_000,
    });
}
