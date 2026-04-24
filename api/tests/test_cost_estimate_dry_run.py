"""WE-01-HEADER: dry-run cost estimate from graph + user model config."""

import json
from pathlib import Path

import pytest

from api.schemas.user_configuration import UserConfiguration
from api.services.configuration.registry import (
    DeepgramSTTConfiguration,
    OpenAILLMService,
    OpenAITTSService,
)
from api.services.workflow.cost_estimate_dry_run import (
    MAX_TURNS,
    MIN_TURNS,
    estimate_workflow_cost_dry_run,
)


@pytest.fixture
def voice_user_config() -> UserConfiguration:
    key = "sk-test-dry-run"
    return UserConfiguration(
        llm=OpenAILLMService(api_key=key),
        stt=DeepgramSTTConfiguration(api_key=key),
        tts=OpenAITTSService(api_key=key),
    )


def test_dry_run_returns_non_negative_estimate(voice_user_config: UserConfiguration):
    rf1 = Path(__file__).resolve().parent / "definitions" / "rf-1.json"
    with open(rf1, encoding="utf-8") as f:
        workflow_json = json.load(f)

    result = estimate_workflow_cost_dry_run(
        workflow_json=workflow_json,
        workflow_configurations=None,
        user_config=voice_user_config,
    )

    assert result.estimated_total_cost_usd >= 0
    assert result.estimated_dograh_tokens >= 0
    assert result.main_agent_nodes >= 1
    assert MIN_TURNS <= result.estimated_turns <= MAX_TURNS
