"""Unit tests: normalize_analytics_dashboard_layout."""

import pytest

from api.services.analytics.dashboard_layout_validate import normalize_analytics_dashboard_layout


def test_normalize_ok_minimal():
    out = normalize_analytics_dashboard_layout(
        {"v": 1, "widgets": [{"id": " w1 ", "type": "kpi_row"}]}
    )
    assert out == {"v": 1, "widgets": [{"id": "w1", "type": "kpi_row"}]}


@pytest.mark.parametrize(
    "raw,msg",
    [
        ("not-a-dict", "layout must be an object"),
        ({}, "layout.v must be 1"),
        ({"v": 1}, "layout.widgets must be a non-empty array"),
        ({"v": 1, "widgets": []}, "layout.widgets must be a non-empty array"),
        (
            {"v": 1, "widgets": [{"id": "x", "type": "unknown_widget"}]},
            "layout.widgets must contain at least one valid widget",
        ),
    ],
)
def test_normalize_raises(raw, msg):
    with pytest.raises(ValueError, match=msg):
        normalize_analytics_dashboard_layout(raw)
