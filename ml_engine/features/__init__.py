"""
SENTINEL feature-engineering package.

The canonical feature-column definitions are safe to import in lightweight
contexts such as model-governance validation and Docker build preflight.

EventFeatureBuilder is loaded lazily because its operational implementation
depends on backend runtime services and configuration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ml_engine.features.feature_sets import (
    V1_FEATURE_COLUMNS,
    V2_FEATURE_COLUMNS,
)

if TYPE_CHECKING:
    from ml_engine.features.event_features import (
        EventFeatureBuilder as EventFeatureBuilder,
    )


def __getattr__(
    name: str,
):
    if name == "EventFeatureBuilder":
        from ml_engine.features.event_features import (
            EventFeatureBuilder,
        )

        return EventFeatureBuilder

    raise AttributeError(
        f"module {__name__!r} has no attribute {name!r}"
    )


__all__ = [
    "EventFeatureBuilder",
    "V1_FEATURE_COLUMNS",
    "V2_FEATURE_COLUMNS",
]
