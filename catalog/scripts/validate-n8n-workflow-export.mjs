#!/usr/bin/env node
/**
 * Structural check for an n8n workflow export JSON (MK-01-IMPORT-OPTIONS spike).
 * Optionally prints HTTP Request–style node hints for manual mapping to our HTTP tool.
 *
 * Usage:
 *   node catalog/scripts/validate-n8n-workflow-export.mjs <path-to-workflow.json>
 *   node catalog/scripts/validate-n8n-workflow-export.mjs --http-hints <path>
 * Stdin: … < export.json
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
    console.error(
        "Usage: node catalog/scripts/validate-n8n-workflow-export.mjs [--http-hints] <file.json>|-"
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

let data;
try {
    data = JSON.parse(raw);
} catch {
    console.error("Invalid JSON.");
    process.exit(1);
}

const wf = Array.isArray(data) ? data[0] : data;
if (!wf || typeof wf !== "object") {
    console.error("Expected a workflow object or a non-empty array of workflows.");
    process.exit(1);
}
if (!Array.isArray(wf.nodes)) {
    console.error('Missing or invalid "nodes" array (not an n8n workflow export?).');
    process.exit(1);
}

const types = new Set(wf.nodes.map((n) => (n && typeof n === "object" ? n.type : null)).filter(Boolean));
console.log(`OK: ${wf.nodes.length} node(s), ${types.size} distinct type(s).`);

function summarizeHttpLikeNode(node) {
    const p = node.parameters && typeof node.parameters === "object" ? node.parameters : {};
    const name = node.name || "(unnamed)";
    const type = node.type || "";
    const methodRaw =
        p.requestMethod ?? p.method ?? p.httpMethod ?? p.requestMethodUi ?? p.methodUi ?? "GET";
    const method = String(methodRaw).toUpperCase().slice(0, 16);
    let url = p.url;
    if (url !== undefined && typeof url !== "string") {
        url = p.urlExpression ?? p.path ?? "";
    }
    if (typeof url !== "string") url = "";
    const urlPreview = url.length > 240 ? `${url.slice(0, 240)}…` : url;
    return {
        n8nNodeName: name,
        type,
        method,
        urlPreview,
        mappingHint:
            "Map to HTTP tool: set Method + URL on the tool; move JSON keys from Send Body / Query to body_template or URL templates.",
    };
}

const httpLike = wf.nodes.filter(
    (n) => n && typeof n === "object" && String(n.type || "").toLowerCase().includes("httprequest")
);

if (httpHints) {
    if (httpLike.length === 0) {
        console.log('--- No nodes with type containing "httpRequest" (hints skipped) ---');
    } else {
        console.log("--- HTTP Request–style nodes (hints only; verify in n8n UI) ---");
        console.log(JSON.stringify(httpLike.map(summarizeHttpLikeNode), null, 2));
    }
} else if (httpLike.length > 0) {
    console.log(`Tip: ${httpLike.length} HTTP-like node(s) — re-run with --http-hints for JSON mapping hints.`);
}

console.log("Next: manual map per catalog/import-adapter-n8n-spike.md");
