"""
Unit tests for SENTINEL's incident-scoped AI chat prompt builder.

These tests protect the contract between AIEvidenceBuilder and the
smaller prompt representation used for interactive chat.
"""

from __future__ import annotations

import json

import pytest

from app.schemas.ai_chat import (
    AIChatHistoryMessage,
)

from app.services.ai_chat_prompt_builder import (
    build_ai_chat_prompt,
)


# ============================================================
# Helpers
# ============================================================


def _real_evidence_shape() -> dict:
    """
    Match the actual top-level structure returned by AIEvidenceBuilder.
    """

    return {
        "evidence_version":
            "1.0",

        "incident": {
            "incident_id":
                "INC-CHAT-001",

            "incident_type":
                "POTENTIAL_ACCOUNT_COMPROMISE",

            "severity":
                "CRITICAL",

            "first_seen":
                "2026-09-22T20:00:00+00:00",

            "last_seen":
                "2026-09-22T20:05:00+00:00",

            "event_count":
                5,

            "anomaly_count":
                5,

            "maximum_anomaly_percentile":
                0.997,

            "summary":
                "Suspicious authentication sequence.",

            "correlation_reason":
                "Repeated failures with suspicious follow-on activity.",

            "indicators": [
                "Repeated login failures",
            ],
        },

        "identity_context": {
            "user_id":
                "integration_user_001",

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
            "engine":
                "multi-signal-rules",

            "version":
                "1.0",

            "detector_name":
                "isolation-forest",

            "detector_version":
                "1.2",

            "signals": {
                "login_failures":
                    3,

                "login_successes":
                    1,

                "critical_events":
                    2,
            },
        },

        "deterministic_investigation": {
            "engine":
                "deterministic-investigation",

            "version":
                "1.0",

            "severity_rationale":
                "Multiple strong authentication indicators.",

            "key_findings": [
                {
                    "finding":
                        "Repeated login failures",

                    "value":
                        3,

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

        "timeline": [
            {
                "sequence_number":
                    1,

                "timestamp":
                    "2026-09-22T20:00:00+00:00",

                "event_type":
                    "LOGIN_FAILURE",

                "employee_user_id":
                    "integration_user_001",

                "source_ip":
                    "203.0.113.10",

                "destination_ip":
                    "10.40.5.20",

                "resource_type":
                    "authentication",

                "resource_name":
                    "corporate-sso",

                "bytes_sent":
                    0,

                "success":
                    False,

                "anomaly_percentile":
                    0.997,

                "risk_level":
                    "CRITICAL",
            },
        ],
    }


# ============================================================
# Real evidence contract regression
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_prompt_preserves_real_correlation_and_investigation_evidence() -> None:
    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message=(
            "Why was this incident flagged?"
        ),
        history=[],
    )

    prompt = bundle.user_prompt

    # The real AIEvidenceBuilder stores signals under correlation.
    assert (
        '"login_failures": 3'
        in prompt
    )

    assert (
        '"critical_events": 2'
        in prompt
    )

    # The real AIEvidenceBuilder stores investigation content under
    # deterministic_investigation.
    assert (
        "Repeated login failures"
        in prompt
    )

    assert (
        "Validate account activity"
        in prompt
    )

    assert (
        "Consider session revocation"
        in prompt
    )


# ============================================================
# System grounding contract
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_system_prompt_enforces_incident_scope_and_uncertainty() -> None:
    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message="What happened?",
        history=[],
    )

    system_prompt = (
        bundle
        .system_prompt
        .lower()
    )

    assert (
        "not a general-purpose chatbot"
        in system_prompt
    )

    assert (
        "use only information explicitly supplied"
        in system_prompt
    )

    assert (
        "not an attack probability"
        in system_prompt
    )

    assert (
        "never infer simulator scenarios"
        in system_prompt
    )

    assert (
        "previous assistant messages are not new evidence"
        in system_prompt
    )

    assert (
        "containment guidance must remain conditional"
        in system_prompt
    )


# ============================================================
# Empty history
# ============================================================


@pytest.mark.unit
def test_chat_prompt_explicitly_represents_empty_history() -> None:
    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message="What IP address was involved?",
        history=[],
    )

    assert (
        "=== RECENT CHAT HISTORY ==="
        in bundle.user_prompt
    )

    assert (
        "No previous chat messages."
        in bundle.user_prompt
    )

    assert (
        "=== CURRENT ANALYST QUESTION ==="
        in bundle.user_prompt
    )

    assert (
        "What IP address was involved?"
        in bundle.user_prompt
    )


# ============================================================
# History defense in depth
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_history_keeps_only_final_six_messages() -> None:
    history = [
        AIChatHistoryMessage(
            role=(
                "user"
                if index % 2 == 0
                else "assistant"
            ),
            content=(
                f"history-message-{index}"
            ),
        )
        for index in range(
            1,
            9,
        )
    ]

    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message="Summarize the relevant evidence.",
        history=history,
    )

    prompt = bundle.user_prompt

    # Eight supplied messages -> only final six survive.
    assert (
        "history-message-1"
        not in prompt
    )

    assert (
        "history-message-2"
        not in prompt
    )

    for index in range(
        3,
        9,
    ):
        assert (
            f"history-message-{index}"
            in prompt
        )

    # Role labels must remain clear.
    assert (
        "ANALYST:"
        in prompt
    )

    assert (
        "AI ASSISTANT:"
        in prompt
    )

    assert (
        "History is conversational context only."
        in prompt
    )


