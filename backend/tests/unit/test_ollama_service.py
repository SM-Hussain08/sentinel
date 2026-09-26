"""
Unit tests for SENTINEL's optional local Ollama provider boundary.

These tests never contact a real Ollama server.

They verify that:
- disabled AI remains safely optional;
- provider outages become controlled availability states;
- configured-model availability is checked;
- readiness failures use explicit SENTINEL exceptions.
"""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

import app.services.ollama_service as ollama_module

from app.schemas.ai_investigation import (
    AIServiceStatus,
)

from app.services.ollama_service import (
    OllamaDisabledError,
    OllamaModelUnavailableError,
    OllamaService,
    OllamaUnavailableError,
)


# ============================================================
# Fixtures / helpers
# ============================================================


@pytest.fixture
def ollama_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> SimpleNamespace:
    """
    Replace application settings only inside this test module.

    No environment files or real Ollama configuration are modified.
    """

    fake_settings = SimpleNamespace(
        ollama_enabled=True,
        ollama_base_url=(
            "http://127.0.0.1:11434/"
        ),
        ollama_model="llama3.2:3b",
        ollama_timeout_seconds=30.0,
        ollama_keep_alive="5m",
        ollama_temperature=0.1,
        ollama_num_predict=600,
        ollama_context_window=4096,
    )

    monkeypatch.setattr(
        ollama_module,
        "settings",
        fake_settings,
    )

    return fake_settings


class FakeResponse:
    """
    Minimal response object needed by OllamaService.get_status().
    """

    def __init__(
        self,
        *,
        payload=None,
        json_error: Exception | None = None,
        status_error: Exception | None = None,
    ) -> None:
        self.payload = payload
        self.json_error = json_error
        self.status_error = status_error

    def raise_for_status(
        self,
    ) -> None:
        if self.status_error is not None:
            raise self.status_error

    def json(
        self,
    ):
        if self.json_error is not None:
            raise self.json_error

        return self.payload


# ============================================================
# Disabled configuration
# ============================================================


@pytest.mark.unit
def test_get_status_disabled_requires_no_network_call(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ollama_settings.ollama_enabled = False

    def unexpected_get(
        *args,
        **kwargs,
    ):
        raise AssertionError(
            "Disabled Ollama status check "
            "must not access the network."
        )

    monkeypatch.setattr(
        ollama_module.httpx,
        "get",
        unexpected_get,
    )

    service = OllamaService()

    status = service.get_status()

    assert status.enabled is False
    assert status.available is False

    assert (
        status.model
        == "llama3.2:3b"
    )

    assert (
        status.message
        == (
            "Local AI is disabled "
            "by configuration."
        )
    )


# ============================================================
# Provider unavailable
# ============================================================


@pytest.mark.unit
@pytest.mark.parametrize(
    "provider_error",
    [
        httpx.ConnectError(
            "connection refused"
        ),
        httpx.ReadTimeout(
            "provider timed out"
        ),
    ],
)
def test_get_status_reports_provider_connectivity_failures_safely(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    provider_error: Exception,
) -> None:
    def failing_get(
        *args,
        **kwargs,
    ):
        raise provider_error

    monkeypatch.setattr(
        ollama_module.httpx,
        "get",
        failing_get,
    )

    status = (
        OllamaService()
        .get_status()
    )

    assert status.enabled is True
    assert status.available is False

    assert (
        "not reachable"
        in status.message.lower()
    )


# ============================================================
# Invalid provider status payload
# ============================================================


@pytest.mark.unit
def test_get_status_rejects_non_json_provider_response(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ollama_module.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse(
            json_error=ValueError(
                "invalid json"
            ),
        ),
    )

    status = (
        OllamaService()
        .get_status()
    )

    assert status.enabled is True
    assert status.available is False

    assert (
        status.message
        == (
            "Ollama returned an invalid "
            "status response."
        )
    )


# ============================================================
# Configured model availability
# ============================================================


@pytest.mark.unit
def test_get_status_reports_missing_configured_model(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ollama_module.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "models": [
                    {
                        "name":
                            "different-model:latest"
                    },
                ],
            },
        ),
    )

    status = (
        OllamaService()
        .get_status()
    )

    assert status.enabled is True
    assert status.available is False

    assert (
        "not installed"
        in status.message.lower()
    )

    assert (
        "llama3.2:3b"
        in status.message
    )


@pytest.mark.unit
def test_get_status_reports_configured_model_available(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ollama_module.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "models": [
                    {
                        "name":
                            "unrelated-model:latest"
                    },
                    {
                        "name":
                            "llama3.2:3b"
                    },
                ],
            },
        ),
    )

    status = (
        OllamaService()
        .get_status()
    )

    assert status.enabled is True
    assert status.available is True

    assert (
        status.model
        == "llama3.2:3b"
    )

    assert (
        status.message
        == (
            "Local AI provider "
            "is available."
        )
    )


# ============================================================
# Readiness enforcement
# ============================================================


