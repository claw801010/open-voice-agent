#!/usr/bin/env node
/**
 * Print WE-01-VISUAL-DEPTH / READMENEWRELEASES-style lines from Lighthouse JSON report(s)
 * (output of npm run perf:lighthouse → …report.report.json).
 *
 * Usage:
 *   node scripts/lighthouse-summarize.mjs [path/to/report.report.json ...]
 *   node scripts/lighthouse-summarize.mjs   # newest *.report.report.json under ui/.lighthouse/
 *   node scripts/lighthouse-summarize.mjs --latest-auth
 *       # same stamp: *-usage*_authed.report.report.json + *-workflow_catalog*_authed… (after perf:lighthouse:auth)
 *   node scripts/lighthouse-summarize.mjs --latest-operator
 *       # same stamp: *-overview*_authed… + *-reports*_authed… (after perf:lighthouse:auth:operator)
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function score(cat) {
  if (!cat || typeof cat.score !== "number") {
    return "n/a";
  }
  return (cat.score * 100).toFixed(0);
}

function num(audit, key = "numericValue") {
  const v = audit?.[key];
  if (typeof v !== "number" || Number.isNaN(v)) {
    return "n/a";
  }
  if (v >= 1000) {
    return `${(v / 1000).toFixed(2)}s`;
  }
  return `${v.toFixed(0)}ms`;
}

async function newestReportJsonInLighthouse() {
  const dir = path.join(root, ".lighthouse");
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const jsons = names.filter((f) => f.endsWith(".report.report.json"));
  if (jsons.length === 0) {
    return null;
  }
  let best = null;
  let bestMtime = 0;
  for (const name of jsons) {
    const p = path.join(dir, name);
    const s = await stat(p);
    if (s.mtimeMs > bestMtime) {
      bestMtime = s.mtimeMs;
      best = p;
    }
  }
  return best;
}

/** Desktop or mobile authed runs from lighthouse-we01-visual-depth.sh (`-authed` suffix). */
const AUTH_USAGE_MIDDLES = new Set(["usage-authed", "usage-mobile-authed"]);
const AUTH_CATALOG_MIDDLES = new Set([
  "workflow_catalog-authed",
  "workflow_catalog-mobile-authed",
]);
const AUTH_OVERVIEW_MIDDLES = new Set(["overview-authed", "overview-mobile-authed"]);
const AUTH_REPORTS_MIDDLES = new Set(["reports-authed", "reports-mobile-authed"]);

async function latestAuthPairPaths() {
  const dir = path.join(root, ".lighthouse");
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const stampRe = /^(\d{8}-\d{6})-(.+)\.report\.report\.json$/;
  /** @type {Map<string, { usage?: string; catalog?: string }>} */
  const byStamp = new Map();
  for (const f of names) {
    if (!f.endsWith(".report.report.json") || !f.includes("-authed")) continue;
    const m = f.match(stampRe);
    if (!m) continue;
    const stamp = m[1];
    const middle = m[2];
    if (!byStamp.has(stamp)) byStamp.set(stamp, {});
    const slot = byStamp.get(stamp);
    const full = path.join(dir, f);
    if (AUTH_USAGE_MIDDLES.has(middle)) slot.usage = full;
    if (AUTH_CATALOG_MIDDLES.has(middle)) slot.catalog = full;
  }
  const complete = [...byStamp.entries()].filter(([, o]) => o.usage && o.catalog);
  if (complete.length === 0) return null;
  complete.sort((a, b) => b[0].localeCompare(a[0]));
  const [, o] = complete[0];
  return [o.usage, o.catalog];
}

