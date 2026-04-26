# Marketplace planning — curated packs today, import options tomorrow

This document is **focused marketplace + import strategy** for the fork (e.g. FulliO). It complements [READMEPLANNING.md](READMEPLANNING.md) §6 (GTM narrative) and [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) epic **MK-01** (what is actually staffed). Strategy stays in READMEPLANNING; **execution status** stays in READMEPLANTOEXECUTE.

---

## 1. What we ship today (real)

| Capability | Where | Notes |
|------------|--------|--------|
| **Curated vertical packs** | [catalog/vertical-packs.json](catalog/vertical-packs.json), [catalog/packaged-workflows/](catalog/packaged-workflows/) | Native **nodes/edges** graphs + metadata (industry, compliance, cost band, variables). |
| **Install into org** | `POST /api/v1/workflow/install-from-catalog` ([api/routes/workflow.py](api/routes/workflow.py)) | Loads packaged JSON, `default_template_variables`, `workflow_configurations.mk01`, trigger sync. |
| **Browse / try / GTM UI** | MK-01 packages (`MK-01-BROWSE`, `MK-01-TRY`, etc.) in [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) | Catalog filters, Web try, LoopTalk persona, public `/templates` where enabled. |
| **Quality + CI** | [catalog/TEMPLATE_QUALITY_RUBRIC.md](catalog/TEMPLATE_QUALITY_RUBRIC.md), [api/tests/test_vertical_packs_catalog.py](api/tests/test_vertical_packs_catalog.py), [catalog/PARTNER_REVIEW.md](catalog/PARTNER_REVIEW.md) | Human worksheet + automated catalog/graph checks + partner safety checklist. |
| **DB-backed templates** | `WorkflowTemplates`, `GET /api/v1/workflow/templates` | Parallel path to file-based catalog; see READMEPLANNING storage anchor. |
| **Native graph upload** | [UploadWorkflowButton.tsx](ui/src/components/workflow/UploadWorkflowButton.tsx) | **Our** definition shape — not third-party automation. |

**Approved posture for the near term:** expand **researched, curated packs** (more verticals, better runbooks, variables, tests) before betting engineering on universal importers.

---

## 2. Import options — Make, n8n, Zapier (research)

| Platform | Typical artifact | Distance from our runtime graph | Realistic integration pattern |
|----------|------------------|----------------------------------|--------------------------------|
| **n8n** | JSON workflow (nodes, connections, credentials refs) | High — different node types, execution model, secrets | **Phase A:** document “manual port” checklist + example side-by-side. **Phase B:** optional **exporter** (n8n → our JSON) for a **whitelist** of node types only; fail closed on unknown nodes. |
| **Make** | Scenario blueprint (modules, filters) | High | Same as n8n; scenario-to-graph is a **product** (maintain per Make API/version). |
| **Zapier** | Zap definition / export | High | Often API- or UI-bound; treat like Make. |

**Non-goal for v1:** “Drop any n8n/Make/Zapier export and get a production voice workflow” without human review — too many semantic gaps (auth, retries, voice-specific nodes, PHI).

**GTM value without full import:** position integrations as **“connect your stack; we ship opinionated voice flows that call your existing HTTP/Zapier webhooks”** (HTTP tool + credentials already in product) while packs stay curated.

---

## 3. Agent skills — Claude, Cursor, Codex (research)

These artifacts are **not** the same as `catalog/packaged-workflows/*.json`:

| Source | Typical contents | Useful as |
|--------|------------------|-----------|
| **Claude** | Skills / instructions / tool manifests / markdown | **Prompt and variable library** to seed agent nodes; optional future “import skill bundle” that creates **draft** subgraph + KB snippets — still needs human publish. |
| **Cursor** | Rules, `.mdc`, project docs | Same — **authoring accelerators**, not executable call-flow replacement. |
| **Codex** | Agent configs, CLI skills (evolving) | Track upstream formats; same pattern: **assist authoring**, canonical graph stays native. |

**Product framing:** “Import skills” = **accelerate** building workflows (copy prompts, suggest variables, stub HTTP tools), **not** a promise of byte-for-byte equivalence to a voice Pipecat graph.

---

## 4. Licensing and OSS curation

- **MIT (or similar) on GitHub** simplifies **reuse of text/patterns**, not **automatic correctness** for voice, telephony, or compliance.
- Any pack derived from public repos still goes through **PARTNER_REVIEW** + **TEMPLATE_QUALITY_RUBRIC** before marketplace prominence.
- Prefer **fork + attribute + adapt** with a clear **provenance** line in the pack runbook.

---

## 5. Recommended sequencing (tie to execution)

1. **Now — MK-01 depth:** more curated packs, better try-flows, rubric discipline ([READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) MK-01\*, MK-01-RUBRIC).
2. **Next — import spike (pick one):** e.g. **(a)** hardened native JSON upload + validation UX, or **(b)** spike **one** external JSON subset (e.g. “n8n webhook-only recipe → single HTTP tool + agent prompt doc”). Record outcome as a new package under MK-01 or DX-01.
3. **Later — skills library:** optional repo or CDN of **MIT-cleared** prompt/skill fragments that **hydrate** the editor (no silent auto-publish).

When a spike graduates, add acceptance criteria to READMEPLANTOEXECUTE and link the implementation PR here (append a **Shipped experiments** table).

---

## 6. Related links

- [READMEPLANNING.md](READMEPLANNING.md) — §6 marketplace, §2 templates, import reality bullet  
- [READMEPLANTOEXECUTE.md](READMEPLANTOEXECUTE.md) — MK-01 epic + MK-01-RUBRIC  
- [catalog/README.md](catalog/README.md) — catalog index + CI  
- [DOCS.md](DOCS.md) — doc map  

**Maintainers:** keep this file short; move long research notes into `/docs` or a design doc when a spike starts, and link it from the table in §5.