@pytest.mark.unit
def test_assert_ready_rejects_disabled_ai(
    ollama_settings: SimpleNamespace,
) -> None:
    ollama_settings.ollama_enabled = False

    service = OllamaService()

    with pytest.raises(
        OllamaDisabledError,
        match=(
            "Local AI is disabled "
            "by configuration"
        ),
    ):
        service._assert_ready()


@pytest.mark.unit
def test_assert_ready_rejects_missing_model(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "get_status",
        lambda: AIServiceStatus(
            enabled=True,
            available=False,
            model=service.model,
            message=(
                "Ollama is running, but "
                "'llama3.2:3b' is not installed."
            ),
        ),
    )

    with pytest.raises(
        OllamaModelUnavailableError,
        match="not installed",
    ):
        service._assert_ready()


@pytest.mark.unit
def test_assert_ready_rejects_unavailable_provider(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "get_status",
        lambda: AIServiceStatus(
            enabled=True,
            available=False,
            model=service.model,
            message=(
                "Ollama is not reachable "
                "at the configured local URL."
            ),
        ),
    )

    with pytest.raises(
        OllamaUnavailableError,
        match="not reachable",
    ):
        service._assert_ready()


@pytest.mark.unit
def test_assert_ready_accepts_available_provider(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "get_status",
        lambda: AIServiceStatus(
            enabled=True,
            available=True,
            model=service.model,
            message=(
                "Local AI provider "
                "is available."
            ),
        ),
    )

    # Must return cleanly.
    assert service._assert_ready() is None


# ============================================================
# Defensive provider metadata parsing
# ============================================================


@pytest.mark.unit
@pytest.mark.parametrize(
    (
        "value",
        "expected",
    ),
    [
        (None, None),
        (5, 5),
        ("17", 17),
        (3.9, 3),
        ("not-an-int", None),
        ({}, None),
    ],
)
def test_optional_int_handles_provider_metadata_safely(
    value,
    expected,
) -> None:
    assert (
        OllamaService._optional_int(
            value
        )
        == expected
    )


# ============================================================
# Generation boundary tests
# ============================================================

import json

from app.services.ai_prompt_builder import (
    AIPromptBundle,
)

from app.services.ai_chat_prompt_builder import (
    AIChatPromptBundle,
    INSUFFICIENT_EVIDENCE_RESPONSE,
    INVALID_QUESTION_RESPONSE,
    OUT_OF_SCOPE_RESPONSE,
)

from app.services.ollama_service import (
    OllamaInvalidResponseError,
    OllamaTimeoutError,
)


def _investigation_prompt_bundle() -> AIPromptBundle:
    return AIPromptBundle(
        prompt_version="1.0",
        system_prompt="system",
        user_prompt="user",
        total_timeline_events=3,
        included_timeline_events=3,
    )


def _chat_prompt_bundle() -> AIChatPromptBundle:
    return AIChatPromptBundle(
        system_prompt="system",
        user_prompt="user",
        prompt_version="1.0",
    )


def _valid_investigation_json() -> str:
    return json.dumps(
        {
            "executive_assessment":
                "Observed behavior is unusual and requires review.",

            "why_suspicious": [
                "Multiple anomalous events were correlated.",
            ],

            "timeline_interpretation":
                "The supplied events show an unusual sequence.",

            "investigation_priorities": [
                "Confirm whether the activity was authorized.",
            ],

            "containment_considerations": [
                "Consider containment if unauthorized activity is confirmed.",
            ],

            "confidence":
                "MEDIUM",

            "limitations": [
                "The supplied evidence does not prove malicious intent.",
            ],
        }
    )


# ============================================================
# Investigation generation failures
# ============================================================


@pytest.mark.unit
def test_generate_investigation_timeout_is_controlled(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    def timeout_post(
        *args,
        **kwargs,
    ):
        raise httpx.ReadTimeout(
            "generation timeout"
        )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        timeout_post,
    )

    with pytest.raises(
        OllamaTimeoutError,
        match=(
            "Local AI generation exceeded"
        ),
    ):
        service.generate_investigation(
            _investigation_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_investigation_connectivity_failure_is_controlled(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    def failing_post(
        *args,
        **kwargs,
    ):
        raise httpx.ConnectError(
            "connection refused"
        )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        failing_post,
    )

    with pytest.raises(
        OllamaUnavailableError,
        match=(
            "Ollama could not complete "
            "the generation request"
        ),
    ):
        service.generate_investigation(
            _investigation_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_investigation_rejects_non_json_api_response(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            json_error=ValueError(
                "not json"
            ),
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "non-JSON API response"
        ),
    ):
        service.generate_investigation(
            _investigation_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_investigation_rejects_missing_generated_text(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "model":
                    "llama3.2:3b"
            },
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "did not contain generated text"
        ),
    ):
        service.generate_investigation(
            _investigation_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_investigation_rejects_schema_invalid_output(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    invalid_generated_text = json.dumps(
        {
            "executive_assessment":
                "Assessment exists",

            # Required fields intentionally omitted.
            "confidence":
                "IMPOSSIBLE_VALUE",
        }
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "response":
                    invalid_generated_text,
            },
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "did not match SENTINEL's AI schema"
        ),
    ):
        service.generate_investigation(
            _investigation_prompt_bundle()
        )


