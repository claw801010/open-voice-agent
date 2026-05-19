# Runbook — Retail: WISMO & store policy FAQ

**Pack slug:** `retail-wismo-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Reduce **“where is my order”** and basic policy load using voice with optional **live order lookup** via HTTP tools. Keep prompts aligned with published return and shipping policies.

## Prerequisites

- OMS, Shopify-style API, or ticketing endpoint for order lookup (tokenized; no full card data in prompts).
- Workflow with agent + tools wired; webhook/QA nodes if you post-call analyze ([READMEPLANNING.md](../READMEPLANNING.md) retail row).

## Happy-path test (QA)

1. Install **WISMO & store policy FAQ** from **Template catalog**.
2. **Try (Web only)** with defaults, or run a **Web test** from the editor after **Customize**.
3. **Expected:** caller can ask a policy/FAQ question and get a coherent answer; if order lookup tools are not configured, agent offers support handoff instead of inventing tracking data.

## Day 1 checklist

1. **Tool contracts:** define stable JSON fields (`order_id`, `status`) and timeouts.
2. **Fallback:** when lookup fails, offer email/support handoff—not invented tracking numbers.
3. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for site; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.
4. **Load test:** a few parallel calls to validate latency band in [catalog/vertical-packs.json](../catalog/vertical-packs.json).

## Integrations

- OMS / e-commerce APIs via HTTP tools; KB articles for static FAQ.

## Catalog graph variants (MK-01)

- **Simple (default install):** [retail-wismo-faq.json](../catalog/packaged-workflows/retail-wismo-faq.json).
- **Complex (pickup / service booking):** [retail-wismo-booking-complex.json](../catalog/packaged-workflows/retail-wismo-booking-complex.json) — import via [import playbook](../catalog/import-packaged-workflow-json.md); attach HTTP tools for slots + OMS when credentials exist; filter **Analytics** by `catalog_slug` and `tool_name`.

## Proof in Analytics (MK-01)

**`catalog_slug`** = `retail-wismo-faq`. **Overview:** `/analytics?catalog_slug=retail-wismo-faq`. **Calls:** `/analytics/calls` — WISMO resolution and OMS tool success surface in **tool spans** / **`mapped_data`** on call detail. HTTP field alignment: [VERTICAL_ANALYTICS_HTTP_MATRIX.md](../catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md). Roadmap: [ANALYTICS_VERTICAL_ROADMAP.md](../catalog/ANALYTICS_VERTICAL_ROADMAP.md).

## Measure

- Deflection from human agents, CSAT on resolved WISMO, tool error rate.
