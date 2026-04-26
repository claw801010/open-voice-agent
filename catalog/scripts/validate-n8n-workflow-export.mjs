#!/usr/bin/env node
/**
 * Minimal structural check for an n8n workflow export JSON (MK-01-IMPORT-OPTIONS spike).
 * Does not validate node types or produce our graph — use for CI/pre-flight before manual mapping.
 *
 * Usage: node catalog/scripts/validate-n8n-workflow-export.mjs <path-to-workflow.json>
 * Stdin: node catalog/scripts/validate-n8n-workflow-export.mjs - < export.json
 */

import { readFileSync } from "node:fs";

const arg = process.argv[2];
if (!arg) {
    console.error("Usage: node catalog/scripts/validate-n8n-workflow-export.mjs <file.json>|-");
    process.exit(2);
}

let raw;
try {
    raw = arg === "-" ? readFileSync(0, "utf8") : readFileSync(arg, "utf8");
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
console.log("Next: manual map per catalog/import-adapter-n8n-spike.md");
