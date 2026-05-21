from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.constants import DEFAULT_CAMPAIGN_RETRY_CONFIG, DEFAULT_ORG_CONCURRENCY_LIMIT
from api.db import db_client
from api.db.models import UserModel
from api.enums import OrganizationConfigurationKey, PostHogEvent
from api.schemas.telephony_config import (
    ARIConfigurationRequest,
    ARIConfigurationResponse,
    CloudonixConfigurationRequest,
    CloudonixConfigurationResponse,
    TelephonyConfigurationResponse,
    TelnyxConfigurationRequest,
    TelnyxConfigurationResponse,
    TwilioConfigurationRequest,
    TwilioConfigurationResponse,
    VobizConfigurationRequest,
    VobizConfigurationResponse,
    VonageConfigurationRequest,
    VonageConfigurationResponse,
)
from api.services.auth.depends import get_user
from api.services.workflow.tools.http_tool_cache_policy import (
    HTTP_INTEGRATION_CACHE_POLICY_SCHEMA_VERSION,
    INTEGRATION_RESPONSE_CACHE_DEFERRAL_NOT_BEFORE,
    INTEGRATION_RESPONSE_CACHE_STATUS,
    merge_http_cache_policy_document_with_audit,
    parse_stored_http_cache_policy_audit,
    parse_stored_http_cache_policy_preferences,
)
from api.services.configuration.masking import is_mask_of, mask_key
from api.services.posthog_client import capture_event
from api.services.worker_sync.manager import get_worker_sync_manager
from api.services.worker_sync.protocol import WorkerSyncEventType

router = APIRouter(prefix="/organizations", tags=["organizations"])


class HttpIntegrationCacheIntegrationOverride(BaseModel):
    """Per-connection draft (Nango ``integration_id``). Runtime cache still off."""

    integration_id: str = Field(min_length=1, max_length=512)
    cache_enabled_when_shipped: bool = False
    ttl_seconds: Optional[int] = Field(
        default=None,
        ge=60,
        le=7776000,
        description="Optional TTL override for this connection when cache ships; omit for org default.",
    )
    pii_handling: Literal["allow_with_redaction", "block_cached_store"] = Field(
        default="allow_with_redaction",
        description="Whether cached payloads may be stored subject to org redaction vs blocked for this connection.",
    )


class HttpIntegrationCacheStoredPreferences(BaseModel):
    """Org-persisted draft only. Effective runtime cache remains off until ``implementation_status`` changes."""

    cache_enabled_when_shipped: bool = False
    ttl_seconds: Optional[int] = None
    integration_overrides: List[HttpIntegrationCacheIntegrationOverride] = Field(default_factory=list)


class HttpIntegrationCachePolicyAuditEntry(BaseModel):
    ts: str
    actor_provider_id: str
    cache_enabled_when_shipped: bool
    ttl_seconds: Optional[int] = None
    integration_overrides_count: Optional[int] = Field(
        default=None,
        description="Number of per-integration override rows after this save (schema v4+).",
    )


class HttpIntegrationCachePolicyPut(BaseModel):
    cache_enabled_when_shipped: bool = False
    ttl_seconds: Optional[int] = Field(
        default=None,
        ge=60,
        le=7776000,
        description="Upper TTL hint when cache ships; max 90 days.",
    )
    integration_overrides: List[HttpIntegrationCacheIntegrationOverride] = Field(
        default_factory=list,
        description="Draft per Nango connection id; replaces prior overrides list on save.",
    )


class HttpIntegrationCachePolicyResponse(BaseModel):
    """WE-01-DATASTORE-INTEG — effective runtime stub + optional org-stored draft preferences."""

    organization_id: int
    cache_enabled: bool = False
    deferral_not_before: str
    implementation_status: str
    policy_schema_version: int = HTTP_INTEGRATION_CACHE_POLICY_SCHEMA_VERSION
    stored_preferences: HttpIntegrationCacheStoredPreferences
    policy_audit: List[HttpIntegrationCachePolicyAuditEntry] = Field(default_factory=list)


