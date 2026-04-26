"""Custom tool execution for user-defined HTTP API tools."""

import json
import re
from typing import Any, Dict, Optional

import httpx
from loguru import logger

from api.db import db_client
from api.utils.credential_auth import build_auth_header

# Map tool parameter types to JSON schema types
TYPE_MAP = {
    "string": "string",
    "number": "number",
    "boolean": "boolean",
}


def tool_to_function_schema(tool: Any) -> Dict[str, Any]:
    """Convert a ToolModel to an LLM function schema.

    Args:
        tool: ToolModel instance with name, description, and definition

    Returns:
        Function schema dict compatible with OpenAI/Anthropic function calling
    """
    definition = tool.definition or {}
    config = definition.get("config", {})
    parameters = config.get("parameters", []) or []

    # Build properties and required list from parameters
    properties = {}
    required = []

    for param in parameters:
        param_name = param.get("name", "")
        param_type = param.get("type", "string")
        param_desc = param.get("description", "")
        param_required = param.get("required", True)

        if not param_name:
            continue

        properties[param_name] = {
            "type": TYPE_MAP.get(param_type, "string"),
            "description": param_desc,
        }

        if param_required:
            required.append(param_name)

    # If this is an end_call tool with endCallReason enabled, add a required 'reason' parameter
    if definition.get("type") == "end_call" and config.get("endCallReason", False):
        default_description = (
            "The reason for ending the call (e.g., 'voicemail_detected', "
            "'issue_resolved', 'customer_requested')"
        )
        properties["reason"] = {
            "type": "string",
            "description": config.get("endCallReasonDescription")
            or default_description,
        }
        required.append("reason")

    # Sanitize tool name for function name (lowercase, underscores only)
    function_name = re.sub(r"[^a-z0-9_]", "_", tool.name.lower())
    # Remove consecutive underscores and trim
    function_name = re.sub(r"_+", "_", function_name).strip("_")

    return {
        "type": "function",
        "function": {
            "name": function_name,
            "description": tool.description or f"Execute {tool.name} tool",
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
        "_tool_uuid": tool.tool_uuid,
    }


async def execute_http_tool(
    tool: Any,
    arguments: Dict[str, Any],
    call_context_vars: Optional[Dict[str, Any]] = None,
    organization_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute an HTTP API tool.

    Args:
        tool: ToolModel instance
        arguments: Arguments passed by the LLM (parameter name -> value)
        call_context_vars: Additional context variables from the call (unused for now)
        organization_id: Organization ID for credential lookup

    Returns:
        Result dict with response data or error
    """
    definition = tool.definition or {}
    config = definition.get("config", {})

    logger.info(
        f"Executing custom tool '{tool.name}' ({tool.tool_uuid}): "
        f"{config.get('method', 'POST').upper()} {config.get('url', '')}"
    )
    return await execute_http_request(
        config=config,
        arguments=arguments,
        call_context_vars=call_context_vars,
        organization_id=organization_id,
    )


def _extract_path_value(payload: Any, path: str) -> Any:
    """Read a nested value from payload using dot-separated path."""
    if not path:
        return None

    current = payload
    for segment in path.split("."):
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(segment)
            continue
        if isinstance(current, list):
            try:
                current = current[int(segment)]
            except (ValueError, IndexError):
                return None
            continue
        return None
    return current


def _apply_response_mapping(
    response_data: Any, response_mapping: Optional[Dict[str, str]]
) -> Dict[str, Any]:
    """Apply output_field -> response.path mapping to response payload."""
    if not response_mapping:
        return {}

    mapped: Dict[str, Any] = {}
    for output_key, path in response_mapping.items():
        if not output_key or not isinstance(path, str):
            continue
        mapped[output_key] = _extract_path_value(response_data, path.strip())
    return mapped


def _resolve_template_value(
    template: str,
    arguments: Dict[str, Any],
    call_context_vars: Optional[Dict[str, Any]] = None,
) -> Any:
    """Resolve {{path.to.value}} placeholders against arguments/context vars."""
    sources = [arguments, call_context_vars or {}]
    full_match = re.fullmatch(r"\s*\{\{([^{}]+)\}\}\s*", template)
    if full_match:
        path = full_match.group(1).strip()
        for source in sources:
            value = _extract_path_value(source, path)
            if value is not None:
                return value
        return None

    def replace(match: re.Match[str]) -> str:
        path = match.group(1).strip()
        for source in sources:
            value = _extract_path_value(source, path)
            if value is not None:
                return str(value)
        return ""

    return re.sub(r"\{\{([^{}]+)\}\}", replace, template)


def _resolve_templates_recursive(
    value: Any,
    arguments: Dict[str, Any],
    call_context_vars: Optional[Dict[str, Any]] = None,
) -> Any:
    if isinstance(value, str):
        return _resolve_template_value(value, arguments, call_context_vars)
    if isinstance(value, list):
        return [
            _resolve_templates_recursive(item, arguments, call_context_vars)
            for item in value
        ]
    if isinstance(value, dict):
        return {
            key: _resolve_templates_recursive(item, arguments, call_context_vars)
            for key, item in value.items()
        }
    return value


async def execute_http_request(
    *,
    config: Dict[str, Any],
    arguments: Dict[str, Any],
    call_context_vars: Optional[Dict[str, Any]] = None,
    organization_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute an HTTP request with optional credential and response mapping."""
    method = config.get("method", "POST").upper()
    url_raw = str(config.get("url", "") or "").strip()
    response_mapping = config.get("response_mapping") or {}

    timeout_ms = config.get("timeout_ms", 5000)
    timeout_seconds = timeout_ms / 1000

    parameters = config.get("parameters", []) or []
    merged_arguments = dict(arguments or {})
    for param in parameters:
        if not isinstance(param, dict):
            continue
        name = (param.get("name") or "").strip()
        value_template = (param.get("value_template") or "").strip()
        if name and name not in merged_arguments and value_template:
            merged_arguments[name] = _resolve_templates_recursive(
                value_template, arguments, call_context_vars
            )

    body_template = (config.get("body_template") or "").strip()
    template_payload = None
    if body_template:
        try:
            template_json = json.loads(body_template)
            if isinstance(template_json, dict):
                template_payload = _resolve_templates_recursive(
                    template_json, merged_arguments, call_context_vars
                )
        except Exception:
            logger.warning("Invalid body_template JSON, skipping template defaults.")

    final_payload = dict(template_payload or {})
    final_payload.update(merged_arguments)

    headers: Dict[str, str] = {}
    raw_flat_headers = dict(config.get("headers", {}) or {})
    for key, value in raw_flat_headers.items():
        k = str(key or "").strip()
        if not k or value is None:
            continue
        headers[k] = str(
            _resolve_templates_recursive(value, final_payload, call_context_vars)
        )
    for field in config.get("header_fields", []) or []:
        if not isinstance(field, dict):
            continue
        key = (field.get("key") or "").strip()
        value = field.get("value")
        if key and value is not None:
            headers[key] = str(
                _resolve_templates_recursive(
                    value, final_payload, call_context_vars
                )
            )

    credential_uuid = config.get("credential_uuid")
    if credential_uuid and organization_id:
        try:
            credential = await db_client.get_credential_by_uuid(
                credential_uuid, organization_id
            )
            if credential:
                auth_header = build_auth_header(credential)
                headers.update(auth_header)
        except Exception as e:
            logger.error(f"Failed to fetch credential for HTTP request: {e}")

    url = str(
        _resolve_templates_recursive(url_raw, final_payload, call_context_vars)
    ).strip()
    if not url:
        return {
            "status": "error",
            "error": "URL is empty after resolving {{…}} templates",
        }

    body = None
    params = None
    if method in ("POST", "PUT", "PATCH"):
        body = final_payload
    elif method in ("GET", "DELETE") and final_payload:
        params = final_payload

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body,
                params=params,
            )

            try:
                response_data = response.json()
            except Exception:
                response_data = {"raw_response": response.text}

            mapped_data = _apply_response_mapping(response_data, response_mapping)

            return {
                "status": "success",
                "status_code": response.status_code,
                "data": response_data,
                "mapped_data": mapped_data if mapped_data else None,
            }

    except httpx.TimeoutException:
        return {
            "status": "error",
            "error": f"Request timed out after {timeout_seconds} seconds",
        }
    except httpx.RequestError as e:
        return {
            "status": "error",
            "error": f"Request failed: {str(e)}",
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Tool execution failed: {str(e)}",
        }
