# Healthcare EHR + messaging all-in-one (MK-01)

**Goal:** Saga-style buyer demo — **full context before hello**, **act + sync to EHR**, **SMS confirmation**, **human review inbox**.

## Prerequisites

- `ENABLE_LOCAL_EHR=true`, `ENABLE_LOCAL_MESSAGING=true`, `ENABLE_LOCAL_SCHEDULING=true`
- Install **`healthcare-clinic-screening`** variant **`ehr_sync_complex`**

```bash
./scripts/catalog-buyer-demo.sh healthcare-clinic-screening ehr_sync_complex
```

## Wire (workflow editor catalog guide)

1. **Wire local EHR** — `lookup_patient_context`, `verify_prior_auth`, `sync_chart_to_ehr`
2. **Wire local calendar** — `book_slot`
3. **Wire local messaging** — `send_confirmation_sms`

## Record keeping modes

| Mode | When to use |
|------|-------------|
| **local_only** | No EHR connector — compliant local chart index + audit trail under `run/local_ehr/org_{id}/` |
| **local_with_connector** | Local is source of truth; chart notes also push to athenaHealth / Epic / Cerner / eCW stub |

Configure under **Settings → Local demo EHR** (mode + optional connector vendor).

## Demo patient (Maria Rodriguez)

| Field | Template var | Demo value |
|-------|--------------|------------|
| Context token | `patient_token` | `maria-rodriguez` |
| Prior auth | `procedure_code` | `73721` (knee MRI) |
| EHR connector | Settings → Local demo EHR | **Local only** or **Local + athenaHealth** (etc.) |

## Compliance notes (local)

- Patient charts persisted per org (`org_{id}_patients.json`)
- Audit log stores action + patient token only — not clinical note body
- Chart sync always writes locally first; connector push is optional
- Production: BAA, encryption at rest, retention policy before cloud PHI

## Endpoints (local)

| Tool | POST path |
|------|-----------|
| Patient context | `{ehr}/api/v1/patients/context` |
| Prior auth | `{ehr}/api/v1/prior-auth/status` |
| Chart sync | `{ehr}/api/v1/chart/sync` |
| SMS | `{messaging}/api/v1/messages/sms` |

## Proof surfaces

- **Call detail** → Live workflow timeline + tool `mapped_data`
- **Analytics → Review inbox** → Approve / edit / dismiss suggested SMS/email
- **Settings** → EHR connector + messaging log

## GTM deck screenshots

Seed healthcare demo data, then capture (API + UI up):

```bash
./scripts/gtm_capture_deck.sh
```

| PNG | Surface |
|-----|---------|
| `gtm-mk01-analytics-live-workflow.png` | Call detail — Live workflow timeline (EHR tool spans) |
| `gtm-mk01-analytics-review-inbox.png` | Review inbox — pending SMS draft |
| `gtm-mk01-settings-local-ehr-records.png` | Settings — record keeping mode + chart sync log |

Uses [seed_gtm_healthcare_ehr_demo.py](../../scripts/seed_gtm_healthcare_ehr_demo.py) for `ehr_sync_complex` call + inbox item + chart sync.

## Top integrations (production)

Point template vars at buyer systems — same HTTP tool pattern:

| Category | Examples |
|----------|----------|
| EHR | athenaHealth, Epic, Cerner, eClinicalWorks |
| Insurance | Eligibility / prior auth APIs |
| Scheduling | EHR-native or standalone calendars |
| Outreach | Twilio SMS, SendGrid/SES email |

Related: [catalog-buyer-demo.md](catalog-buyer-demo.md), [local-all-in-one-gtm-demo.md](local-all-in-one-gtm-demo.md).