async def _http_integration_cache_policy_response(org_id: int) -> HttpIntegrationCachePolicyResponse:
    raw = await db_client.get_configuration_value(
        org_id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
        default=None,
    )
    prefs_dict = parse_stored_http_cache_policy_preferences(raw)
    audit_raw = parse_stored_http_cache_policy_audit(raw)
    audit_models = []
    for row in audit_raw:
        audit_models.append(
            HttpIntegrationCachePolicyAuditEntry(
                ts=row["ts"],
                actor_provider_id=row["actor_provider_id"],
                cache_enabled_when_shipped=row["cache_enabled_when_shipped"],
                ttl_seconds=row.get("ttl_seconds"),
                integration_overrides_count=row.get("integration_overrides_count"),
            )
        )
    overrides = prefs_dict.get("integration_overrides") or []
    ov_models = [HttpIntegrationCacheIntegrationOverride(**o) for o in overrides]
    sp = HttpIntegrationCacheStoredPreferences(
        cache_enabled_when_shipped=prefs_dict["cache_enabled_when_shipped"],
        ttl_seconds=prefs_dict["ttl_seconds"],
        integration_overrides=ov_models,
    )
    return HttpIntegrationCachePolicyResponse(
        organization_id=org_id,
        cache_enabled=bool(prefs_dict.get("cache_enabled_when_shipped")),
        deferral_not_before=INTEGRATION_RESPONSE_CACHE_DEFERRAL_NOT_BEFORE,
        implementation_status=INTEGRATION_RESPONSE_CACHE_STATUS,
        policy_schema_version=HTTP_INTEGRATION_CACHE_POLICY_SCHEMA_VERSION,
        stored_preferences=sp,
        policy_audit=audit_models,
    )


@router.get("/http-integration-cache-policy", response_model=HttpIntegrationCachePolicyResponse)
async def get_http_integration_cache_policy(user: UserModel = Depends(get_user)):
    """
    Integration-backed HTTP **response** cache policy for the selected org.

    ``cache_enabled`` reflects org draft ``cache_enabled_when_shipped`` (runtime honors it when
    tools use ``org_cache_when_enabled``). ``stored_preferences`` merges
    the org configuration row when present (draft intent for a future admin UI).
    """
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    return await _http_integration_cache_policy_response(user.selected_organization_id)


