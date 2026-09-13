"""
Schemas for SENTINEL's incident-scoped local AI chat.

The chat is intentionally limited to the currently selected
security incident and its whitelisted deterministic evidence.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
)


# ============================================================
# Types
# ============================================================

AIChatRole = Literal[
    "user",
    "assistant",
]


AIChatResponseType = Literal[
    "ANSWER",
    "INVALID_QUESTION",
    "OUT_OF_SCOPE",
    "INSUFFICIENT_EVIDENCE",
]


# ============================================================
# Conversation history
# ============================================================

class AIChatHistoryMessage(
    BaseModel
):
    """
    One previous message in the incident chat.

    Only a small amount of recent conversation history will be
    accepted so that local inference remains reasonably fast.
    """

    role: AIChatRole

    content: str = Field(
        min_length=1,
        max_length=1200,
    )


# ============================================================
# Request
# ============================================================

class AIIncidentChatRequest(
    BaseModel
):
    """
    Follow-up analyst question for one selected incident.
    """

    message: str = Field(
        min_length=1,
        max_length=500,
    )

    history: list[
        AIChatHistoryMessage
    ] = Field(
        default_factory=list,
        max_length=6,
    )


# ============================================================
# AI-generated structured content
# ============================================================

class AIIncidentChatContent(
    BaseModel
):
    """
    Validated content returned by the local model.

    response_type controls how the frontend presents the answer.
    """

    response_type: AIChatResponseType

    answer: str = Field(
        min_length=1,
        max_length=1600,
    )


# ============================================================
# API response
# ============================================================

class AIIncidentChatResponse(
    BaseModel
):
    """
    Full API response for an incident-scoped chat message.
    """

    incident_id: str

    provider: Literal[
        "ollama",
    ]

    model: str

    generated_at: datetime

    generation_duration_ms: int = Field(ge=0,)

    grounded_on_deterministic_evidence: Literal[ True ] = True

    content: AIIncidentChatContent