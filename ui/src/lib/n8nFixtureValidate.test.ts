import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Repo root: ui/src/lib → ../../../ */
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const script = path.join(repoRoot, "catalog", "scripts", "validate-n8n-workflow-export.mjs");
const fixture = path.join(repoRoot, "catalog", "fixtures", "n8n-minimal-http-request.json");

describe("catalog n8n minimal HTTP fixture", () => {
    it("passes validate-n8n-workflow-export.mjs", () => {
        const out = execFileSync("node", [script, fixture], { encoding: "utf8" });
        expect(out).toContain("OK:");
        expect(out).toContain("Tip:");
    });

    it("includes HTTP hints with --http-hints", () => {
        const out = execFileSync("node", [script, "--http-hints", fixture], { encoding: "utf8" });
        expect(out).toContain("HTTP Request");
        expect(out).toContain("httpbin.org");
    });
});