@router.put("/http-integration-cache-policy", response_model=HttpIntegrationCachePolicyResponse)
async def put_http_integration_cache_policy(
    body: HttpIntegrationCachePolicyPut,
    user: UserModel = Depends(get_user),
):
    """Persist draft HTTP integration cache preferences for the selected org."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    prev_raw = await db_client.get_configuration_value(
        user.selected_organization_id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
        default=None,
    )
    doc = merge_http_cache_policy_document_with_audit(
        prev_raw,
        body.cache_enabled_when_shipped,
        body.ttl_seconds,
        str(user.provider_id),
        [o.model_dump() for o in body.integration_overrides],
    )
    await db_client.upsert_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.HTTP_INTEGRATION_CACHE_POLICY.value,
        doc,
    )
    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.HTTP_INTEGRATION_CACHE_POLICY_UPDATED,
        properties={
            "organization_id": user.selected_organization_id,
            "cache_enabled_when_shipped": body.cache_enabled_when_shipped,
            "ttl_seconds_set": body.ttl_seconds is not None,
            "integration_overrides_count": len(body.integration_overrides),
        },
    )
    return await _http_integration_cache_policy_response(user.selected_organization_id)

# Provider configuration constants
PROVIDER_MASKED_FIELDS = {
    "twilio": ["account_sid", "auth_token"],
    "vonage": ["private_key", "api_key", "api_secret"],
    "vobiz": ["auth_id", "auth_token"],
    "cloudonix": ["bearer_token"],
    "ari": ["app_password"],
    "telnyx": ["api_key"],
}


# TODO: Make endpoints provider-agnostic
@router.get("/telephony-config", response_model=TelephonyConfigurationResponse)
async def get_telephony_configuration(user: UserModel = Depends(get_user)):
    """Get telephony configuration for the user's organization with masked sensitive fields."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    config = await db_client.get_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.TELEPHONY_CONFIGURATION.value,
    )

    if not config or not config.value:
        return TelephonyConfigurationResponse()

    stored_provider = config.value.get("provider", "twilio")

    if stored_provider == "twilio":
        account_sid = config.value.get("account_sid", "")
        auth_token = config.value.get("auth_token", "")
        from_numbers = (
            config.value.get("from_numbers", []) if account_sid and auth_token else []
        )

        return TelephonyConfigurationResponse(
            twilio=TwilioConfigurationResponse(
                provider="twilio",
                account_sid=mask_key(account_sid) if account_sid else "",
                auth_token=mask_key(auth_token) if auth_token else "",
                from_numbers=from_numbers,
            ),
            vonage=None,
            vobiz=None,
            cloudonix=None,
        )
    elif stored_provider == "vonage":
        application_id = config.value.get("application_id", "")
        private_key = config.value.get("private_key", "")
        api_key = config.value.get("api_key", "")
        api_secret = config.value.get("api_secret", "")
        from_numbers = (
            config.value.get("from_numbers", [])
            if application_id and private_key
            else []
        )

        return TelephonyConfigurationResponse(
            twilio=None,
            vonage=VonageConfigurationResponse(
                provider="vonage",
                application_id=application_id,
                private_key=mask_key(private_key) if private_key else "",
                api_key=mask_key(api_key) if api_key else None,
                api_secret=mask_key(api_secret) if api_secret else None,
                from_numbers=from_numbers,
            ),
            vobiz=None,
            cloudonix=None,
        )
    elif stored_provider == "vobiz":
        auth_id = config.value.get("auth_id", "")
        auth_token = config.value.get("auth_token", "")
        from_numbers = (
            config.value.get("from_numbers", []) if auth_id and auth_token else []
        )

        return TelephonyConfigurationResponse(
            twilio=None,
            vonage=None,
            vobiz=VobizConfigurationResponse(
                provider="vobiz",
                auth_id=mask_key(auth_id) if auth_id else "",
                auth_token=mask_key(auth_token) if auth_token else "",
                from_numbers=from_numbers,
            ),
            cloudonix=None,
        )
    elif stored_provider == "cloudonix":
        bearer_token = config.value.get("bearer_token", "")
        domain_id = config.value.get("domain_id", "")
        from_numbers = config.value.get("from_numbers", [])

        return TelephonyConfigurationResponse(
            twilio=None,
            vonage=None,
            cloudonix=CloudonixConfigurationResponse(
                provider="cloudonix",
                bearer_token=mask_key(bearer_token) if bearer_token else "",
                domain_id=domain_id,
                from_numbers=from_numbers,
            ),
            vobiz=None,
        )
    elif stored_provider == "ari":
        ari_endpoint = config.value.get("ari_endpoint", "")
        app_name = config.value.get("app_name", "")
        app_password = config.value.get("app_password", "")
        ws_client_name = config.value.get("ws_client_name", "")
        from_numbers = config.value.get("from_numbers", [])

        inbound_workflow_id = config.value.get("inbound_workflow_id")

        return TelephonyConfigurationResponse(
            ari=ARIConfigurationResponse(
                provider="ari",
                ari_endpoint=ari_endpoint,
                app_name=app_name,
                app_password=mask_key(app_password) if app_password else "",
                ws_client_name=ws_client_name,
                inbound_workflow_id=inbound_workflow_id,
                from_numbers=from_numbers,
            ),
        )
    elif stored_provider == "telnyx":
        api_key = config.value.get("api_key", "")
        connection_id = config.value.get("connection_id", "")
        from_numbers = config.value.get("from_numbers", [])

        return TelephonyConfigurationResponse(
            telnyx=TelnyxConfigurationResponse(
                provider="telnyx",
                api_key=mask_key(api_key) if api_key else "",
                connection_id=connection_id,
                from_numbers=from_numbers,
            ),
        )
    else:
        return TelephonyConfigurationResponse()


