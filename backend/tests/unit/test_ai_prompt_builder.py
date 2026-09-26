"""
Unit tests for SENTINEL's grounded AI investigation prompt builder.

These tests protect prompt semantics rather than testing an LLM.

Important guarantees:
- anomaly percentile is not presented as attack probability;
- prompts contain supplied deterministic evidence;
- structured-output instructions remain explicit;
- large timelines are compacted deterministically;
- beginning, highest-anomaly, and ending events survive compaction.
"""

from __future__ import annotations

import pytest

from app.services.ai_prompt_builder import (
    AIPromptBuilder,
)


# ============================================================
# Helpers
# ============================================================


def _event(
    sequence_number: int,
    *,
    anomaly_percentile: float,
) -> dict:
    return {
        "sequence_number":
            sequence_number,

        "timestamp":
            (
                "2026-09-22T"
                f"{sequence_number % 24:02d}:00:00+00:00"
            ),

        "event_type":
            "LOGIN_FAILURE",

        "success":
            False,

        "source_ip":
            f"203.0.113.{sequence_number}",

        "destination_ip":
            "10.10.10.10",

        "resource_type":
            "authentication",

        "resource_name":
            "corporate-sso",

        "bytes_sent":
            sequence_number * 100,

        "bytes_received":
            sequence_number * 200,

        "anomaly_percentile":
            anomaly_percentile,

        "risk_level":
            (
                "CRITICAL"
                if anomaly_percentile >= 0.99
                else "HIGH"
            ),
    }


def _package(
    timeline: list[dict],
) -> dict:
    return {
        "incident": {
            "incident_id":
                "INC-PROMPT-001",

            "incident_type":
                "POTENTIAL_ACCOUNT_COMPROMISE",

            "severity":
                "CRITICAL",

            "status":
                "OPEN",

            "first_seen":
                "2026-09-22T01:00:00+00:00",

            "last_seen":
                "2026-09-22T02:00:00+00:00",

            "event_count":
                len(
                    timeline
                ),

            "anomaly_count":
                len(
                    timeline
                ),

            "maximum_anomaly_percentile":
                0.999,

            "summary":
                "Suspicious authentication sequence.",

            "correlation_reason":
                "Repeated failures followed by suspicious activity.",
        },

        "identity_context": {
            "user_id":
                "user_001",

            "department":
                "Engineering",

            "job_role":
                "Platform Engineer",

            "normal_start_hour":
                9,

            "normal_end_hour":
                17,

            "typical_location":
                "Karachi Office",
        },

        "correlation": {
            "signals": {
                "login_failures":
                    4,

                "critical_events":
                    2,
            }
        },

        "deterministic_investigation": {
            "severity_rationale":
                "Multiple strong authentication indicators.",

            "key_findings": [
                {
                    "finding":
                        "Repeated login failures",

                    "value":
                        4,

                    "confidence":
                        "HIGH",
                },
            ],

            "investigation_steps": [
                {
                    "priority":
                        1,

                    "action":
                        "Validate account activity",

                    "reason":
                        "Confirm whether access was authorized.",
                },
            ],

            "analyst_questions": [
                "Was this login expected?",
            ],

            "containment_actions": [
                {
                    "urgency":
                        "HIGH",

                    "action":
                        "Consider session revocation",

                    "condition":
                        "If unauthorized access is confirmed.",
                },
            ],
        },

        "timeline":
            timeline,
    }


# ============================================================
# Grounding contract
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_prompt_states_anomaly_percentile_is_not_attack_probability() -> None:
    bundle = (
        AIPromptBuilder()
        .build(
            _package(
                [
                    _event(
                        1,
                        anomaly_percentile=0.995,
                    )
                ]
            )
        )
    )

    system_text = (
        bundle
        .system_prompt
        .lower()
    )

    assert (
        "not an attack probability"
        in system_text
    )

    assert (
        "use only information explicitly supplied"
        in system_text
    )

    assert (
        "do not infer simulator"
        in system_text
    )


@pytest.mark.unit
@pytest.mark.safety
def test_prompt_contains_supplied_operational_evidence_and_output_contract() -> None:
    bundle = (
        AIPromptBuilder()
        .build(
            _package(
                [
                    _event(
                        1,
                        anomaly_percentile=0.995,
                    )
                ]
            )
        )
    )

    prompt = bundle.user_prompt

    assert (
        "INC-PROMPT-001"
        in prompt
    )

    assert (
        "POTENTIAL_ACCOUNT_COMPROMISE"
        in prompt
    )

    assert (
        "Engineering"
        in prompt
    )

    assert (
        "login_failures: 4"
        in prompt
    )

    assert (
        "Repeated login failures"
        in prompt
    )

    assert (
        "Validate account activity"
        in prompt
    )

    assert (
        "Return exactly ONE valid JSON object"
        in prompt
    )

    assert (
        '"confidence": "LOW | MEDIUM | HIGH"'
        in prompt
    )


# ============================================================
# Normal timeline behavior
# ============================================================


@pytest.mark.unit
def test_small_timeline_is_preserved_without_compaction() -> None:
    timeline = [
        _event(
            index,
            anomaly_percentile=(
                0.90
                + index / 1000
            ),
        )
        for index in range(
            1,
            6,
        )
    ]

    builder = AIPromptBuilder()

    selected = (
        builder
        ._select_timeline_events(
            timeline
        )
    )

    assert selected == timeline


# ============================================================
# Large timeline compaction
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_large_timeline_compaction_preserves_beginning_highest_anomaly_and_end() -> None:
    timeline = [
        _event(
            index,
            anomaly_percentile=(
                0.80
                + index / 1000
            ),
        )
        for index in range(
            1,
            41,
        )
    ]

    # Force several middle events to be the strongest anomalies.
    for sequence_number, score in [
        (12, 0.999),
        (14, 0.998),
        (16, 0.997),
        (18, 0.996),
        (20, 0.995),
        (22, 0.994),
        (24, 0.993),
        (26, 0.992),
    ]:
        timeline[
            sequence_number - 1
        ][
            "anomaly_percentile"
        ] = score

    builder = AIPromptBuilder()

    selected = (
        builder
        ._select_timeline_events(
            timeline
        )
    )

    sequences = [
        item[
            "sequence_number"
        ]
        for item in selected
    ]

    # Beginning survives.
    for sequence_number in range(
        1,
        9,
    ):
        assert (
            sequence_number
            in sequences
        )

    # Highest-anomaly middle events survive.
    for sequence_number in [
        12,
        14,
        16,
        18,
        20,
        22,
        24,
        26,
    ]:
        assert (
            sequence_number
            in sequences
        )

    # Ending survives.
    for sequence_number in range(
        33,
        41,
    ):
        assert (
            sequence_number
            in sequences
        )

    assert sequences == sorted(
        sequences
    )

    assert len(
        selected
    ) <= 24


@pytest.mark.unit
@pytest.mark.safety
def test_build_reports_full_and_compacted_timeline_counts() -> None:
    timeline = [
        _event(
            index,
            anomaly_percentile=(
                0.90
                + index / 1000
            ),
        )
        for index in range(
            1,
            41,
        )
    ]

    bundle = (
        AIPromptBuilder()
        .build(
            _package(
                timeline
            )
        )
    )

    assert (
        bundle.prompt_version
        == "1.0"
    )

    assert (
        bundle.total_timeline_events
        == 40
    )

    assert (
        bundle.included_timeline_events
        <= 24
    )

    assert (
        "Events in complete incident: 40"
        in bundle.user_prompt
    )

    assert (
        "timeline was compacted"
        in bundle.user_prompt
    )
