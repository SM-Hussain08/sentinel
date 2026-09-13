"""
Incident-scoped AI chat orchestration for SENTINEL.

This service coordinates:

- deterministic message validation,
- whitelisted incident evidence,
- grounded prompt construction,
- local Ollama generation,
- validated chat responses.

It does not perform anomaly detection or incident correlation.
"""

from __future__ import annotations

from dataclasses import (
    asdict,
    dataclass,
)
from datetime import (
    datetime,
    timezone,
)

from sqlalchemy.orm import Session

from app.schemas.ai_chat import (
    AIIncidentChatContent,
    AIIncidentChatRequest,
    AIIncidentChatResponse,
)

from app.services.ai_chat_guard import (
    validate_ai_chat_message,
)

from app.services.ai_chat_prompt_builder import (
    build_ai_chat_prompt,
)

from app.services.ai_evidence import (
    AIEvidenceBuilder,
)

from app.services.ollama_service import (
    OllamaService,
)


# ============================================================
# Service
# ============================================================

class AIChatService:
    """
    Generate grounded follow-up answers for one selected incident.
    """

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

        self.evidence_builder = (
            AIEvidenceBuilder(
                db
            )
        )

        self.ollama = (
            OllamaService()
        )


    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def chat(
        self,
        *,
        incident_id: str,
        request: AIIncidentChatRequest,
    ) -> AIIncidentChatResponse:
        """
        Process one incident-scoped analyst chat message.

        Obvious invalid input returns immediately without invoking
        the local language model.
        """

        guard_result = (
            validate_ai_chat_message(
                request.message
            )
        )


        # ----------------------------------------------------
        # Fast deterministic invalid-input response
        # ----------------------------------------------------

        if not guard_result.is_valid:
            return AIIncidentChatResponse(
                incident_id=incident_id,

                provider="ollama",

                model=(
                    self.ollama.model
                ),

                generated_at=(
                    datetime.now(
                        timezone.utc
                    )
                ),

                generation_duration_ms=0,

                grounded_on_deterministic_evidence=True,

                content=(
                    AIIncidentChatContent(
                        response_type=(
                            "INVALID_QUESTION"
                        ),

                        answer=(
                            guard_result
                            .response_message
                            or (
                                "I couldn't understand that question "
                                "clearly. Please ask a clear question "
                                "about this incident."
                            )
                        ),
                    )
                ),
            )


        # ----------------------------------------------------
        # Fast deterministic conversational response
        #
        # Greetings and simple capability/help questions
        # should not invoke Ollama.
        # ----------------------------------------------------

        if (
            guard_result
            .response_message
            is not None
        ):
            return AIIncidentChatResponse(
                incident_id=incident_id,

                provider="ollama",

                model=(
                    self.ollama.model
                ),

                generated_at=(
                    datetime.now(
                        timezone.utc
                    )
                ),

                generation_duration_ms=0,

                grounded_on_deterministic_evidence=True,

                content=(
                    AIIncidentChatContent(
                        response_type=(
                            "ANSWER"
                        ),

                        answer=(
                            guard_result
                            .response_message
                        ),
                    )
                ),
            )


        # ----------------------------------------------------
        # Build AI-safe incident evidence
        # ----------------------------------------------------

        evidence_package = (
            self.evidence_builder
            .build(
                incident_id
            )
        )

        evidence_dict = (
            asdict(
                evidence_package
            )
        )


        # ----------------------------------------------------
        # Build grounded chat prompt
        # ----------------------------------------------------

        prompt_bundle = (
            build_ai_chat_prompt(
                evidence=(
                    evidence_dict
                ),

                message=(
                    guard_result
                    .normalized_message
                ),

                history=(
                    request.history
                ),
            )
        )


        # ----------------------------------------------------
        # Local model generation
        # ----------------------------------------------------

        result = (
            self.ollama
            .generate_chat(
                prompt_bundle
            )
        )


        # ----------------------------------------------------
        # API response
        # ----------------------------------------------------

        return AIIncidentChatResponse(
            incident_id=incident_id,

            provider="ollama",

            model=(
                result.model
            ),

            generated_at=(
                datetime.now(
                    timezone.utc
                )
            ),

            generation_duration_ms=(
                result
                .generation_duration_ms
            ),

            grounded_on_deterministic_evidence=True,

            content=(
                result.content
            ),
        )