@router.post("/telephony-config")
async def save_telephony_configuration(
    request: Union[
        TwilioConfigurationRequest,
        VonageConfigurationRequest,
        VobizConfigurationRequest,
        CloudonixConfigurationRequest,
        ARIConfigurationRequest,
        TelnyxConfigurationRequest,
    ],
    user: UserModel = Depends(get_user),
):
    """Save telephony configuration for the user's organization."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    # Fetch existing configuration to handle masked values
    existing_config = await db_client.get_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.TELEPHONY_CONFIGURATION.value,
    )

    # Build single-provider configuration
    if request.provider == "twilio":
        config_value = {
            "provider": "twilio",
            "account_sid": request.account_sid,
            "auth_token": request.auth_token,
            "from_numbers": request.from_numbers,
        }
    elif request.provider == "vonage":
        config_value = {
            "provider": "vonage",
            "application_id": request.application_id,
            "private_key": request.private_key,
            "api_key": getattr(request, "api_key", None),
            "api_secret": getattr(request, "api_secret", None),
            "from_numbers": request.from_numbers,
        }
    elif request.provider == "vobiz":
        config_value = {
            "provider": "vobiz",
            "auth_id": request.auth_id,
            "auth_token": request.auth_token,
            "from_numbers": request.from_numbers,
        }
    elif request.provider == "cloudonix":
        config_value = {
            "provider": "cloudonix",
            "bearer_token": request.bearer_token,
            "domain_id": request.domain_id,
            "from_numbers": request.from_numbers,
        }
    elif request.provider == "telnyx":
        config_value = {
            "provider": "telnyx",
            "api_key": request.api_key,
            "connection_id": request.connection_id,
            "from_numbers": request.from_numbers,
        }
    elif request.provider == "ari":
        config_value = {
            "provider": "ari",
            "ari_endpoint": request.ari_endpoint,
            "app_name": request.app_name,
            "app_password": request.app_password,
            "ws_client_name": request.ws_client_name,
            "inbound_workflow_id": request.inbound_workflow_id,
            "from_numbers": request.from_numbers,
        }
    else:
        raise HTTPException(
            status_code=400, detail=f"Unsupported provider: {request.provider}"
        )

    if existing_config and existing_config.value:
        existing_provider = existing_config.value.get("provider")

        if existing_provider == request.provider:
            preserve_masked_fields(request, existing_config, config_value)

    await db_client.upsert_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.TELEPHONY_CONFIGURATION.value,
        config_value,
    )

    capture_event(
        distinct_id=str(user.provider_id),
        event=PostHogEvent.TELEPHONY_CONFIGURED,
        properties={
            "provider": request.provider,
            "phone_number_count": len(request.from_numbers),
            "organization_id": user.selected_organization_id,
        },
    )

    return {"message": "Telephony configuration saved successfully"}


def preserve_masked_fields(request, existing_config, config_value):
    provider = request.provider
    masked_fields = PROVIDER_MASKED_FIELDS.get(provider, [])

    for field_name in masked_fields:
        if hasattr(request, field_name):
            field_value = getattr(request, field_name)
            # Check if field has a value and is a masked version of the existing value
            if field_value and is_mask_of(
                field_value, existing_config.value.get(field_name, "")
            ):
                config_value[field_name] = existing_config.value[field_name]


class LangfuseCredentialsRequest(BaseModel):
    host: str
    public_key: str
    secret_key: str


class LangfuseCredentialsResponse(BaseModel):
    host: str = ""
    public_key: str = ""
    secret_key: str = ""
    configured: bool = False


@router.get("/langfuse-credentials", response_model=LangfuseCredentialsResponse)
async def get_langfuse_credentials(user: UserModel = Depends(get_user)):
    """Get Langfuse credentials for the user's organization with masked sensitive fields."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    config = await db_client.get_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.LANGFUSE_CREDENTIALS.value,
    )

    if not config or not config.value:
        return LangfuseCredentialsResponse()

    return LangfuseCredentialsResponse(
        host=config.value.get("host", ""),
        public_key=mask_key(config.value.get("public_key", "")),
        secret_key=mask_key(config.value.get("secret_key", "")),
        configured=True,
    )


@router.post("/langfuse-credentials")
async def save_langfuse_credentials(
    request: LangfuseCredentialsRequest,
    user: UserModel = Depends(get_user),
):
    """Save Langfuse credentials for the user's organization."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    existing_config = await db_client.get_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.LANGFUSE_CREDENTIALS.value,
    )

    config_value = {
        "host": request.host,
        "public_key": request.public_key,
        "secret_key": request.secret_key,
    }

    # Preserve masked fields
    if existing_config and existing_config.value:
        if is_mask_of(request.public_key, existing_config.value.get("public_key", "")):
            config_value["public_key"] = existing_config.value["public_key"]
        if is_mask_of(request.secret_key, existing_config.value.get("secret_key", "")):
            config_value["secret_key"] = existing_config.value["secret_key"]

    await db_client.upsert_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.LANGFUSE_CREDENTIALS.value,
        config_value,
    )

    # Broadcast to all workers so every process updates its in-memory exporter
    await get_worker_sync_manager().broadcast(
        WorkerSyncEventType.LANGFUSE_CREDENTIALS,
        action="update",
        org_id=user.selected_organization_id,
    )

    return {"message": "Langfuse credentials saved successfully"}


@router.delete("/langfuse-credentials")
async def delete_langfuse_credentials(user: UserModel = Depends(get_user)):
    """Delete Langfuse credentials for the user's organization."""
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    deleted = await db_client.delete_configuration(
        user.selected_organization_id,
        OrganizationConfigurationKey.LANGFUSE_CREDENTIALS.value,
    )

    if not deleted:
        raise HTTPException(status_code=404, detail="No Langfuse credentials found")

    # Broadcast to all workers so every process removes its in-memory exporter
    await get_worker_sync_manager().broadcast(
        WorkerSyncEventType.LANGFUSE_CREDENTIALS,
        action="delete",
        org_id=user.selected_organization_id,
    )

    return {"message": "Langfuse credentials deleted successfully"}


