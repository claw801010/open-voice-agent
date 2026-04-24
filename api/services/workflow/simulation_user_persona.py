"""Pure helpers for editor text simulation (WE-01-TEST) — no FastAPI / DB imports."""


def apply_user_persona(persona: str | None, content: str) -> str:
    """Prefix user-side text so the agent LLM sees a role-play hint (editor simulation only)."""
    c = content.strip()
    if not c:
        return c
    if not persona or not str(persona).strip():
        return c
    p = str(persona).strip()[:2000]
    return f"[Simulated caller persona: {p}]\n\n{c}"
