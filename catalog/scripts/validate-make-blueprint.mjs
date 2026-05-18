#!/usr/bin/env node
/**
 * Structural check for a Make scenario blueprint JSON (MK-01-IMPORT-OPTIONS).
 *
 * Usage:
 *   node catalog/scripts/validate-make-blueprint.mjs <path-to-blueprint.json>
 *   node catalog/scripts/validate-make-blueprint.mjs --http-hints <path>
 *   node catalog/scripts/validate-make-blueprint.mjs --set-hints <path>
 */

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
let httpHints = false;
let setHints = false;
let fileArg;
for (const a of argv) {
    if (a === "--http-hints") httpHints = true;
    else if (a === "--set-hints") setHints = true;
    else if (a === "-") fileArg = "-";
    else if (!a.startsWith("-")) fileArg = a;
    else {
        console.error(`Unknown option: ${a}`);
        process.exit(2);
    }
}
if (!fileArg) {
    console.error(
        "Usage: node catalog/scripts/validate-make-blueprint.mjs [--http-hints] [--set-hints] <file.json>|-"
    );
    process.exit(2);
}

let raw;
try {
    raw = fileArg === "-" ? readFileSync(0, "utf8") : readFileSync(fileArg, "utf8");
} catch (e) {
    console.error(String(e?.message || e));
    process.exit(1);
}

let bp;
try {
    bp = JSON.parse(raw);
} catch {
    console.error("Invalid JSON.");
    process.exit(1);
}

if (!bp || typeof bp !== "object" || !Array.isArray(bp.flow)) {
    console.error('Missing or invalid top-level "flow" array.');
    process.exit(1);
}

function* walkFlow(flow) {
    for (const item of flow) {
        if (!item || typeof item !== "object") continue;
        yield item;
        if (Array.isArray(item.routes)) {
            for (const route of item.routes) {
                if (route && Array.isArray(route.flow)) yield* walkFlow(route.flow);
            }
        }
    }
}

const modules = [...walkFlow(bp.flow)];
const types = new Set(modules.map((m) => m.module).filter(Boolean));
console.log(`OK: ${modules.length} module(s), ${types.size} distinct module URI(s).`);

function isHttp(m) {
    const u = String(m.module || "").toLowerCase();
    return u.startsWith("http:") || u.includes("actionsenddata");
}
function isSet(m) {
    const u = String(m.module || "").toLowerCase();
    return u.startsWith("util:set") || u.includes("setvariable");
}
function displayName(m) {
    const n = m.metadata?.designer?.name;
    return n && String(n).trim() ? String(n).trim() : `Module ${m.id ?? "?"}`;
}

function summarizeHttp(m) {
    const mapper = m.mapper && typeof m.mapper === "object" ? m.mapper : {};
    const method = String(mapper.method || "GET").toUpperCase().slice(0, 16);
    let url = mapper.url;
    if (typeof url !== "string") url = url != null ? String(url) : "";
    const urlPreview = url.length > 240 ? `${url.slice(0, 240)}…` : url;
    return { moduleName: displayName(m), module: m.module, method, urlPreview };
}

function summarizeSet(m) {
    const mapper = m.mapper && typeof m.mapper === "object" ? m.mapper : {};
    const fields = [];
    if (Array.isArray(mapper.variables)) {
        for (const v of mapper.variables) {
            if (v && v.name) fields.push({ name: v.name, valuePreview: String(v.value ?? "").slice(0, 96) });
        }
    }
    return { moduleName: displayName(m), kind: "set", fields };
}

const httpLike = modules.filter(isHttp);
const setLike = modules.filter(isSet);

if (httpHints) {
    if (httpLike.length === 0) {
        console.log("--- No HTTP modules (hints skipped) ---");
    } else {
        console.log("--- HTTP modules (hints only) ---");
        console.log(JSON.stringify(httpLike.map(summarizeHttp), null, 2));
    }
} else if (httpLike.length > 0) {
    console.log(`Tip: ${httpLike.length} HTTP module(s) — re-run with --http-hints.`);
}

if (setHints) {
    if (setLike.length === 0) {
        console.log("--- No Set variable modules (hints skipped) ---");
    } else {
        console.log("--- Set variable modules (hints only) ---");
        console.log(JSON.stringify(setLike.map(summarizeSet), null, 2));
    }
} else if (setLike.length > 0) {
    console.log(`Tip: ${setLike.length} Set module(s) — re-run with --set-hints.`);
}

console.log("Next: import via POST /api/v1/workflow/import/make-packaged-draft or manual map per import-adapter-make-zapier-spike.md");
