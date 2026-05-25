"""MK-01 depth: voice profile preview scripts and catalog voice-preview route."""

from __future__ import annotations

import pytest

from api.routes.catalog import get_vertical_pack_voice_preview
from api.services.voice.profile_preview import (
    build_catalog_voice_preview,
    preview_script_for_catalog_slug,
)
from api.services.voice.presets import get_builtin_profile


def test_preview_script_for_telecom_catalog_slug():
    script = preview_script_for_catalog_slug("telecom-utilities-outage-faq")
    assert "outage" in script.lower()
    assert len(script) >= 20


def test_build_catalog_voice_preview_telecom():
    profile = get_builtin_profile("builtin:vertical_telecom")
    assert profile is not None
    data = build_catalog_voice_preview("telecom-utilities-outage-faq", profile)
    assert data["profile_id"] == "builtin:vertical_telecom"
    assert data["recommended_voice_profile_id"] == "builtin:vertical_telecom"
    assert data["speech_settings"]["tone"] == "formal"


@pytest.mark.asyncio
async def test_catalog_voice_preview_handler_healthcare():
    result = await get_vertical_pack_voice_preview("healthcare-clinic-screening")
    assert result.catalog_slug == "healthcare-clinic-screening"
    assert result.profile_id == "builtin:vertical_healthcare"
    assert len(result.script) >= 10


@pytest.mark.asyncio
async def test_catalog_voice_preview_handler_includes_hosted_audio_url():
    result = await get_vertical_pack_voice_preview("healthcare-clinic-screening")
    assert result.preview_audio_url
    assert "voice-preview/audio" in result.preview_audio_url


@pytest.mark.asyncio
async def test_catalog_voice_preview_audio_route_serves_wav():
    from api.routes.catalog import get_vertical_pack_voice_preview_audio

    response = await get_vertical_pack_voice_preview_audio("healthcare-clinic-screening")
    assert response.media_type == "audio/wav"


@pytest.mark.asyncio
async def test_catalog_voice_preview_handler_unknown_slug():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await get_vertical_pack_voice_preview("not-a-pack")
    assert exc.value.status_code == 404
