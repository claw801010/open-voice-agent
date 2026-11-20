"""Agent self-improvement governance (MK-01-SELFIMPROVE).

Pure decision layer that decides whether an AI-proposed workflow improvement
should be applied automatically (no human in the loop) or held in an approval
queue. Decisions are driven by:

  * a best-practice default policy catalog (catalog/self-improvement-policy.json),
  * optional per-organization overrides (mode, evidence gates, category decisions),
  * evidence about the proposal (supporting calls, QM score, model confidence),
  * blast-radius rate limits (cooldown + max auto-applies per day).

This module has no I/O side effects and no DB dependency so it can be unit
tested in isolation and reused by routes, ARQ tasks, and the review inbox.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CATALOG_PATH = _REPO_ROOT / "catalog" / "self-improvement-policy.json"

Mode = Literal["off", "suggest", "auto_with_queue", "full_auto"]
RiskTier = Literal["low", "medium", "high"]
CategoryDecision = Literal["auto_apply", "queue", "block"]
ProposalDecision = Literal["auto_apply", "queue", "reject"]

UNKNOWN_CATEGORY_ID = "unknown"
_VALID_MODES: tuple[Mode, ...] = ("off", "suggest", "auto_with_queue", "full_auto")


class SelfImprovementPolicyError(Exception):
    pass


# --------------------------------------------------------------------------- #
# Catalog loading
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def load_policy_catalog() -> dict[str, Any]:
    if not _CATALOG_PATH.is_file():
        raise SelfImprovementPolicyError(f"Missing policy catalog: {_CATALOG_PATH}")
    with _CATALOG_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data.get("categories"), list):
        raise SelfImprovementPolicyError(
            "self-improvement-policy.json: categories must be a list"
        )
    return data


def _categories_by_id() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for raw in load_policy_catalog()["categories"]:
        if isinstance(raw, dict) and raw.get("id"):
            out[str(raw["id"])] = raw
    if UNKNOWN_CATEGORY_ID not in out:
        out[UNKNOWN_CATEGORY_ID] = {
            "id": UNKNOWN_CATEGORY_ID,
            "label": "Uncategorized",
            "risk_tier": "medium",
            "decision": "queue",
            "keywords": [],
        }
    return out


def get_category(category_id: str) -> dict[str, Any]:
    return _categories_by_id().get(category_id) or _categories_by_id()[UNKNOWN_CATEGORY_ID]


# --------------------------------------------------------------------------- #
# Effective policy (defaults + org overrides)
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class EvidenceGates:
    min_supporting_calls: int = 3
    max_quality_score_to_trigger: float = 0.7
    min_confidence: float = 0.6
    cooldown_hours: int = 24
    max_auto_applies_per_day: int = 3


@dataclass(frozen=True)
class EffectivePolicy:
    mode: Mode
    gates: EvidenceGates
    category_decisions: dict[str, CategoryDecision]

    def decision_for(self, category_id: str) -> CategoryDecision:
        if category_id in self.category_decisions:
            return self.category_decisions[category_id]
        return str(get_category(category_id).get("decision") or "queue")  # type: ignore[return-value]


def _coerce_mode(value: Any, fallback: Mode) -> Mode:
    if isinstance(value, str) and value in _VALID_MODES:
        return value  # type: ignore[return-value]
    return fallback


def resolve_effective_policy(org_overrides: dict[str, Any] | None = None) -> EffectivePolicy:
    """Merge org overrides on top of the catalog defaults.

    Override shape (all optional)::

        {
          "mode": "auto_with_queue",
          "evidence_gates": {"min_supporting_calls": 5, ...},
          "category_decisions": {"scheduling_logic": "auto_apply"}
        }

    Org overrides can never weaken a ``block`` category to auto_apply — blocked
    categories stay human-gated regardless of override.
    """
    catalog = load_policy_catalog()
    overrides = org_overrides or {}

    mode = _coerce_mode(
        overrides.get("mode"), _coerce_mode(catalog.get("default_mode"), "suggest")
    )

    base_gates = catalog.get("evidence_gates") or {}
    gate_overrides = overrides.get("evidence_gates") or {}

    def _gate(key: str, default: Any) -> Any:
        if key in gate_overrides and gate_overrides[key] is not None:
            return gate_overrides[key]
        if key in base_gates and base_gates[key] is not None:
            return base_gates[key]
        return default

    gates = EvidenceGates(
        min_supporting_calls=int(_gate("min_supporting_calls", 3)),
        max_quality_score_to_trigger=float(_gate("max_quality_score_to_trigger", 0.7)),
        min_confidence=float(_gate("min_confidence", 0.6)),
        cooldown_hours=int(_gate("cooldown_hours", 24)),
        max_auto_applies_per_day=int(_gate("max_auto_applies_per_day", 3)),
    )

    decisions: dict[str, CategoryDecision] = {}
    cat_overrides = overrides.get("category_decisions") or {}
    for cat_id, cat in _categories_by_id().items():
        base_decision: CategoryDecision = str(cat.get("decision") or "queue")  # type: ignore[assignment]
        override = cat_overrides.get(cat_id)
        # Hard guardrail: a catalog-blocked category can never be auto-applied.
        if base_decision == "block":
            decisions[cat_id] = "block"
            continue
        if override in ("auto_apply", "queue", "block"):
            decisions[cat_id] = override
        else:
            decisions[cat_id] = base_decision
    return EffectivePolicy(mode=mode, gates=gates, category_decisions=decisions)


# --------------------------------------------------------------------------- #
# Classification
# --------------------------------------------------------------------------- #
def classify_improvement(text: str, *, explicit_category: str | None = None) -> str:
    """Pick the best-matching category id for a proposed improvement.

    Highest-risk match wins on ties so sensitive changes are never under-classified
    (e.g. a snippet mentioning both "confirm" and "SSN" classifies as pii_handling).
    """
    if explicit_category and explicit_category in _categories_by_id():
        return explicit_category

    haystack = (text or "").lower()
    risk_rank = {"high": 3, "medium": 2, "low": 1}
    best_id = UNKNOWN_CATEGORY_ID
    best_score = (0, 0)  # (risk_rank, keyword_hits)

    for cat_id, cat in _categories_by_id().items():
        keywords = cat.get("keywords") or []
        hits = sum(1 for kw in keywords if kw and str(kw).lower() in haystack)
        if hits == 0:
            continue
        rank = risk_rank.get(str(cat.get("risk_tier")), 0)
        score = (rank, hits)
        if score > best_score:
            best_score = score
            best_id = cat_id
    return best_id


# --------------------------------------------------------------------------- #
# Proposal evaluation
# --------------------------------------------------------------------------- #
@dataclass
class ImprovementProposal:
    text: str
    category: str | None = None
    confidence: float | None = None
    supporting_calls: int = 1
    quality_score: float | None = None
    auto_applies_today: int = 0
    hours_since_last_auto_apply: float | None = None
    title: str = ""

    def classification_text(self) -> str:
        return f"{self.title}\n{self.text}".strip()


@dataclass
class ImprovementDecision:
    decision: ProposalDecision
    category: str
    risk_tier: RiskTier
    requires_human: bool
    auto_eligible: bool
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision,
            "category": self.category,
            "risk_tier": self.risk_tier,
            "requires_human": self.requires_human,
            "auto_eligible": self.auto_eligible,
            "reasons": self.reasons,
        }


def evaluate_proposal(
    proposal: ImprovementProposal,
    *,
    policy: EffectivePolicy | None = None,
) -> ImprovementDecision:
    """Decide auto_apply / queue / reject for a single proposed improvement."""
    pol = policy or resolve_effective_policy()
    category_id = classify_improvement(
        proposal.classification_text(), explicit_category=proposal.category
    )
    category = get_category(category_id)
    risk_tier: RiskTier = str(category.get("risk_tier") or "medium")  # type: ignore[assignment]
    category_decision = pol.decision_for(category_id)
    reasons: list[str] = [f"classified as {category_id} ({risk_tier} risk)"]

    # 1) Global mode off -> nothing happens.
    if pol.mode == "off":
        reasons.append("self-improvement mode is off")
        return ImprovementDecision(
            decision="reject",
            category=category_id,
            risk_tier=risk_tier,
            requires_human=False,
            auto_eligible=False,
            reasons=reasons,
        )

    # 2) Blocked categories are always human-gated, never auto.
    if category_decision == "block":
        reasons.append("category is block-listed from auto-apply (always requires human)")
        return ImprovementDecision(
            decision="queue",
            category=category_id,
            risk_tier=risk_tier,
            requires_human=True,
            auto_eligible=False,
            reasons=reasons,
        )

    # 3) Evidence gates determine whether auto-apply is even on the table.
    gate_failures = _evidence_gate_failures(proposal, pol.gates)
    auto_eligible_category = category_decision == "auto_apply"

    # 4) suggest mode never auto-applies.
    if pol.mode == "suggest":
        reasons.append("suggest mode: all changes queue for approval")
        return ImprovementDecision(
            decision="queue",
            category=category_id,
            risk_tier=risk_tier,
            requires_human=True,
            auto_eligible=auto_eligible_category and not gate_failures,
            reasons=reasons,
        )

    # 5) full_auto promotes non-blocked categories to auto-eligible.
    promote_to_auto = auto_eligible_category or pol.mode == "full_auto"
    if pol.mode == "full_auto" and not auto_eligible_category:
        reasons.append("full_auto mode: non-blocked category promoted to auto-apply")

    if not promote_to_auto:
        reasons.append("category routes to approval queue under this mode")
        return ImprovementDecision(
            decision="queue",
            category=category_id,
            risk_tier=risk_tier,
            requires_human=True,
            auto_eligible=False,
            reasons=reasons,
        )

    if gate_failures:
        reasons.extend(gate_failures)
        reasons.append("insufficient evidence for auto-apply; queued for human review")
        return ImprovementDecision(
            decision="queue",
            category=category_id,
            risk_tier=risk_tier,
            requires_human=True,
            auto_eligible=False,
            reasons=reasons,
        )

    reasons.append("evidence gates passed; applying automatically")
    return ImprovementDecision(
        decision="auto_apply",
        category=category_id,
        risk_tier=risk_tier,
        requires_human=False,
        auto_eligible=True,
        reasons=reasons,
    )


def _evidence_gate_failures(
    proposal: ImprovementProposal, gates: EvidenceGates
) -> list[str]:
    failures: list[str] = []
    if proposal.supporting_calls < gates.min_supporting_calls:
        failures.append(
            f"only {proposal.supporting_calls} supporting call(s); "
            f"need {gates.min_supporting_calls}"
        )
    if proposal.confidence is not None and proposal.confidence < gates.min_confidence:
        failures.append(
            f"confidence {proposal.confidence:.2f} below {gates.min_confidence:.2f}"
        )
    if (
        proposal.quality_score is not None
        and proposal.quality_score > gates.max_quality_score_to_trigger
    ):
        failures.append(
            f"QM score {proposal.quality_score:.2f} above trigger "
            f"{gates.max_quality_score_to_trigger:.2f} (calls already healthy)"
        )
    if proposal.auto_applies_today >= gates.max_auto_applies_per_day:
        failures.append(
            f"daily auto-apply cap reached ({gates.max_auto_applies_per_day})"
        )
    if (
        proposal.hours_since_last_auto_apply is not None
        and proposal.hours_since_last_auto_apply < gates.cooldown_hours
    ):
        failures.append(
            f"within {gates.cooldown_hours}h cooldown "
            f"({proposal.hours_since_last_auto_apply:.1f}h since last auto-apply)"
        )
    return failures
