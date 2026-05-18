"""Who may set ``detail_redaction_enabled`` to False (disable PII redaction)."""

from __future__ import annotations

import os
from typing import Awaitable, Callable, Optional

from fastapi import HTTPException
from loguru import logger

from api.constants import AUTH_PROVIDER
from api.db.models import UserModel
from api.services.auth.stack_auth import stackauth


def _env_truthy(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


def _permission_id_env() -> str:
    return os.getenv("MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID", "").strip()


async def compute_may_disable_detail_redaction(
    user: UserModel,
    *,
    uses_api_key: bool,
    authorization: str | None,
    list_team_permissions: Optional[
        Callable[[str, str], Awaitable[list[str]]]
    ] = None,
) -> bool:
    """
    Return whether this principal may disable analytics detail redaction.

    Always True when turning redaction *on*; this answers the dangerous direction only.
    """
    if uses_api_key:
        return False

    # Default OSS/local: any signed-in user may disable redaction (QM workflows).
    # Opt-in strict mode (CI / explicit): honor superuser + REQUIRE_SUPERUSER gates like hosted Stack.
    local_permissive = AUTH_PROVIDER == "local" and not _env_truthy(
        "MK01_ANALYTICS_LOCAL_E2E_STRICT_REDACTION_RBAC"
    )
    if local_permissive:
        return True

    if user.is_superuser:
        return True
    if _env_truthy("MK01_ANALYTICS_REDACTION_DISABLE_REQUIRES_SUPERUSER"):
        return False

    required_pid = _permission_id_env()
    if not required_pid:
        return True

    list_fn = list_team_permissions or stackauth.list_team_permission_ids
    if not authorization:
        logger.warning(
            "MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID set but request has no Authorization"
        )
        return False

    stack_user = await stackauth.get_user(authorization)
    if not stack_user:
        return False

    team_id: str | None = stack_user.get("selected_team_id")
    if not team_id and stack_user.get("selected_team"):
        team_id = stack_user["selected_team"].get("id")
    if not team_id:
        logger.warning(
            "Stack user missing selected team while MK01_ANALYTICS_REDACTION_DISABLE_PERMISSION_ID is set"
        )
        return False

    try:
        ids = await list_fn(authorization, str(team_id))
    except Exception as exc:
        logger.warning("Stack team permission fetch failed: {}", exc)
        return False

    return required_pid in ids


async def ensure_may_disable_analytics_detail_redaction(
    user: UserModel,
    *,
    uses_api_key: bool,
    authorization: str | None,
    list_team_permissions: Optional[
        Callable[[str, str], Awaitable[list[str]]]
    ] = None,
) -> None:
    """Raise 403 if ``detail_redaction_enabled=False`` must be rejected."""
    ok = await compute_may_disable_detail_redaction(
        user,
        uses_api_key=uses_api_key,
        authorization=authorization,
        list_team_permissions=list_team_permissions,
    )
    if not ok:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission to disable analytics PII redaction for this organization."
            ),
        )
