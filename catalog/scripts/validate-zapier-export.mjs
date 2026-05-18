#!/usr/bin/env node
/**
 * Structural check for Zapier import-subset JSON (MK-01-IMPORT-OPTIONS).
 *
 * Usage:
 *   node catalog/scripts/validate-zapier-export.mjs <file.json>
 *   node catalog/scripts/validate-zapier-export.mjs --http-hints <file.json>
 */

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
let httpHints = false;
let fileArg;
for (const a of argv) {
    if (a === "--http-hints") httpHints = true;
    else if (a === "-") fileArg = "-";
    else if (!a.startsWith("-")) fileArg = a;
    else {
        console.error(`Unknown option: ${a}`);
        process.exit(2);
    }
}
if (!fileArg) {
    console.error("Usage: node catalog/scripts/validate-zapier-export.mjs [--http-hints] <file.json>|-");
    process.exit(2);
}

let raw;
try {
    raw = fileArg === "-" ? readFileSync(0, "utf8") : readFileSync(fileArg, "utf8");
} catch (e) {
    console.error(String(e?.message || e));
    process.exit(1);
}

let data;
try {
    data = JSON.parse(raw);
} catch {
    console.error("Invalid JSON.");
    process.exit(1);
}

const zap = Array.isArray(data?.steps) ? data : data?.zap;
if (!zap || !Array.isArray(zap.steps)) {
    console.error('Missing "steps" array (or zap.steps).');
    process.exit(1);
}

function* walkSteps(steps) {
    for (const s of steps) {
        if (!s || typeof s !== "object") continue;
        yield s;
        if (Array.isArray(s.branches)) {
            for (const b of s.branches) {
                if (b && Array.isArray(b.steps)) yield* walkSteps(b.steps);
            }
        }
    }
}

const all = [...walkSteps(zap.steps)];
console.log(`OK: ${all.length} step(s) in import-subset walk.`);

function isHttp(s) {
    const app = String(s.app || "").toLowerCase();
    const action = String(s.action || "").toLowerCase();
    const p = s.params && typeof s.params === "object" ? s.params : {};
    return (app.includes("webhook") && (action.includes("post") || action.includes("get"))) || typeof p.url === "string";
}

function title(s) {
    return (s.title || s.name || `Step ${s.id ?? "?"}`).toString();
}

const httpSteps = all.filter(isHttp);
if (httpHints) {
    console.log(
        JSON.stringify(
            httpSteps.map((s) => {
                const p = s.params || {};
                return {
                    stepTitle: title(s),
                    method: String(p.method || "POST").toUpperCase(),
                    urlPreview: String(p.url || "").slice(0, 240),
                };
            }),
            null,
            2
        )
    );
} else if (httpSteps.length) {
    console.log(`Tip: ${httpSteps.length} HTTP-like step(s) — re-run with --http-hints.`);
}

console.log("Next: POST /api/v1/workflow/import/zapier-packaged-draft");
