"""Pydantic models for HTTP API custom tools (shared by routes and unit tests)."""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ToolParameter(BaseModel):
    """A parameter that the tool accepts."""

    name: str = Field(description="Parameter name (used as key in request body)")
    type: str = Field(description="Parameter type: string, number, or boolean")
    description: str = Field(description="Description of what the parameter is for")
    required: bool = Field(
        default=True, description="Whether this parameter is required"
    )
    value_template: Optional[str] = Field(
        default=None,
        description="Optional fallback template (e.g. {{customer.id}}) resolved from context variables",
    )


class HttpHeaderField(BaseModel):
    """Extended header field with optional description."""

    key: str = Field(description="Header key")
    value: str = Field(description="Header value")
    description: Optional[str] = Field(
        default=None, description="Optional header description"
    )


class HttpApiConfig(BaseModel):
    """Configuration for HTTP API tools."""

    method: str = Field(description="HTTP method (GET, POST, PUT, PATCH, DELETE)")
    url: str = Field(description="Target URL")
    headers: Optional[Dict[str, str]] = Field(
        default=None, description="Static headers to include"
    )
    header_fields: Optional[List[HttpHeaderField]] = Field(
        default=None, description="Header rows including optional descriptions"
    )
    credential_uuid: Optional[str] = Field(
        default=None, description="Reference to ExternalCredentialModel for auth"
    )
    parameters: Optional[List[ToolParameter]] = Field(
        default=None, description="Parameters that the tool accepts from LLM"
    )
    timeout_ms: Optional[int] = Field(
        default=5000, description="Request timeout in milliseconds"
    )
    customMessage: Optional[str] = Field(
        default=None, description="Custom message to play after tool execution"
    )
    customMessageType: Optional[Literal["text", "audio"]] = Field(
        default=None, description="Type of custom message: text or audio"
    )
    customMessageRecordingId: Optional[str] = Field(
        default=None, description="Recording ID for audio custom message"
    )
    response_mapping: Optional[Dict[str, str]] = Field(
        default=None,
        description="Optional output-field -> response.path mapping for tool responses",
    )
    body_template: Optional[str] = Field(
        default=None,
        description="Optional JSON template string for request body/query defaults",
    )
    raw_code: Optional[str] = Field(
        default=None,
        description="Optional raw snippet for operator reference (not executed server-side)",
    )
    raw_language: Optional[Literal["python", "bash"]] = Field(
        default=None,
        description="Language label for raw_code (UI / export)",
    )
    response_storage_mode: Literal["live_only", "org_cache_when_enabled"] = Field(
        default="live_only",
        description=(
            "WE-01-DATASTORE-INTEG — authoring only until runtime cache ships: "
            "live_only = always hit upstream; org_cache_when_enabled = honor org cache policy when implemented."
        ),
    )
