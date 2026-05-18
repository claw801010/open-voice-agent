"""STACK_AUTH_TEAM_PERMISSIONS_PATH — URL join regression guard."""

from api.services.auth.stack_auth import resolve_stack_team_permissions_url


def test_default_path_joins_stack_api_base() -> None:
    url = resolve_stack_team_permissions_url(
        "https://api.stack-auth.example.com/",
        "/api/v1/team-permissions",
    )
    assert url == "https://api.stack-auth.example.com/api/v1/team-permissions"


def test_custom_env_style_path_without_leading_slash() -> None:
    url = resolve_stack_team_permissions_url(
        "https://stack.example",
        "api/v2/custom-team-perms",
    )
    assert url == "https://stack.example/api/v2/custom-team-perms"


def test_empty_base_yields_path_only() -> None:
    url = resolve_stack_team_permissions_url(None, "/api/v1/team-permissions")
    assert url == "/api/v1/team-permissions"


def test_blank_base_string_yields_path_only() -> None:
    url = resolve_stack_team_permissions_url("", "/api/v1/team-permissions")
    assert url == "/api/v1/team-permissions"