# ============================================================
# Successful investigation generation
# ============================================================


@pytest.mark.unit
def test_generate_investigation_returns_validated_content_and_provider_metrics(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "response":
                    _valid_investigation_json(),

                "model":
                    "llama3.2:3b",

                "prompt_eval_count":
                    "120",

                "eval_count":
                    44,

                "total_duration":
                    "9000000",
            },
        ),
    )

    result = service.generate_investigation(
        _investigation_prompt_bundle()
    )

    assert (
        result.content.confidence
        == "MEDIUM"
    )

    assert (
        "unusual"
        in result.content
        .executive_assessment
        .lower()
    )

    assert (
        result.model
        == "llama3.2:3b"
    )

    assert (
        result.prompt_eval_count
        == 120
    )

    assert (
        result.eval_count
        == 44
    )

    assert (
        result.total_duration_ns
        == 9_000_000
    )

    assert (
        result.generation_duration_ms
        >= 0
    )


# ============================================================
# Chat generation failures
# ============================================================


@pytest.mark.unit
def test_generate_chat_timeout_is_controlled(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    def timeout_post(
        *args,
        **kwargs,
    ):
        raise httpx.ReadTimeout(
            "chat timeout"
        )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        timeout_post,
    )

    with pytest.raises(
        OllamaTimeoutError,
        match=(
            "Local AI chat generation exceeded"
        ),
    ):
        service.generate_chat(
            _chat_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_chat_connectivity_failure_is_controlled(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    def failing_post(
        *args,
        **kwargs,
    ):
        raise httpx.ConnectError(
            "connection refused"
        )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        failing_post,
    )

    with pytest.raises(
        OllamaUnavailableError,
        match=(
            "Ollama could not complete "
            "the chat generation request"
        ),
    ):
        service.generate_chat(
            _chat_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_chat_rejects_non_json_api_response(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            json_error=ValueError(
                "not json"
            ),
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "non-JSON API response"
        ),
    ):
        service.generate_chat(
            _chat_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_chat_rejects_missing_generated_text(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={},
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "did not contain generated chat text"
        ),
    ):
        service.generate_chat(
            _chat_prompt_bundle()
        )


@pytest.mark.unit
def test_generate_chat_rejects_schema_invalid_output(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "response":
                    json.dumps(
                        {
                            "response_type":
                                "UNKNOWN_TYPE",

                            "answer":
                                "",
                        }
                    )
            },
        ),
    )

    with pytest.raises(
        OllamaInvalidResponseError,
        match=(
            "did not match SENTINEL's AI chat schema"
        ),
    ):
        service.generate_chat(
            _chat_prompt_bundle()
        )


# ============================================================
# Successful ordinary chat
# ============================================================


@pytest.mark.unit
def test_generate_chat_preserves_valid_answer_response(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    model_answer = (
        "The correlated timeline shows repeated "
        "authentication failures before the successful login."
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "response":
                    json.dumps(
                        {
                            "response_type":
                                "ANSWER",

                            "answer":
                                model_answer,
                        }
                    ),

                "model":
                    "llama3.2:3b",

                "prompt_eval_count":
                    75,

                "eval_count":
                    18,

                "total_duration":
                    4_500_000,
            },
        ),
    )

    result = service.generate_chat(
        _chat_prompt_bundle()
    )

    assert (
        result.content.response_type
        == "ANSWER"
    )

    assert (
        result.content.answer
        == model_answer
    )

    assert result.prompt_eval_count == 75
    assert result.eval_count == 18

    assert (
        result.total_duration_ns
        == 4_500_000
    )


# ============================================================
# Canonical non-answer enforcement
# ============================================================


@pytest.mark.unit
@pytest.mark.parametrize(
    (
        "response_type",
        "canonical_answer",
    ),
    [
        (
            "INVALID_QUESTION",
            INVALID_QUESTION_RESPONSE,
        ),
        (
            "OUT_OF_SCOPE",
            OUT_OF_SCOPE_RESPONSE,
        ),
        (
            "INSUFFICIENT_EVIDENCE",
            INSUFFICIENT_EVIDENCE_RESPONSE,
        ),
    ],
)
def test_generate_chat_replaces_model_rejection_wording_with_canonical_response(
    ollama_settings: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    response_type: str,
    canonical_answer: str,
) -> None:
    service = OllamaService()

    monkeypatch.setattr(
        service,
        "_assert_ready",
        lambda: None,
    )

    malicious_or_inconsistent_model_wording = (
        "The model invented its own wording "
        "and SENTINEL must not expose it."
    )

    monkeypatch.setattr(
        ollama_module.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            payload={
                "response":
                    json.dumps(
                        {
                            "response_type":
                                response_type,

                            "answer":
                                malicious_or_inconsistent_model_wording,
                        }
                    ),
            },
        ),
    )

    result = service.generate_chat(
        _chat_prompt_bundle()
    )

    assert (
        result.content.response_type
        == response_type
    )

    assert (
        result.content.answer
        == canonical_answer
    )

    assert (
        result.content.answer
        != malicious_or_inconsistent_model_wording
    )
