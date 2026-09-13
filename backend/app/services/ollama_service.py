"""
Local Ollama integration for SENTINEL.

This service is the boundary between SENTINEL's trusted evidence
pipeline and the optional local language model.

Responsibilities:

- check whether the local Ollama service is available
- verify that the configured model is installed
- submit grounded prompts
- request JSON-schema-constrained output
- validate generated output with Pydantic
- expose controlled failure modes

The service does NOT perform anomaly detection or incident correlation.
"""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any

import httpx
from pydantic import ValidationError

from app.config import settings

from app.schemas.ai_investigation import (
    AIInvestigationContent,
    AIServiceStatus,
)

from app.schemas.ai_chat import (
    AIIncidentChatContent,
)

from app.services.ai_prompt_builder import (
    AIPromptBundle,
)

from app.services.ai_chat_prompt_builder import (
    AIChatPromptBundle,
    INSUFFICIENT_EVIDENCE_RESPONSE,
    INVALID_QUESTION_RESPONSE,
    OUT_OF_SCOPE_RESPONSE,
)


# ============================================================
# Exceptions
# ============================================================

class OllamaServiceError(
    RuntimeError
):
    """
    Base error for SENTINEL's local Ollama integration.
    """


class OllamaDisabledError(
    OllamaServiceError
):
    """
    Raised when local AI has been disabled by configuration.
    """


class OllamaUnavailableError(
    OllamaServiceError
):
    """
    Raised when the Ollama server cannot be reached.
    """


class OllamaTimeoutError(
    OllamaServiceError
):
    """
    Raised when local generation exceeds the configured timeout.
    """


class OllamaModelUnavailableError(
    OllamaServiceError
):
    """
    Raised when the configured Ollama model is not installed.
    """


class OllamaInvalidResponseError(
    OllamaServiceError
):
    """
    Raised when Ollama returns malformed or schema-invalid output.
    """


# ============================================================
# Internal generation result
# ============================================================

@dataclass(
    frozen=True,
)
class OllamaGenerationResult:
    """
    Validated result returned by one local AI generation.
    """

    content: AIInvestigationContent

    generation_duration_ms: int

    model: str

    prompt_eval_count: int | None
    eval_count: int | None

    total_duration_ns: int | None


# ============================================================
# Internal chat generation result
# ============================================================

@dataclass(
    frozen=True,
)
class OllamaChatGenerationResult:
    """
    Validated result returned by one incident chat generation.
    """

    content: AIIncidentChatContent

    generation_duration_ms: int

    model: str

    prompt_eval_count: int | None

    eval_count: int | None

    total_duration_ns: int | None


# ============================================================
# Ollama service
# ============================================================

