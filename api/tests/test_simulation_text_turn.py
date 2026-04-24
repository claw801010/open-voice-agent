"""Unit tests for editor text simulation (WE-01-TEST)."""

from api.services.workflow.simulation_user_persona import apply_user_persona


def test_apply_user_persona_no_persona_strips_message() -> None:
    assert apply_user_persona(None, "  hi  ") == "hi"
    assert apply_user_persona("", "x") == "x"


def test_apply_user_persona_prefixes_hint() -> None:
    out = apply_user_persona("Impatient shopper", "Where is my order?")
    assert out.startswith("[Simulated caller persona: Impatient shopper]")
    assert "Where is my order?" in out
