# Runbook — Retail: WISMO & store policy FAQ

**Pack slug:** `retail-wismo-faq`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Reduce **“where is my order”** and basic policy load using voice with optional **live order lookup** via HTTP tools. Keep prompts aligned with published return and shipping policies.

## Prerequisites

- OMS, Shopify-style API, or ticketing endpoint for order lookup (tokenized; no full card data in prompts).
- Workflow with agent + tools wired; webhook/QA nodes if you post-call analyze ([READMEPLANNING.md](../READMEPLANNING.md) retail row).

## Day 1 checklist

1. **Tool contracts:** define stable JSON fields (`order_id`, `status`) and timeouts.
2. **Fallback:** when lookup fails, offer email/support handoff—not invented tracking numbers.
3. **Embed or PSTN:** [recipes/embed-widget.md](../recipes/embed-widget.md) for site; [recipes/inbound-pstn.md](../recipes/inbound-pstn.md) for phone.
4. **Load test:** a few parallel calls to validate latency band in [catalog/vertical-packs.json](../catalog/vertical-packs.json).

## Integrations

- OMS / e-commerce APIs via HTTP tools; KB articles for static FAQ.

## Measure

- Deflection from human agents, CSAT on resolved WISMO, tool error rate.
