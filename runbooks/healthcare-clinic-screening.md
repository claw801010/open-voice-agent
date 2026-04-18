# Runbook — Healthcare: patient screening & triage

**Pack slug:** `healthcare-clinic-screening`  
**Catalog:** [catalog/vertical-packs.json](../catalog/vertical-packs.json)

## Purpose

Stand up a **voice** flow for symptom triage, scheduling handoff, or after-hours coverage with **minimal PHI** in prompts and logs. This runbook is operational guidance—not legal advice; involve compliance for HIPAA/BAA and state telehealth rules.

## Prerequisites

- Org and workflow created (from template or blank); see [READMELEARNME.md](../READMELEARNME.md) for stack orientation.
- Telephony provider and numbers if using **PSTN**; WebRTC embed if using **web** ([recipes/embed-widget.md](../recipes/embed-widget.md)).
- Decision on **recording**: off by default until BAA and policy allow storage.

## Day 1 checklist

1. **Variables:** map only what the agent needs (e.g. `patient_locale`, `clinic_timezone`)—avoid free-text PHI in tool payloads unless required.
2. **Handoff:** define warm transfer or callback number for emergencies; block agent from diagnosing.
3. **Publish & validate:** use workflow validation in UI; run a **Web call** test ([READMEEXPERIENCE.md](../READMEEXPERIENCE.md) no-code path).
4. **PSTN (optional):** follow [recipes/inbound-pstn.md](../recipes/inbound-pstn.md); label disclosure and recording per jurisdiction.

## Integrations

- EHR scheduling APIs: typically via **HTTP tools** on agent nodes ([READMEADK.md](../READMEADK.md) REST patterns).
- Secure messaging: out of band from this repo; document URLs in org runbooks.

## Measure

- Containment vs. handoff rate, average handle time, after-hours coverage hours, zero critical mis-triage (human review sample).
