#!/usr/bin/env python3
"""Generate scripts/buyer-demo-*.sh one-liners from catalog/buyer-demo-defaults.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS_PATH = ROOT / "catalog" / "buyer-demo-defaults.json"
PACKS_PATH = ROOT / "catalog" / "vertical-packs.json"

SHORT_NAMES: dict[str, str] = {
    "healthcare-clinic-screening": "buyer-demo-healthcare-ehr.sh",
    "retail-wismo-faq": "buyer-demo-retail-collections.sh",
    "b2b-saas-trial-nurture": "buyer-demo-b2b-conversion.sh",
    "insurance-fnol-faq": "buyer-demo-insurance-claims.sh",
    "hospitality-travel-concierge": "buyer-demo-hospitality-waiver.sh",
    "financial-services-banking-faq": "buyer-demo-banking-balance.sh",
    "smb-franchise-location-faq": "buyer-demo-franchise-leads.sh",
    "telecom-utilities-outage-faq": "buyer-demo-telecom-outage.sh",
    "public-sector-civic-services-faq": "buyer-demo-civic-permits.sh",
    "hr-staffing-recruiting-faq": "buyer-demo-hr-recruiting.sh",
}

_TEMPLATE = """#!/usr/bin/env bash
# MK-01 buyer demo — {title} ({variant})
#   export E2E_EMAIL='demo@example.com' E2E_PASSWORD='…'
#   ./{script_name}
# Override variant: ./{script_name} booking_complex
# Optional demo call: BUYER_DEMO_SEED_CALL=1 ./{script_name}
set -euo pipefail
exec "$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)/catalog-buyer-demo.sh" "{slug}" "$@"
"""


def main() -> int:
    defaults = json.loads(DEFAULTS_PATH.read_text(encoding="utf-8")).get("defaults") or {}
    packs = {
        p["slug"]: p.get("display_name") or p["slug"]
        for p in json.loads(PACKS_PATH.read_text(encoding="utf-8")).get("packs", [])
    }
    for slug, variant in defaults.items():
        script_name = SHORT_NAMES.get(slug, f"buyer-demo-{slug}.sh")
        title = packs.get(slug, slug)
        content = _TEMPLATE.format(
            title=title,
            variant=variant,
            script_name=script_name,
            slug=slug,
        )
        path = ROOT / "scripts" / script_name
        path.write_text(content, encoding="utf-8")
        path.chmod(0o755)
        print(f"wrote scripts/{script_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
