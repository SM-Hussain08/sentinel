"""
Unit tests for SENTINEL's incident-scoped AI chat orchestration.

These tests isolate AIChatService from PostgreSQL and the real Ollama
provider so we can verify orchestration and bypass behavior precisely.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace

import pytest

import app.services.ai_chat_service as chat_service_module

from app.schemas.ai_chat import (
    AIIncidentChatContent,
    AIIncidentChatRequest,
)

from app.services.ai_chat_service import (
    AIChatService,
)

from app.services.ollama_service import (
    OllamaChatGenerationResult,
    OllamaUnavailableError,
)


# ============================================================
# Test doubles
# ============================================================


@dataclass
class FakeEvidencePackage:
    incident: dict
    timeline: list


class RecordingEvidenceBuilder:
    def __init__(
        self,
        package: FakeEvidencePackage,
    ) -> None:
        self.package = package
        self.calls: list[str] = []

    def build(
        self,
        incident_id: str,
    ) -> FakeEvidencePackage:
        self.calls.append(
            incident_id
        )

        return self.package


class RecordingOllama:
    def __init__(
        self,
    ) -> None:
        self.model = "llama3.2:3b"
        self.calls = []

        self.result = (
            OllamaChatGenerationResult(
                content=(
                    AIIncidentChatContent(
                        response_type="ANSWER",
                        answer=(
                            "The supplied evidence shows "
                            "unusual authentication activity."
                        ),
                    )
                ),
                generation_duration_ms=12,
                model="llama3.2:3b",
                prompt_eval_count=50,
                eval_count=20,
                total_duration_ns=1_000_000,
            )
        )

    def generate_chat(
        self,
        prompt_bundle,
    ) -> OllamaChatGenerationResult:
        self.calls.append(
            prompt_bundle
        )

        return self.result


def _service() -> AIChatService:
    """
    AIChatService only stores the DB object during construction.

    The evidence and Ollama collaborators are replaced immediately.
    """

    return AIChatService(
        db=object()
    )


# ============================================================
# Invalid input bypass
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_invalid_question_bypasses_evidence_and_ollama(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()

    evidence = RecordingEvidenceBuilder(
        FakeEvidencePackage(
            incident={},
            timeline=[],
        )
    )

    ollama = RecordingOllama()

    service.evidence_builder = evidence
    service.ollama = ollama

    monkeypatch.setattr(
        chat_service_module,
        "validate_ai_chat_message",
        lambda message: SimpleNamespace(
            is_valid=False,
            normalized_message="",
            response_message=(
                "Please ask a clear question "
                "about this incident."
            ),
        ),
    )

    response = service.chat(
        incident_id="INC-TEST-001",
        request=AIIncidentChatRequest(
            message="???"
        ),
    )

    assert (
        response.content.response_type
        == "INVALID_QUESTION"
    )

    assert (
        response.content.answer
        == (
            "Please ask a clear question "
            "about this incident."
        )
    )

    assert (
        response.generation_duration_ms
        == 0
    )

    assert (
        response.grounded_on_deterministic_evidence
        is True
    )

    assert evidence.calls == []
    assert ollama.calls == []


# ============================================================
# Deterministic conversational bypass
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_deterministic_guard_response_bypasses_evidence_and_ollama(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()

    evidence = RecordingEvidenceBuilder(
        FakeEvidencePackage(
            incident={},
            timeline=[],
        )
    )

    ollama = RecordingOllama()

    service.evidence_builder = evidence
    service.ollama = ollama

    deterministic_message = (
        "I can help explain this incident's "
        "evidence, timeline, and investigation."
    )

    monkeypatch.setattr(
        chat_service_module,
        "validate_ai_chat_message",
        lambda message: SimpleNamespace(
            is_valid=True,
            normalized_message="hello",
            response_message=(
                deterministic_message
            ),
        ),
    )

    response = service.chat(
        incident_id="INC-TEST-002",
        request=AIIncidentChatRequest(
            message="hello"
        ),
    )

    assert (
        response.content.response_type
        == "ANSWER"
    )

    assert (
        response.content.answer
        == deterministic_message
    )

    assert (
        response.generation_duration_ms
        == 0
    )

    assert evidence.calls == []
    assert ollama.calls == []


# ============================================================
# Valid grounded question
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_valid_question_builds_evidence_prompt_and_calls_ollama_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()

    package = FakeEvidencePackage(
        incident={
            "incident_id":
                "INC-TEST-003",
        },
        timeline=[
            {
                "event_id":
                    "EVT-001",
            }
        ],
    )

    evidence = RecordingEvidenceBuilder(
        package
    )

    ollama = RecordingOllama()

    service.evidence_builder = evidence
    service.ollama = ollama

    monkeypatch.setattr(
        chat_service_module,
        "validate_ai_chat_message",
        lambda message: SimpleNamespace(
            is_valid=True,
            normalized_message=(
                "why is this incident suspicious?"
            ),
            response_message=None,
        ),
    )

    captured_prompt_call = {}

    fake_prompt_bundle = SimpleNamespace(
        system_prompt="system",
        user_prompt="user",
        prompt_version="1.0",
    )

    def fake_build_prompt(
        *,
        evidence,
        message,
        history,
    ):
        captured_prompt_call[
            "evidence"
        ] = evidence

        captured_prompt_call[
            "message"
        ] = message

        captured_prompt_call[
            "history"
        ] = history

        return fake_prompt_bundle

    monkeypatch.setattr(
        chat_service_module,
        "build_ai_chat_prompt",
        fake_build_prompt,
    )

    request = AIIncidentChatRequest(
        message=(
            "Why is this incident suspicious?"
        ),
        history=[],
    )

    response = service.chat(
        incident_id="INC-TEST-003",
        request=request,
    )

    assert evidence.calls == [
        "INC-TEST-003"
    ]

    assert (
        captured_prompt_call[
            "message"
        ]
        == (
            "why is this incident suspicious?"
        )
    )

    assert (
        captured_prompt_call[
            "history"
        ]
        == []
    )

    assert (
        captured_prompt_call[
            "evidence"
        ][
            "incident"
        ][
            "incident_id"
        ]
        == "INC-TEST-003"
    )

    assert ollama.calls == [
        fake_prompt_bundle
    ]

    assert (
        response.incident_id
        == "INC-TEST-003"
    )

    assert (
        response.provider
        == "ollama"
    )

    assert (
        response.model
        == "llama3.2:3b"
    )

    assert (
        response.generation_duration_ms
        == 12
    )

    assert (
        response.grounded_on_deterministic_evidence
        is True
    )

    assert (
        response.content.response_type
        == "ANSWER"
    )


# ============================================================
# Request history forwarding
# ============================================================


@pytest.mark.unit
def test_valid_question_forwards_request_history_to_prompt_builder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()

    evidence = RecordingEvidenceBuilder(
        FakeEvidencePackage(
            incident={
                "incident_id":
                    "INC-HISTORY",
            },
            timeline=[],
        )
    )

    ollama = RecordingOllama()

    service.evidence_builder = evidence
    service.ollama = ollama

    monkeypatch.setattr(
        chat_service_module,
        "validate_ai_chat_message",
        lambda message: SimpleNamespace(
            is_valid=True,
            normalized_message=(
                "what happened next?"
            ),
            response_message=None,
        ),
    )

    captured = {}

    def fake_build_prompt(
        *,
        evidence,
        message,
        history,
    ):
        captured[
            "history"
        ] = history

        return SimpleNamespace(
            system_prompt="system",
            user_prompt="user",
            prompt_version="1.0",
        )

    monkeypatch.setattr(
        chat_service_module,
        "build_ai_chat_prompt",
        fake_build_prompt,
    )

    request = AIIncidentChatRequest(
        message="What happened next?",
        history=[
            {
                "role":
                    "user",

                "content":
                    "Why was this flagged?",
            },
            {
                "role":
                    "assistant",

                "content":
                    "It contained unusual activity.",
            },
        ],
    )

    service.chat(
        incident_id="INC-HISTORY",
        request=request,
    )

    assert len(
        captured[
            "history"
        ]
    ) == 2

    assert (
        captured[
            "history"
        ][0].role
        == "user"
    )

    assert (
        captured[
            "history"
        ][1].role
        == "assistant"
    )


# ============================================================
# Provider failure propagation
# ============================================================


@pytest.mark.unit
@pytest.mark.safety
def test_provider_failure_propagates_for_api_boundary_handling(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()

    evidence = RecordingEvidenceBuilder(
        FakeEvidencePackage(
            incident={
                "incident_id":
                    "INC-FAIL",
            },
            timeline=[],
        )
    )

    class FailingOllama:
        model = "llama3.2:3b"

        def generate_chat(
            self,
            prompt_bundle,
        ):
            raise OllamaUnavailableError(
                "Provider unavailable."
            )

    service.evidence_builder = evidence
    service.ollama = FailingOllama()

    monkeypatch.setattr(
        chat_service_module,
        "validate_ai_chat_message",
        lambda message: SimpleNamespace(
            is_valid=True,
            normalized_message=(
                "explain this incident"
            ),
            response_message=None,
        ),
    )

    monkeypatch.setattr(
        chat_service_module,
        "build_ai_chat_prompt",
        lambda **kwargs: SimpleNamespace(
            system_prompt="system",
            user_prompt="user",
            prompt_version="1.0",
        ),
    )

    with pytest.raises(
        OllamaUnavailableError,
        match="Provider unavailable",
    ):
        service.chat(
            incident_id="INC-FAIL",
            request=AIIncidentChatRequest(
                message=(
                    "Explain this incident"
                )
            ),
        )
