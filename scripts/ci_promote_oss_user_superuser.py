#!/usr/bin/env python3
"""Promote an OSS user to superuser (CI only). Used between Playwright strict-RBAC phases.

Requires env: ``DATABASE_URL`` (asyncpg URL), ``E2E_EMAIL``.
"""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def _main() -> None:
    email = os.getenv("E2E_EMAIL", "").strip()
    url = os.getenv("DATABASE_URL", "").strip()
    if not email or not url:
        sys.stderr.write("ci_promote_oss_user_superuser: E2E_EMAIL and DATABASE_URL required\n")
        raise SystemExit(2)

    engine = create_async_engine(url)
    async with engine.begin() as conn:
        result = await conn.execute(
            text("UPDATE users SET is_superuser = true WHERE email = :e RETURNING id"),
            {"e": email},
        )
        row = result.fetchone()
        if row is None:
            sys.stderr.write(f"ci_promote_oss_user_superuser: no user with email {email!r}\n")
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(_main())