# ============================================================
# Timeline compaction
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_evidence_limits_timeline_to_first_sixteen_events() -> None:
    evidence = (
        _real_evidence_shape()
    )

    evidence[
        "timeline"
    ] = [
        {
            "sequence_number":
                index,

            "timestamp":
                (
                    "2026-09-22T"
                    f"{index % 24:02d}:00:00+00:00"
                ),

            "event_type":
                "LOGIN_FAILURE",

            "employee_user_id":
                "integration_user_001",

            "source_ip":
                f"203.0.113.{index}",

            "destination_ip":
                "10.40.5.20",

            "resource_type":
                "authentication",

            "resource_name":
                f"resource-{index}",

            "bytes_sent":
                index * 100,

            "success":
                False,

            "anomaly_percentile":
                0.900 + (
                    index / 1000
                ),

            "risk_level":
                "HIGH",
        }
        for index in range(
            1,
            21,
        )
    ]

    bundle = build_ai_chat_prompt(
        evidence=evidence,
        message="What happened in the timeline?",
        history=[],
    )

    prompt = bundle.user_prompt

    for index in range(
        1,
        17,
    ):
        assert (
            f'"resource_name": "resource-{index}"'
            in prompt
        )

    for index in range(
        17,
        21,
    ):
        assert (
            f'"resource_name": "resource-{index}"'
            not in prompt
        )


# ============================================================
# Explicit compact evidence whitelist
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_compaction_does_not_copy_unapproved_timeline_fields() -> None:
    evidence = (
        _real_evidence_shape()
    )

    evidence[
        "timeline"
    ][0][
        "correlation_reason"
    ] = (
        "internal-correlation-detail"
    )

    evidence[
        "timeline"
    ][0][
        "event_metadata"
    ] = {
        "secret":
            "SHOULD-NOT-ENTER-CHAT"
    }

    evidence[
        "timeline"
    ][0][
        "private_test_field"
    ] = (
        "PRIVATE-VALUE"
    )

    bundle = build_ai_chat_prompt(
        evidence=evidence,
        message="Explain this event.",
        history=[],
    )

    prompt = bundle.user_prompt

    assert (
        "SHOULD-NOT-ENTER-CHAT"
        not in prompt
    )

    assert (
        "PRIVATE-VALUE"
        not in prompt
    )

    assert (
        "internal-correlation-detail"
        not in prompt
    )

    # Approved event evidence is still present.
    assert (
        "203.0.113.10"
        in prompt
    )

    assert (
        "corporate-sso"
        in prompt
    )


# ============================================================
# Output classification contract
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_prompt_contains_complete_response_classification_contract() -> None:
    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message=(
            "Was this definitely malicious?"
        ),
        history=[],
    )

    system_prompt = (
        bundle.system_prompt
    )

    user_prompt = (
        bundle.user_prompt
    )

    for response_type in [
        "ANSWER",
        "INVALID_QUESTION",
        "OUT_OF_SCOPE",
        "INSUFFICIENT_EVIDENCE",
    ]:
        assert (
            response_type
            in system_prompt
        )

        assert (
            response_type
            in user_prompt
        )

    assert (
        "Return exactly ONE valid JSON object."
        in user_prompt
    )

    assert (
        '"response_type": "ANSWER"'
        in user_prompt
    )

    assert (
        '"answer": "Your response here."'
        in user_prompt
    )

    assert (
        "Do not include markdown."
        in user_prompt
    )

    assert (
        'keep "answer" under 60 words'
        in user_prompt
    )


# ============================================================
# Canonical response language
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_chat_system_prompt_embeds_canonical_non_answer_responses() -> None:
    from app.services.ai_chat_prompt_builder import (
        INSUFFICIENT_EVIDENCE_RESPONSE,
        INVALID_QUESTION_RESPONSE,
        OUT_OF_SCOPE_RESPONSE,
    )

    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message="Explain this incident.",
        history=[],
    )

    assert (
        INVALID_QUESTION_RESPONSE
        in bundle.system_prompt
    )

    assert (
        OUT_OF_SCOPE_RESPONSE
        in bundle.system_prompt
    )

    assert (
        INSUFFICIENT_EVIDENCE_RESPONSE
        in bundle.system_prompt
    )


# ============================================================
# Bundle contract
# ============================================================


@pytest.mark.unit
def test_chat_prompt_bundle_has_expected_version_and_sections() -> None:
    bundle = build_ai_chat_prompt(
        evidence=_real_evidence_shape(),
        message="Why was this incident flagged?",
        history=[],
    )

    assert (
        bundle.prompt_version
        == "1.0"
    )

    assert (
        "=== SELECTED INCIDENT EVIDENCE ==="
        in bundle.user_prompt
    )

    assert (
        "=== RECENT CHAT HISTORY ==="
        in bundle.user_prompt
    )

    assert (
        "=== CURRENT ANALYST QUESTION ==="
        in bundle.user_prompt
    )

    assert (
        "=== REQUIRED OUTPUT ==="
        in bundle.user_prompt
    )
