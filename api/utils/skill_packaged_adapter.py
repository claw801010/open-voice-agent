"""Agent skill (SKILL.md) → packaged voice graph draft (MK-01-IMPORT-OPTIONS)."""

from __future__ import annotations

import re
from typing import Any

from api.utils.packaged_import_shell import minimal_packaged_voice_graph

_SKILL_FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
_TEMPLATE_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")
_HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
_DEFAULT_MAX_PROMPT = 12_000


class SkillImportError(ValueError):
    """Raised when skill markdown cannot be distilled."""


def _strip_frontmatter(md: str) -> str:
    return _SKILL_FRONTMATTER_RE.sub("", md, count=1).strip()


def _extract_title(md: str, fallback: str | None) -> str:
    if fallback and fallback.strip():
        return fallback.strip()
    m = _HEADING_RE.search(md)
    if m:
        return m.group(1).strip()
    return "Imported skill"


def suggest_template_variables_from_markdown(md: str) -> list[str]:
    """Unique ``{{var}}`` tokens found in the skill body (sorted)."""
    found = sorted(set(_TEMPLATE_VAR_RE.findall(md)))
    return found


def distill_skill_markdown(
    markdown: str,
    *,
    skill_title: str | None = None,
    max_prompt_chars: int = _DEFAULT_MAX_PROMPT,
) -> tuple[str, list[str], list[str]]:
    """
    Return ``(agent_prompt_body, suggested_template_variables, warnings)``.
    """
    warnings: list[str] = []
    raw = markdown.strip()
    if not raw:
        raise SkillImportError("Skill markdown is empty.")

    body = _strip_frontmatter(raw)
    title = _extract_title(body, skill_title)
    suggested_vars = suggest_template_variables_from_markdown(body)

    header = (
        f"Imported agent skill: {title}\n\n"
        "Follow this guidance in a turn-by-turn voice conversation. "
        "Scripts and CLI commands in the skill are not executed during calls — "
        "wire external APIs as HTTP tools when needed.\n\n"
    )
    prompt = header + body
    if len(prompt) > max_prompt_chars:
        prompt = prompt[: max_prompt_chars - 1] + "…"
        warnings.append(
            f"Skill body truncated to {max_prompt_chars} characters for agent prompt."
        )

    if suggested_vars:
        warnings.append(
            f"Found {len(suggested_vars)} {{template}} token(s) in skill text — "
            "add matching keys to template variables if used in HTTP tools."
        )

    return prompt, suggested_vars, warnings


def draft_packaged_workflow_from_skill(
    markdown: str,
    *,
    skill_title: str | None = None,
    max_prompt_chars: int = _DEFAULT_MAX_PROMPT,
) -> tuple[dict[str, Any], list[str], list[str]]:
    """Build startCall → agentNode → endCall with distilled skill markdown in the agent prompt."""
    prompt, suggested_vars, warnings = distill_skill_markdown(
        markdown, skill_title=skill_title, max_prompt_chars=max_prompt_chars
    )
    graph = minimal_packaged_voice_graph(
        agent_prompt_body=prompt,
        agent_name=skill_title or "Skill agent",
    )
    return graph, warnings, suggested_vars
