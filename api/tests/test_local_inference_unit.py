"""Local inference capability scan and model matching."""

from unittest.mock import AsyncMock, patch

import pytest

from api.services.configuration.local_inference import (
    _ollama_model_satisfied,
    scan_local_inference_capabilities,
)


def test_ollama_model_satisfied_tag_variants():
    assert _ollama_model_satisfied("llama3.2:3b", ["llama3.2:3b"])
    assert _ollama_model_satisfied("llama3.2:3b", ["llama3.2:latest"])
    assert not _ollama_model_satisfied("llama3.2:3b", ["qwen2.5:3b"])


@pytest.mark.asyncio
async def test_scan_marks_local_stack_ready_when_runtimes_up():
    async def fake_probe(url: str, timeout: float = 2.5) -> bool:
        return "11434" in url or "8100" in url

    with (
        patch(
            "api.services.configuration.local_inference._probe_url",
            new=AsyncMock(side_effect=fake_probe),
        ),
        patch(
            "api.services.configuration.local_inference._fetch_ollama_models",
            new=AsyncMock(return_value=["llama3.2:3b"]),
        ),
        patch("shutil.which", return_value="/usr/bin/fake"),
    ):
        caps = await scan_local_inference_capabilities()
    assert caps["local_stack_ready"] is True
    assert len(caps["components"]) == 2
