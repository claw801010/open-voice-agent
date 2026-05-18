import os

import aiohttp
from loguru import logger


def resolve_stack_team_permissions_url(api_base: str | None, permissions_path: str) -> str:
    """Join Stack API base URL with the team-permissions path.

    ``permissions_path`` comes from ``STACK_AUTH_TEAM_PERMISSIONS_PATH`` or the default
    ``/api/v1/team-permissions``. A path without a leading slash is normalized.
    Empty ``api_base`` yields a path-only URL (relative join behavior matches prior code).
    """
    base = (api_base or "").rstrip("/")
    normalized = (
        permissions_path
        if permissions_path.startswith("/")
        else f"/{permissions_path}"
    )
    return f"{base}{normalized}"


class StackAuth:
    def __init__(self):
        self.project_id = os.environ.get("STACK_AUTH_PROJECT_ID")
        self.secret_server_key = os.environ.get("STACK_SECRET_SERVER_KEY")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _strip_bearer(self, access_token: str | None) -> str | None:
        """Remove the leading "Bearer " prefix from the token if present."""
        if not access_token:
            return None
        if access_token.startswith("Bearer "):
            return access_token.split(" ", 1)[1]
        return access_token

    async def get_user(self, access_token: str):
        if not access_token:
            return None

        access_token = self._strip_bearer(access_token)

        url = os.environ.get("STACK_AUTH_API_URL") + "/api/v1/users/me"
        headers = {
            "x-stack-access-type": "server",
            "x-stack-project-id": self.project_id,
            "x-stack-secret-server-key": self.secret_server_key,
            "x-stack-access-token": access_token,
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                response = await response.json()
                if "id" in response:
                    return response
                else:
                    return None

    async def list_team_permission_ids(self, access_token: str, team_id: str) -> list[str]:
        """Return permission id strings for the current user on ``team_id`` (Stack Auth RBAC).

        Uses ``GET`` ``/api/v1/team-permissions`` by default. Override path via
        ``STACK_AUTH_TEAM_PERMISSIONS_PATH`` if your Stack deployment differs.
        """
        if not access_token or not team_id:
            return []

        access_token = self._strip_bearer(access_token)
        if not access_token:
            return []

        path = os.getenv(
            "STACK_AUTH_TEAM_PERMISSIONS_PATH", "/api/v1/team-permissions"
        )
        url = resolve_stack_team_permissions_url(
            os.environ.get("STACK_AUTH_API_URL"), path
        )

        headers = {
            "x-stack-access-type": "server",
            "x-stack-project-id": self.project_id,
            "x-stack-secret-server-key": self.secret_server_key,
            "x-stack-access-token": access_token,
        }

        params = {"team_id": team_id, "user_id": "me"}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    logger.warning(
                        "Stack team permissions HTTP {} for team_id={}",
                        response.status,
                        team_id,
                    )
                    return []
                try:
                    payload = await response.json()
                except Exception:
                    return []

        return self._parse_permission_ids(payload)

    @staticmethod
    def _parse_permission_ids(payload: object) -> list[str]:
        if payload is None:
            return []
        if isinstance(payload, list):
            out: list[str] = []
            for x in payload:
                if isinstance(x, str):
                    out.append(x)
                elif isinstance(x, dict) and x.get("id") is not None:
                    out.append(str(x["id"]))
            return out
        if isinstance(payload, dict):
            for key in ("items", "permissions", "team_permissions"):
                if key in payload:
                    return StackAuth._parse_permission_ids(payload[key])
        return []

    async def impersonate(self, stack_user_id: str):
        url = os.environ.get("STACK_AUTH_API_URL") + "/api/v1/auth/sessions"
        headers = {
            "x-stack-access-type": "server",
            "x-stack-project-id": self.project_id,
            "x-stack-secret-server-key": self.secret_server_key,
        }

        data = {
            "user_id": stack_user_id,
            "expires_in_millis": 3600000,
            "is_impersonation": True,
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=data) as response:
                response = await response.json()
                return response

    # ------------------------------------------------------------------
    # Team & user management helpers
    # ------------------------------------------------------------------

    # async def create_team(
    #     self,
    #     access_token: str,
    #     display_name: str,
    #     profile_image_url: str | None = None,
    #     client_metadata: dict | None = None,
    # ) -> dict:
    #     """Create a new team for the authenticated user and return the API response."""
    #     token = self._strip_bearer(access_token)
    #     if token is None:
    #         raise ValueError("Access token required to create team")

    #     url = os.environ.get("STACK_AUTH_API_URL") + "/api/v1/teams"
    #     headers = {
    #         "x-stack-access-type": "server",
    #         "x-stack-project-id": self.project_id,
    #         "x-stack-secret-server-key": self.secret_server_key,
    #         "x-stack-access-token": token,
    #         "Content-Type": "application/json",
    #     }

    #     payload: dict = {
    #         "display_name": display_name,
    #         "creator_user_id": "me",
    #     }
    #     if profile_image_url is not None:
    #         payload["profile_image_url"] = profile_image_url
    #     if client_metadata is not None:
    #         payload["client_metadata"] = client_metadata

    #     async with aiohttp.ClientSession() as session:
    #         async with session.post(url, headers=headers, json=payload) as response:
    #             return await response.json()

    # async def update_user(self, access_token: str, data: dict) -> dict:
    #     """Patch the current user with supplied data and return the API response."""
    #     token = self._strip_bearer(access_token)
    #     if token is None:
    #         raise ValueError("Access token required to update user")

    #     url = os.environ.get("STACK_AUTH_API_URL") + "/api/v1/users/me"
    #     headers = {
    #         "x-stack-access-type": "server",
    #         "x-stack-project-id": self.project_id,
    #         "x-stack-secret-server-key": self.secret_server_key,
    #         "x-stack-access-token": token,
    #         "Content-Type": "application/json",
    #     }

    #     async with aiohttp.ClientSession() as session:
    #         async with session.patch(url, headers=headers, json=data) as response:
    #             return await response.json()


stackauth = StackAuth()