async function latestOperatorPairPaths() {
  const dir = path.join(root, ".lighthouse");
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const stampRe = /^(\d{8}-\d{6})-(.+)\.report\.report\.json$/;
  /** @type {Map<string, { overview?: string; reports?: string }>} */
  const byStamp = new Map();
  for (const f of names) {
    if (!f.endsWith(".report.report.json") || !f.includes("-authed")) continue;
    const m = f.match(stampRe);
    if (!m) continue;
    const stamp = m[1];
    const middle = m[2];
    if (!byStamp.has(stamp)) byStamp.set(stamp, {});
    const slot = byStamp.get(stamp);
    const full = path.join(dir, f);
    if (AUTH_OVERVIEW_MIDDLES.has(middle)) slot.overview = full;
    if (AUTH_REPORTS_MIDDLES.has(middle)) slot.reports = full;
  }
  const complete = [...byStamp.entries()].filter(([, o]) => o.overview && o.reports);
  if (complete.length === 0) return null;
  complete.sort((a, b) => b[0].localeCompare(a[0]));
  const [, o] = complete[0];
  return [o.overview, o.reports];
}

async function summarizeOne(reportPath) {
  const rel = path.relative(root, reportPath) || reportPath;
  const raw = await readFile(reportPath, "utf8");
  const j = JSON.parse(raw);
  const p = j.categories?.performance;
  const a = j.categories?.accessibility;
  const audits = j.audits || {};
  const fcp = audits["first-contentful-paint"];
  const tbt = audits["total-blocking-time"];
  const lcp = audits["largest-contentful-paint"];
  const req = j.requestedUrl || "";
  const final = j.finalUrl || req || "unknown";
  const urlNote =
    req && final && req !== final
      ? `requested \`${req}\` → final \`${final}\``
      : `**${final}**`;

  return [
    "**WE-01-VISUAL-DEPTH** (Lighthouse snapshot) —",
    urlNote,
    "—",
    `Performance **${score(p)}%**, Accessibility **${score(a)}%**;`,
    `lab FCP **${num(fcp)}**, TBT **${num(tbt)}**, LCP **${num(lcp)}**`,
    `(file: \`${rel}\`).`,
  ].join(" ");
}

const argv = process.argv.slice(2);
const wantsLatestAuth = argv.includes("--latest-auth");
const wantsLatestOperator = argv.includes("--latest-operator");
const args = argv.filter((a) => a !== "--latest-auth" && a !== "--latest-operator");

let paths;
if (wantsLatestAuth && wantsLatestOperator) {
  console.error("Use only one of --latest-auth or --latest-operator.");
  process.exit(1);
}
if (wantsLatestAuth) {
  if (args.length > 0) {
    console.error("Do not pass paths with --latest-auth (paths are discovered under ui/.lighthouse/).");
    process.exit(1);
  }
  const pair = await latestAuthPairPaths();
  paths = pair || [];
} else if (wantsLatestOperator) {
  if (args.length > 0) {
    console.error("Do not pass paths with --latest-operator (paths are discovered under ui/.lighthouse/).");
    process.exit(1);
  }
  const pair = await latestOperatorPairPaths();
  paths = pair || [];
} else {
  const newest = await newestReportJsonInLighthouse();
  paths =
    args.length > 0
      ? args.map((a) => (path.isAbsolute(a) ? a : path.join(process.cwd(), a)))
      : newest
        ? [newest]
        : [];
}

if (paths.length === 0) {
  console.error(
    wantsLatestAuth
      ? "No paired authed reports under ui/.lighthouse/ (need *-usage-authed.report.report.json and *-workflow_catalog-authed… from the same npm run perf:lighthouse:auth)."
      : wantsLatestOperator
        ? "No paired authed reports under ui/.lighthouse/ (need *-overview-authed.report.report.json and *-reports-authed… from the same npm run perf:lighthouse:auth:operator)."
        : "No report path given and no *.report.report.json under ui/.lighthouse/. Run npm run perf:lighthouse (or perf:lighthouse:auth) first, or pass one or more report paths."
  );
  process.exit(1);
}

const lines = [];
for (const p of paths) {
  lines.push(await summarizeOne(p));
}
for (const line of lines) {
  console.log(`${line} Paste into READMENEWRELEASES Unreleased; adjust wording as needed.`);
}
