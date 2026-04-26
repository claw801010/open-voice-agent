#!/usr/bin/env node
/**
 * Write lighthouse-extra-headers.local.json for headless Lighthouse on authed routes.
 *
 * Prerequisites: Next dev (or start) on LIGHTHOUSE_UI_ORIGIN, API reachable via Next rewrites.
 *
 * Usage (from ui/):
 *   LIGHTHOUSE_OSS_EMAIL=you@example.com LIGHTHOUSE_OSS_PASSWORD='min8chars' npm run perf:lighthouse:oss-headers
 *   LIGHTHOUSE_UI_ORIGIN=http://localhost:3102 ... npm run perf:lighthouse:oss-headers -- ./out.json
 *
 * Fresh local DB (no user yet):
 *   LIGHTHOUSE_OSS_AUTO_SIGNUP=1 LIGHTHOUSE_OSS_PASSWORD='min8chars!' npm run perf:lighthouse:oss-headers
 *   # optional: LIGHTHOUSE_OSS_EMAIL=… ; otherwise a disposable lighthouse-e2e-*@example.com is used once
 *
 * Then: BASE_URL=<same origin> npm run perf:lighthouse:auth
 *
 * LIGHTHOUSE_OSS_SKIP_HEALTH=1 — skip GET /api/v1/health preflight (rare).
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const origin = (process.env.LIGHTHOUSE_UI_ORIGIN || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const autoSignup = process.env.LIGHTHOUSE_OSS_AUTO_SIGNUP === "1";
let email = process.env.LIGHTHOUSE_OSS_EMAIL?.trim() || "";
const password = process.env.LIGHTHOUSE_OSS_PASSWORD;
const outPath = path.resolve(process.cwd(), process.argv[2] || "lighthouse-extra-headers.local.json");

if (!password || password.length < 8) {
  console.error(
    "Set LIGHTHOUSE_OSS_PASSWORD (at least 8 characters; matches /auth/signup validation)."
  );
  process.exit(1);
}

if (!email && autoSignup) {
  email = `lighthouse-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  console.error(`Using disposable OSS email: ${email}`);
}

if (!email) {
  console.error(
    "Set LIGHTHOUSE_OSS_EMAIL, or use LIGHTHOUSE_OSS_AUTO_SIGNUP=1 (with password) to create a disposable user."
  );
  process.exit(1);
}

if (process.env.LIGHTHOUSE_OSS_SKIP_HEALTH !== "1") {
  try {
    const h = await fetch(`${origin}/api/v1/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!h.ok) {
      console.error(
        `Health check failed (${h.status}): ${origin}/api/v1/health — start Next (LIGHTHOUSE_UI_ORIGIN) and API. See READMEBUILDME.md §4. Skip: LIGHTHOUSE_OSS_SKIP_HEALTH=1`
      );
      process.exit(1);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `Health check failed (${origin}/api/v1/health): ${msg}. Start Next + API; see READMEBUILDME.md §4. Skip: LIGHTHOUSE_OSS_SKIP_HEALTH=1`
    );
    process.exit(1);
  }
}

async function login() {
  let loginRes;
  let text;
  try {
    loginRes = await fetch(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
    text = await loginRes.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `Login request failed (${origin}): ${msg}. Is Next running on LIGHTHOUSE_UI_ORIGIN and API reachable?`
    );
    process.exit(1);
  }
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { res: loginRes, body, text };
}

async function signup() {
  let signupRes;
  let text;
  try {
    signupRes = await fetch(`${origin}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: "Lighthouse local",
      }),
    });
    text = await signupRes.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Signup request failed (${origin}): ${msg}. Is Next + API up?`);
    process.exit(1);
  }
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { res: signupRes, body, text };
}

let { res: loginRes, body } = await login();

if (!loginRes.ok && loginRes.status === 401 && autoSignup) {
  const sup = await signup();
  if (!sup.res.ok && sup.res.status !== 409) {
    console.error(`Signup failed (${sup.res.status}): ${sup.text.slice(0, 500)}`);
    process.exit(1);
  }
  if (sup.res.status === 409) {
    console.error(
      "Signup returned 409 (email already registered). Use the correct LIGHTHOUSE_OSS_PASSWORD or a new LIGHTHOUSE_OSS_EMAIL."
    );
    process.exit(1);
  }
  ({ res: loginRes, body } = await login());
}

if (!loginRes.ok) {
  const t = typeof body === "object" ? JSON.stringify(body) : "";
  console.error(`Login failed (${loginRes.status}): ${t.slice(0, 500)}`);
  process.exit(1);
}

const { token, user } = body;
if (!token || !user) {
  console.error("Login response missing token or user:", body);
  process.exit(1);
}

let sessionRes;
try {
  sessionRes = await fetch(`${origin}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token, user }),
  });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`POST /api/auth/session failed (${origin}): ${msg}. Is Next running?`);
  process.exit(1);
}

if (!sessionRes.ok) {
  const t = await sessionRes.text();
  console.error(`POST /api/auth/session failed (${sessionRes.status}): ${t.slice(0, 500)}`);
  process.exit(1);
}

const rawCookies =
  typeof sessionRes.headers.getSetCookie === "function"
    ? sessionRes.headers.getSetCookie()
    : [];

if (!rawCookies.length) {
  console.error(
    "No Set-Cookie from /api/auth/session. Use LIGHTHOUSE_UI_ORIGIN matching your Next app (not the API port alone)."
  );
  process.exit(1);
}

const parts = [];
for (const line of rawCookies) {
  const nv = line.split(";")[0].trim();
  if (nv) parts.push(nv);
}
const Cookie = parts.join("; ");

const payload = { Cookie };
await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const rel = path.relative(root, outPath) || outPath;
console.log(
  `Wrote ${rel} (${parts.length} cookie(s)). Next: BASE_URL=${origin} npm run perf:lighthouse:auth`
);