class RetryConfigResponse(BaseModel):
    enabled: bool
    max_retries: int
    retry_delay_seconds: int
    retry_on_busy: bool
    retry_on_no_answer: bool
    retry_on_voicemail: bool


class TimeSlotResponse(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str


class ScheduleConfigResponse(BaseModel):
    enabled: bool
    timezone: str
    slots: List[TimeSlotResponse]


class CircuitBreakerConfigResponse(BaseModel):
    enabled: bool = False
    failure_threshold: float = 0.5
    window_seconds: int = 120
    min_calls_in_window: int = 5


class LastCampaignSettingsResponse(BaseModel):
    retry_config: Optional[RetryConfigResponse] = None
    max_concurrency: Optional[int] = None
    schedule_config: Optional[ScheduleConfigResponse] = None
    circuit_breaker: Optional[CircuitBreakerConfigResponse] = None


class CampaignDefaultsResponse(BaseModel):
    concurrent_call_limit: int
    from_numbers_count: int
    default_retry_config: RetryConfigResponse
    last_campaign_settings: Optional[LastCampaignSettingsResponse] = None


@router.get("/campaign-defaults", response_model=CampaignDefaultsResponse)
async def get_campaign_defaults(user: UserModel = Depends(get_user)):
    """Get campaign limits for the user's organization.

    Returns the organization's concurrent call limit and default retry configuration.
    """
    if not user.selected_organization_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    # Get concurrent call limit
    concurrent_limit = DEFAULT_ORG_CONCURRENCY_LIMIT
    try:
        config = await db_client.get_configuration(
            user.selected_organization_id,
            OrganizationConfigurationKey.CONCURRENT_CALL_LIMIT.value,
        )
        if config and config.value:
            concurrent_limit = int(
                config.value.get("value", DEFAULT_ORG_CONCURRENCY_LIMIT)
            )
    except Exception:
        pass

    # Get from_numbers count from telephony configuration
    from_numbers_count = 0
    try:
        telephony_config = await db_client.get_configuration(
            user.selected_organization_id,
            OrganizationConfigurationKey.TELEPHONY_CONFIGURATION.value,
        )
        if telephony_config and telephony_config.value:
            from_numbers = telephony_config.value.get("from_numbers", [])
            from_numbers_count = len(from_numbers)
    except Exception:
        pass

    # Get last campaign settings for pre-population
    last_campaign_settings = None
    try:
        last_campaign = await db_client.get_latest_campaign(
            user.selected_organization_id
        )
        if last_campaign:
            retry = None
            if last_campaign.retry_config:
                retry = RetryConfigResponse(**last_campaign.retry_config)

            max_conc = None
            sched = None
            cb = CircuitBreakerConfigResponse()
            if last_campaign.orchestrator_metadata:
                max_conc = last_campaign.orchestrator_metadata.get("max_concurrency")
                sc = last_campaign.orchestrator_metadata.get("schedule_config")
                if sc:
                    sched = ScheduleConfigResponse(
                        enabled=sc.get("enabled", False),
                        timezone=sc.get("timezone", "UTC"),
                        slots=[
                            TimeSlotResponse(**slot) for slot in sc.get("slots", [])
                        ],
                    )
                cb_data = last_campaign.orchestrator_metadata.get("circuit_breaker")
                if cb_data:
                    cb = CircuitBreakerConfigResponse(**cb_data)
                else:
                    cb = CircuitBreakerConfigResponse()

            last_campaign_settings = LastCampaignSettingsResponse(
                retry_config=retry,
                max_concurrency=max_conc,
                schedule_config=sched,
                circuit_breaker=cb,
            )
    except Exception:
        pass

    return CampaignDefaultsResponse(
        concurrent_call_limit=concurrent_limit,
        from_numbers_count=from_numbers_count,
        default_retry_config=RetryConfigResponse(**DEFAULT_CAMPAIGN_RETRY_CONFIG),
        last_campaign_settings=last_campaign_settings,
    )
