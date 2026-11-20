"""Unit tests for the agent self-improvement governance policy (MK-01-SELFIMPROVE)."""

from api.services.analytics.self_improvement_policy import (
    ImprovementProposal,
    classify_improvement,
    evaluate_proposal,
    resolve_effective_policy,
)


def _strong_evidence(**kwargs) -> ImprovementProposal:
    base = dict(
        text="Reword the greeting to sound warmer and more natural.",
        confidence=0.9,
        supporting_calls=5,
        quality_score=0.5,
        auto_applies_today=0,
        hours_since_last_auto_apply=48.0,
    )
    base.update(kwargs)
    return ImprovementProposal(**base)


# --------------------------------------------------------------------------- #
# Classification
# --------------------------------------------------------------------------- #
def test_classifies_low_risk_phrasing():
    assert classify_improvement("Make the greeting warmer and more concise") == "phrasing_tone"


def test_classifies_compliance_as_high_risk():
    assert (
        classify_improvement("Add the call recording disclosure and consent language")
        == "disclosure_compliance"
    )


def test_highest_risk_wins_on_mixed_signal():
    # Mentions both a low-risk "confirm" and high-risk "SSN" -> must pick PII.
    assert (
        classify_improvement("Confirm the booking but never read back the full SSN")
        == "pii_handling"
    )


def test_unknown_when_no_keywords():
    assert classify_improvement("xyzzy plugh frobnicate") == "unknown"


def test_explicit_category_respected():
    assert (
        classify_improvement("anything", explicit_category="routing_escalation")
        == "routing_escalation"
    )


# --------------------------------------------------------------------------- #
# Mode behavior
# --------------------------------------------------------------------------- #
def test_off_mode_rejects():
    policy = resolve_effective_policy({"mode": "off"})
    decision = evaluate_proposal(_strong_evidence(), policy=policy)
    assert decision.decision == "reject"
    assert decision.requires_human is False


def test_suggest_mode_always_queues_even_low_risk():
    policy = resolve_effective_policy({"mode": "suggest"})
    decision = evaluate_proposal(_strong_evidence(), policy=policy)
    assert decision.decision == "queue"
    assert decision.requires_human is True
    # Still reports it *would* be auto-eligible if mode allowed it.
    assert decision.auto_eligible is True


def test_auto_with_queue_applies_low_risk_with_evidence():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    decision = evaluate_proposal(_strong_evidence(), policy=policy)
    assert decision.decision == "auto_apply"
    assert decision.requires_human is False


def test_auto_with_queue_queues_medium_risk():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    proposal = _strong_evidence(
        text="Change how the agent offers reschedule slots and handles no-shows."
    )
    decision = evaluate_proposal(proposal, policy=policy)
    assert decision.category == "scheduling_logic"
    assert decision.decision == "queue"


def test_full_auto_promotes_medium_risk_but_not_blocked():
    policy = resolve_effective_policy({"mode": "full_auto"})
    medium = evaluate_proposal(
        _strong_evidence(text="Adjust when the agent escalates to a human supervisor."),
        policy=policy,
    )
    assert medium.decision == "auto_apply"

    blocked = evaluate_proposal(
        _strong_evidence(text="Update the HIPAA consent disclosure wording."),
        policy=policy,
    )
    assert blocked.decision == "queue"
    assert blocked.requires_human is True
    assert blocked.auto_eligible is False


# --------------------------------------------------------------------------- #
# Guardrails: blocked categories
# --------------------------------------------------------------------------- #
def test_blocked_category_never_auto_even_with_override():
    # Org tries to force compliance changes to auto_apply -> must be refused.
    policy = resolve_effective_policy(
        {
            "mode": "full_auto",
            "category_decisions": {"disclosure_compliance": "auto_apply"},
        }
    )
    decision = evaluate_proposal(
        _strong_evidence(text="Reword the recording consent disclosure."),
        policy=policy,
    )
    assert decision.decision == "queue"
    assert decision.requires_human is True


def test_pricing_queues_under_auto_with_queue():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    decision = evaluate_proposal(
        _strong_evidence(text="Offer a 10% discount to hesitant callers."),
        policy=policy,
    )
    assert decision.category == "pricing_quote"
    assert decision.decision == "queue"


# --------------------------------------------------------------------------- #
# Evidence gates
# --------------------------------------------------------------------------- #
def test_insufficient_supporting_calls_queues():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    decision = evaluate_proposal(_strong_evidence(supporting_calls=1), policy=policy)
    assert decision.decision == "queue"
    assert any("supporting call" in r for r in decision.reasons)


def test_low_confidence_queues():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    decision = evaluate_proposal(_strong_evidence(confidence=0.3), policy=policy)
    assert decision.decision == "queue"


def test_healthy_quality_score_does_not_trigger_auto():
    policy = resolve_effective_policy({"mode": "auto_with_queue"})
    decision = evaluate_proposal(_strong_evidence(quality_score=0.95), policy=policy)
    assert decision.decision == "queue"


def test_daily_cap_blocks_auto():
    policy = resolve_effective_policy(
        {"mode": "auto_with_queue", "evidence_gates": {"max_auto_applies_per_day": 2}}
    )
    decision = evaluate_proposal(_strong_evidence(auto_applies_today=2), policy=policy)
    assert decision.decision == "queue"


def test_cooldown_blocks_auto():
    policy = resolve_effective_policy(
        {"mode": "auto_with_queue", "evidence_gates": {"cooldown_hours": 24}}
    )
    decision = evaluate_proposal(
        _strong_evidence(hours_since_last_auto_apply=1.0), policy=policy
    )
    assert decision.decision == "queue"


# --------------------------------------------------------------------------- #
# Org overrides
# --------------------------------------------------------------------------- #
def test_override_can_promote_medium_to_auto():
    policy = resolve_effective_policy(
        {
            "mode": "auto_with_queue",
            "category_decisions": {"scheduling_logic": "auto_apply"},
        }
    )
    decision = evaluate_proposal(
        _strong_evidence(text="Tighten how reschedule slots are offered."),
        policy=policy,
    )
    assert decision.category == "scheduling_logic"
    assert decision.decision == "auto_apply"


def test_default_mode_is_safe_suggest():
    policy = resolve_effective_policy()
    assert policy.mode == "suggest"
