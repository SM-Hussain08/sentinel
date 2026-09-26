"""
API contract tests for SENTINEL's optional local AI layer.

These tests verify that internal evidence/provider failures are translated
into stable public HTTP responses.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.api.ai as ai_api

from app.services.ollama_service import (
    OllamaUnavailableError,
)


# ============================================================
# Chat provider error mapping
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
def test_ai_chat_unavailable_provider_returns_503(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    A local Ollama outage is a service-availability problem.

    It must be exposed as HTTP 503, not as an incident-state conflict.
    """

    class FailingChatService:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def chat(
            self,
            *,
            incident_id,
            request,
        ):
            raise OllamaUnavailableError(
                "Ollama could not complete "
                "the chat generation request."
            )

    monkeypatch.setattr(
        ai_api,
        "AIChatService",
        FailingChatService,
    )

    response = client.post(
        "/api/v1/ai/incidents/INC-TEST/chat",
        json={
            "message":
                "Explain this incident.",
            "history": [],
        },
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail":
            "Local AI provider is unavailable."
    }


# ============================================================
# Investigation provider error mapping
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
def test_ai_investigation_unavailable_provider_returns_503(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    An Ollama outage during AI-assisted investigation is a provider
    availability failure and must map to HTTP 503.
    """

    class FakeEvidenceBuilder:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def build_dict(
            self,
            incident_id,
        ):
            return {
                "incident": {
                    "incident_id":
                        incident_id,
                },
                "timeline": [],
            }

    class FakePromptBuilder:
        def build(
            self,
            evidence,
        ):
            return object()

    class FailingOllamaService:
        def __init__(
            self,
        ) -> None:
            pass

        def generate_investigation(
            self,
            prompt,
        ):
            raise OllamaUnavailableError(
                "Ollama could not complete "
                "the generation request."
            )

    monkeypatch.setattr(
        ai_api,
        "AIEvidenceBuilder",
        FakeEvidenceBuilder,
    )

    monkeypatch.setattr(
        ai_api,
        "AIPromptBuilder",
        FakePromptBuilder,
    )

    monkeypatch.setattr(
        ai_api,
        "OllamaService",
        FailingOllamaService,
    )

    response = client.post(
        (
            "/api/v1/ai/incidents/"
            "INC-TEST/investigation"
        )
    )

    assert response.status_code == 503

    assert response.json() == {
        "detail":
            "Local AI provider is unavailable."
    }


# ============================================================
# Complete AI API failure-contract matrix
# ============================================================

from app.services.ai_evidence import (
    GroundTruthLeakageError,
)

from app.services.ollama_service import (
    OllamaDisabledError,
    OllamaInvalidResponseError,
    OllamaModelUnavailableError,
    OllamaTimeoutError,
)


# ============================================================
# Investigation evidence failures
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
@pytest.mark.parametrize(
    (
        "exception",
        "expected_status",
        "expected_detail",
    ),
    [
        (
            LookupError(
                "missing"
            ),
            404,
            "Incident was not found.",
        ),
        (
            GroundTruthLeakageError(
                "private field leaked"
            ),
            500,
            "AI evidence safety validation failed.",
        ),
        (
            RuntimeError(
                "Deterministic investigation intelligence "
                "has not been generated for this incident."
            ),
            409,
            (
                "Deterministic investigation intelligence "
                "has not been generated for this incident."
            ),
        ),
    ],
)
def test_ai_investigation_maps_evidence_failures(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    exception: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    class FailingEvidenceBuilder:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def build_dict(
            self,
            incident_id,
        ):
            raise exception

    monkeypatch.setattr(
        ai_api,
        "AIEvidenceBuilder",
        FailingEvidenceBuilder,
    )

    response = client.post(
        (
            "/api/v1/ai/incidents/"
            "INC-TEST/investigation"
        )
    )

    assert (
        response.status_code
        == expected_status
    )

    assert response.json() == {
        "detail":
            expected_detail
    }


# ============================================================
# Investigation provider failures
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
@pytest.mark.parametrize(
    (
        "exception",
        "expected_status",
        "expected_detail",
    ),
    [
        (
            OllamaDisabledError(
                "disabled"
            ),
            503,
            "Local AI investigation is disabled.",
        ),
        (
            OllamaModelUnavailableError(
                "Configured model is not installed."
            ),
            503,
            "Configured model is not installed.",
        ),
        (
            OllamaTimeoutError(
                "Local AI generation exceeded 30 seconds."
            ),
            504,
            "Local AI generation exceeded 30 seconds.",
        ),
        (
            OllamaInvalidResponseError(
                "invalid output"
            ),
            502,
            (
                "Local AI returned an invalid "
                "structured response."
            ),
        ),
    ],
)
def test_ai_investigation_maps_provider_failures(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    exception: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    class FakeEvidenceBuilder:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def build_dict(
            self,
            incident_id,
        ):
            return {
                "incident": {
                    "incident_id":
                        incident_id,
                },
                "timeline": [],
            }

    class FakePromptBuilder:
        def build(
            self,
            evidence,
        ):
            return object()

    class FailingOllamaService:
        def __init__(
            self,
        ) -> None:
            pass

        def generate_investigation(
            self,
            prompt,
        ):
            raise exception

    monkeypatch.setattr(
        ai_api,
        "AIEvidenceBuilder",
        FakeEvidenceBuilder,
    )

    monkeypatch.setattr(
        ai_api,
        "AIPromptBuilder",
        FakePromptBuilder,
    )

    monkeypatch.setattr(
        ai_api,
        "OllamaService",
        FailingOllamaService,
    )

    response = client.post(
        (
            "/api/v1/ai/incidents/"
            "INC-TEST/investigation"
        )
    )

    assert (
        response.status_code
        == expected_status
    )

    assert response.json() == {
        "detail":
            expected_detail
    }


# ============================================================
# Chat evidence failures
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
@pytest.mark.parametrize(
    (
        "exception",
        "expected_status",
        "expected_detail",
    ),
    [
        (
            LookupError(
                "missing"
            ),
            404,
            "Incident was not found.",
        ),
        (
            GroundTruthLeakageError(
                "private field leaked"
            ),
            500,
            "AI evidence safety validation failed.",
        ),
        (
            RuntimeError(
                "Deterministic investigation is unavailable."
            ),
            409,
            "Deterministic investigation is unavailable.",
        ),
    ],
)
def test_ai_chat_maps_evidence_failures(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    exception: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    class FailingChatService:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def chat(
            self,
            *,
            incident_id,
            request,
        ):
            raise exception

    monkeypatch.setattr(
        ai_api,
        "AIChatService",
        FailingChatService,
    )

    response = client.post(
        "/api/v1/ai/incidents/INC-TEST/chat",
        json={
            "message":
                "Explain this incident.",
            "history": [],
        },
    )

    assert (
        response.status_code
        == expected_status
    )

    assert response.json() == {
        "detail":
            expected_detail
    }


# ============================================================
# Chat provider failures
# ============================================================


@pytest.mark.api
@pytest.mark.postgres
@pytest.mark.safety
@pytest.mark.parametrize(
    (
        "exception",
        "expected_status",
        "expected_detail",
    ),
    [
        (
            OllamaDisabledError(
                "disabled"
            ),
            503,
            "Local AI chat is disabled.",
        ),
        (
            OllamaModelUnavailableError(
                "Configured model is not installed."
            ),
            503,
            "Configured model is not installed.",
        ),
        (
            OllamaTimeoutError(
                "Local AI chat generation exceeded 30 seconds."
            ),
            504,
            (
                "Local AI chat generation "
                "exceeded 30 seconds."
            ),
        ),
        (
            OllamaInvalidResponseError(
                "invalid output"
            ),
            502,
            (
                "Local AI returned an invalid "
                "chat response."
            ),
        ),
    ],
)
def test_ai_chat_maps_provider_failures(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    exception: Exception,
    expected_status: int,
    expected_detail: str,
) -> None:
    class FailingChatService:
        def __init__(
            self,
            db,
        ) -> None:
            pass

        def chat(
            self,
            *,
            incident_id,
            request,
        ):
            raise exception

    monkeypatch.setattr(
        ai_api,
        "AIChatService",
        FailingChatService,
    )

    response = client.post(
        "/api/v1/ai/incidents/INC-TEST/chat",
        json={
            "message":
                "Explain this incident.",
            "history": [],
        },
    )

    assert (
        response.status_code
        == expected_status
    )

    assert response.json() == {
        "detail":
            expected_detail
    }