class OllamaService:
    """
    Access SENTINEL's configured local Ollama provider.
    """

    def __init__(
        self,
    ) -> None:
        self.base_url = (
            settings
            .ollama_base_url
            .rstrip(
                "/"
            )
        )

        self.model = (
            settings.ollama_model
        )

        self.timeout_seconds = (
            settings
            .ollama_timeout_seconds
        )


    # --------------------------------------------------------
    # Service status
    # --------------------------------------------------------

    def get_status(
        self,
    ) -> AIServiceStatus:
        """
        Check Ollama reachability and configured-model availability.

        Status checks never raise provider-connectivity exceptions.
        They return a user-facing availability state instead.
        """

        if not settings.ollama_enabled:
            return AIServiceStatus(
                enabled=False,
                available=False,
                model=self.model,
                message=(
                    "Local AI is disabled "
                    "by configuration."
                ),
            )

        try:
            response = httpx.get(
                (
                    f"{self.base_url}"
                    "/api/tags"
                ),
                timeout=5.0,
            )

            response.raise_for_status()

        except (
            httpx.ConnectError,
            httpx.TimeoutException,
            httpx.HTTPStatusError,
        ):
            return AIServiceStatus(
                enabled=True,
                available=False,
                model=self.model,
                message=(
                    "Ollama is not reachable "
                    "at the configured local URL."
                ),
            )

        try:
            payload = response.json()

        except ValueError:
            return AIServiceStatus(
                enabled=True,
                available=False,
                model=self.model,
                message=(
                    "Ollama returned an invalid "
                    "status response."
                ),
            )

        installed_models = {
            str(
                model.get(
                    "name",
                    ""
                )
            )
            for model in payload.get(
                "models",
                [],
            )
            if isinstance(
                model,
                dict,
            )
        }

        if self.model not in installed_models:
            return AIServiceStatus(
                enabled=True,
                available=False,
                model=self.model,
                message=(
                    "Ollama is running, but "
                    f"{self.model!r} is not installed."
                ),
            )

        return AIServiceStatus(
            enabled=True,
            available=True,
            model=self.model,
            message=(
                "Local AI provider is available."
            ),
        )


    # --------------------------------------------------------
    # Generation
    # --------------------------------------------------------

    def generate_investigation(
        self,
        prompt_bundle: AIPromptBundle,
    ) -> OllamaGenerationResult:
        """
        Generate and validate one grounded AI investigation.

        The Ollama API receives the Pydantic JSON schema as the
        structured-output format. The returned JSON text is then
        validated again by Pydantic before SENTINEL accepts it.
        """

        self._assert_ready()

        payload = self._generation_payload(
            prompt_bundle
        )

        started_at = (
            perf_counter()
        )

        try:
            response = httpx.post(
                (
                    f"{self.base_url}"
                    "/api/generate"
                ),

                json=payload,

                timeout=httpx.Timeout(
                    self.timeout_seconds
                ),
            )

            response.raise_for_status()

        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                "Local AI generation exceeded "
                f"{self.timeout_seconds:.0f} seconds."
            ) from exc

        except (
            httpx.ConnectError,
            httpx.HTTPStatusError,
        ) as exc:
            raise OllamaUnavailableError(
                "Ollama could not complete "
                "the generation request."
            ) from exc

        generation_duration_ms = int(
            (
                perf_counter()
                - started_at
            )
            * 1000
        )

        try:
            response_payload = (
                response.json()
            )

        except ValueError as exc:
            raise OllamaInvalidResponseError(
                "Ollama returned a non-JSON "
                "API response."
            ) from exc

        generated_text = (
            response_payload.get(
                "response"
            )
        )

        if not isinstance(
            generated_text,
            str,
        ):
            raise OllamaInvalidResponseError(
                "Ollama response did not contain "
                "generated text."
            )

        try:
            validated_content = (
                AIInvestigationContent
                .model_validate_json(
                    generated_text
                )
            )

        except ValidationError as exc:
            raise OllamaInvalidResponseError(
                "Ollama generated output that did "
                "not match SENTINEL's AI schema."
            ) from exc

        except ValueError as exc:
            raise OllamaInvalidResponseError(
                "Ollama generated invalid JSON."
            ) from exc

        return OllamaGenerationResult(
            content=validated_content,

            generation_duration_ms=(
                generation_duration_ms
            ),

            model=(
                str(
                    response_payload.get(
                        "model",
                        self.model,
                    )
                )
            ),

            prompt_eval_count=(
                self._optional_int(
                    response_payload.get(
                        "prompt_eval_count"
                    )
                )
            ),

            eval_count=(
                self._optional_int(
                    response_payload.get(
                        "eval_count"
                    )
                )
            ),

            total_duration_ns=(
                self._optional_int(
                    response_payload.get(
                        "total_duration"
                    )
                )
            ),
        )
    

    # --------------------------------------------------------
    # Chat Generation
    # --------------------------------------------------------

    def generate_chat(
        self,
        prompt_bundle: AIChatPromptBundle,
    ) -> OllamaChatGenerationResult:
        """
        Generate one evidence-grounded incident chat response.

        Chat responses use the same local Ollama provider and controlled
        failure modes as structured investigations, but are validated
        against SENTINEL's incident-chat schema.
        """

        self._assert_ready()

        payload = {
            "model":
                self.model,

            "system":
                prompt_bundle
                .system_prompt,

            "prompt":
                prompt_bundle
                .user_prompt,

            "stream":
                False,

            "format":
                "json",

            "keep_alive":
                settings
                .ollama_keep_alive,

            "options": {
                "temperature":
                    settings
                    .ollama_temperature,

                # Chat answers should remain shorter than the
                # full structured investigation.
                "num_predict":
                    min(
                        settings
                        .ollama_num_predict,
                        280,
                    ),

                "num_ctx":
                    settings
                    .ollama_context_window,
            },
        }

        started_at = (
            perf_counter()
        )

        try:
            response = httpx.post(
                (
                    f"{self.base_url}"
                    "/api/generate"
                ),

                json=payload,

                timeout=httpx.Timeout(
                    self.timeout_seconds
                ),
            )

            response.raise_for_status()

        except httpx.TimeoutException as exc:
            raise OllamaTimeoutError(
                "Local AI chat generation exceeded "
                f"{self.timeout_seconds:.0f} seconds."
            ) from exc

        except (
            httpx.ConnectError,
            httpx.HTTPStatusError,
        ) as exc:
            raise OllamaUnavailableError(
                "Ollama could not complete "
                "the chat generation request."
            ) from exc


        generation_duration_ms = int(
            (
                perf_counter()
                - started_at
            )
            * 1000
        )


        try:
            response_payload = (
                response.json()
            )

        except ValueError as exc:
            raise OllamaInvalidResponseError(
                "Ollama returned a non-JSON "
                "API response."
            ) from exc


        generated_text = (
            response_payload.get(
                "response"
            )
        )

        if not isinstance(
            generated_text,
            str,
        ):
            raise OllamaInvalidResponseError(
                "Ollama response did not contain "
                "generated chat text."
            )


        try:
            validated_content = (
                AIIncidentChatContent
                .model_validate_json(
                    generated_text
                )
            )

        except ValidationError as exc:
            raise OllamaInvalidResponseError(
                "Ollama generated chat output that did "
                "not match SENTINEL's AI chat schema."
            ) from exc

        except ValueError as exc:
            raise OllamaInvalidResponseError(
                "Ollama generated invalid chat JSON."
            ) from exc

        # ----------------------------------------------------
        # Canonical response enforcement
        #
        # We do not trust the model to invent its own wording
        # for non-answer classifications. SENTINEL controls
        # those UX responses deterministically.
        # ----------------------------------------------------

        canonical_answers = {
            "INVALID_QUESTION":
                INVALID_QUESTION_RESPONSE,

            "OUT_OF_SCOPE":
                OUT_OF_SCOPE_RESPONSE,

            "INSUFFICIENT_EVIDENCE":
                INSUFFICIENT_EVIDENCE_RESPONSE,
        }

        canonical_answer = (
            canonical_answers.get(
                validated_content
                .response_type
            )
        )

        if canonical_answer is not None:
            validated_content = (
                AIIncidentChatContent(
                    response_type=(
                        validated_content
                        .response_type
                    ),

                    answer=(
                        canonical_answer
                    ),
                )
            )


        return OllamaChatGenerationResult(
            content=validated_content,

            generation_duration_ms=(
                generation_duration_ms
            ),

            model=(
                str(
                    response_payload.get(
                        "model",
                        self.model,
                    )
                )
            ),

            prompt_eval_count=(
                self._optional_int(
                    response_payload.get(
                        "prompt_eval_count"
                    )
                )
            ),

            eval_count=(
                self._optional_int(
                    response_payload.get(
                        "eval_count"
                    )
                )
            ),

            total_duration_ns=(
                self._optional_int(
                    response_payload.get(
                        "total_duration"
                    )
                )
            ),
        )


    # --------------------------------------------------------
    # Readiness
    # --------------------------------------------------------

    def _assert_ready(
        self,
    ) -> None:
        if not settings.ollama_enabled:
            raise OllamaDisabledError(
                "Local AI is disabled "
                "by configuration."
            )

        status = self.get_status()

        if status.available:
            return

        if "not installed" in (
            status.message.lower()
        ):
            raise OllamaModelUnavailableError(
                status.message
            )

        raise OllamaUnavailableError(
            status.message
        )


    # --------------------------------------------------------
    # Ollama request
    # --------------------------------------------------------

    def _generation_payload(
        self,
        prompt_bundle: AIPromptBundle,
    ) -> dict[str, Any]:
        """
        Build the HTTP request sent to Ollama.

        `format` receives the same Pydantic schema that SENTINEL
        later uses for validation.
        """

        return {
            "model":
                self.model,

            "system":
                prompt_bundle
                .system_prompt,

            "prompt":
                prompt_bundle
                .user_prompt,

            "stream":
                False,

            "keep_alive":
                settings
                .ollama_keep_alive,

            "options": {
                "temperature":
                    settings
                    .ollama_temperature,

                "num_predict":
                    settings
                    .ollama_num_predict,

                "num_ctx":
                    settings
                    .ollama_context_window,
            },
        }


    # --------------------------------------------------------
    # Helpers
    # --------------------------------------------------------

    @staticmethod
    def _optional_int(
        value: Any,
    ) -> int | None:
        if value is None:
            return None

        try:
            return int(
                value
            )

        except (
            TypeError,
            ValueError,
        ):
            return None