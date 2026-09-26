"""
Unit tests for SENTINEL AI evidence leakage protection.

These tests exercise the final recursive safety guard that runs before
operational evidence can be supplied to the optional local language model.

No database or Ollama provider is required.
"""

from __future__ import annotations

import pytest

from app.services.ai_evidence import (
    AIEvidenceBuilder,
    FORBIDDEN_GROUND_TRUTH_KEYS,
    GroundTruthLeakageError,
)


# ============================================================
# Policy contract
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_forbidden_ground_truth_policy_contains_expected_keys() -> None:
    assert FORBIDDEN_GROUND_TRUTH_KEYS == {
        "is_injected_anomaly",
        "scenario_type",
        "simulation_batch",
    }


# ============================================================
# Safe evidence
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_ground_truth_guard_accepts_safe_operational_evidence() -> None:
    safe_evidence = {
        "incident": {
            "incident_id": "INC-001",
            "severity": "HIGH",
        },
        "identity_context": {
            "user_id": "USR-001",
            "department": "Finance",
        },
        "correlation": {
            "signals": {
                "failed_logins_10m": 4,
                "unique_destinations_5m": 2,
            }
        },
        "timeline": [
            {
                "sequence_number": 1,
                "event_id": "EVT-001",
                "anomaly_percentile": 0.991,
            },
            {
                "sequence_number": 2,
                "event_id": "EVT-002",
                "risk_level": "HIGH",
            },
        ],
    }

    assert (
        AIEvidenceBuilder
        ._assert_no_ground_truth(
            safe_evidence
        )
        is None
    )


# ============================================================
# Top-level leakage
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
@pytest.mark.parametrize(
    "forbidden_key",
    sorted(
        FORBIDDEN_GROUND_TRUTH_KEYS
    ),
)
def test_ground_truth_guard_rejects_forbidden_top_level_keys(
    forbidden_key: str,
) -> None:
    payload = {
        forbidden_key: "private-value"
    }

    with pytest.raises(
        GroundTruthLeakageError,
        match=(
            "Forbidden ground-truth field"
        ),
    ):
        AIEvidenceBuilder._assert_no_ground_truth(
            payload
        )


# ============================================================
# Nested leakage
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_ground_truth_guard_rejects_nested_dictionary_leakage() -> None:
    payload = {
        "incident": {
            "evidence": {
                "operational": {
                    "scenario_type":
                        "credential_attack"
                }
            }
        }
    }

    with pytest.raises(
        GroundTruthLeakageError,
        match="scenario_type",
    ) as exc_info:
        AIEvidenceBuilder._assert_no_ground_truth(
            payload
        )

    assert (
        "root.incident.evidence.operational"
        in str(
            exc_info.value
        )
    )


@pytest.mark.unit
@pytest.mark.safety
def test_ground_truth_guard_rejects_leakage_inside_list_item() -> None:
    payload = {
        "timeline": [
            {
                "event_id": "EVT-SAFE",
            },
            {
                "event_id": "EVT-PRIVATE",
                "simulation_batch":
                    "benchmark-secret",
            },
        ]
    }

    with pytest.raises(
        GroundTruthLeakageError,
        match="simulation_batch",
    ) as exc_info:
        AIEvidenceBuilder._assert_no_ground_truth(
            payload
        )

    assert (
        "root.timeline[1]"
        in str(
            exc_info.value
        )
    )


@pytest.mark.unit
@pytest.mark.safety
def test_ground_truth_guard_rejects_deeply_nested_list_dictionary_leakage() -> None:
    payload = {
        "outer": [
            {
                "middle": [
                    {
                        "inner": {
                            "is_injected_anomaly":
                                True
                        }
                    }
                ]
            }
        ]
    }

    with pytest.raises(
        GroundTruthLeakageError,
        match="is_injected_anomaly",
    ):
        AIEvidenceBuilder._assert_no_ground_truth(
            payload
        )


# ============================================================
# Key normalization
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
@pytest.mark.parametrize(
    "variant",
    [
        "SCENARIO_TYPE",
        " Scenario_Type ",
        "SIMULATION_BATCH",
        " Is_Injected_Anomaly ",
    ],
)
def test_ground_truth_guard_normalizes_key_case_and_whitespace(
    variant: str,
) -> None:
    payload = {
        variant: "private"
    }

    with pytest.raises(
        GroundTruthLeakageError,
        match=(
            "Forbidden ground-truth field"
        ),
    ):
        AIEvidenceBuilder._assert_no_ground_truth(
            payload
        )


# ============================================================
# Values are not confused with field names
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_ground_truth_guard_checks_keys_not_innocent_string_values() -> None:
    """
    The policy blocks private field names.

    An ordinary operational text value merely containing the same words
    must not be treated as a structural ground-truth leak.
    """

    payload = {
        "analyst_note": (
            "Do not infer scenario_type "
            "from operational evidence."
        ),
        "timeline": [
            {
                "correlation_reason": (
                    "simulation_batch is not "
                    "available to inference."
                )
            }
        ],
    }

    assert (
        AIEvidenceBuilder
        ._assert_no_ground_truth(
            payload
        )
        is None
    )


# ============================================================
# Non-container terminal values
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
@pytest.mark.parametrize(
    "value",
    [
        None,
        True,
        False,
        0,
        0.991,
        "safe",
    ],
)
def test_ground_truth_guard_handles_terminal_values_safely(
    value,
) -> None:
    assert (
        AIEvidenceBuilder
        ._assert_no_ground_truth(
            value
        )
        is None
    )
