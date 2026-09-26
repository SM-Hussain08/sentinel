"""
Fast deterministic validation for SENTINEL's incident AI chat.

The guard handles only high-confidence cases before invoking
the local language model:

- obvious unusable input,
- simple greetings,
- simple help/capability questions.

Semantic incident classification remains the responsibility of
the grounded AI chat prompt.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
import random


# ============================================================
# Controlled responses
# ============================================================

INVALID_QUESTION_RESPONSE = (
    "I couldn't understand that question clearly. "
    "Please ask a clear question about this incident, "
    "its evidence, timeline, risk signals, investigation, "
    "or containment."
)


GREETING_RESPONSES = (
    (
        "Hi. I can help you investigate this selected incident. "
        "Ask me about its evidence, timeline, risk signals, "
        "investigation priorities, or containment."
    ),
    (
        "Hello. I'm ready to help with this incident. "
        "You can ask about the timeline, suspicious activity, "
        "risk signals, investigation steps, or containment."
    ),
    (
        "Hi there. I can help you review the selected incident "
        "using SENTINEL's available evidence. Ask me what happened, "
        "why it looks suspicious, or what should be investigated next."
    ),
)


CAPABILITY_RESPONSES = (
    (
        "I can answer grounded questions about this selected "
        "incident's evidence, timeline, risk signals, investigation "
        "priorities, and containment. I can also tell you when the "
        "available evidence is not sufficient to answer a question."
    ),
    (
        "I can help you understand what happened in this incident, "
        "why the activity was flagged, which evidence matters, what "
        "to investigate next, and possible containment considerations."
    ),
    (
        "You can ask me about this incident's timeline, users, IPs, "
        "resources, anomaly signals, investigation priorities, or "
        "containment. If SENTINEL does not have enough evidence, "
        "I'll tell you instead of guessing."
    ),
)


# ============================================================
# Result
# ============================================================

@dataclass(
    frozen=True,
)
class AIChatGuardResult:
    """
    Result returned by the deterministic input guard.
    """

    is_valid: bool

    normalized_message: str

    reason: str | None = None

    response_message: str | None = None


# ============================================================
# Known keyboard-mash patterns
# ============================================================

KEYBOARD_MASH_PATTERNS = {
    "asdf",
    "asdfg",
    "asdfgh",
    "asdfghjkl",
    "qwer",
    "qwerty",
    "qwertyuiop",
    "zxcv",
    "zxcvb",
    "zxcvbnm",
    "hjkl",
}


# ============================================================
# Simple conversational intents
# ============================================================

GREETING_MESSAGES = {
    "hi",
    "hello",
    "hey",
    "hi there",
    "hello there",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
}


CAPABILITY_MESSAGES = {
    "help",
    "help me",
    "what can you do",
    "what do you do",
    "what can i ask",
    "what should i ask",
    "how can you help",
    "how can you help me",
    "what are you able to do",
    "who are you",
}


# ============================================================
# Public guard
# ============================================================

def validate_ai_chat_message(
    message: str,
) -> AIChatGuardResult:
    """
    Validate a user message before local AI generation.

    Capitalization, surrounding punctuation, and repeated
    whitespace do not affect simple deterministic intents.
    """

    normalized = _normalize_message(
        message
    )

    if not normalized:
        return _invalid(
            normalized,
            reason="empty_message",
        )


    # --------------------------------------------------------
    # Only punctuation / symbols
    # --------------------------------------------------------

    if not any(
        character.isalnum()
        for character in normalized
    ):
        return _invalid(
            normalized,
            reason="symbols_only",
        )


    # --------------------------------------------------------
    # Numbers only
    # --------------------------------------------------------

    if normalized.isdigit():
        return _invalid(
            normalized,
            reason="numbers_only",
        )


    # --------------------------------------------------------
    # Repeated single character
    # --------------------------------------------------------

    compact_alphanumeric = "".join(
        character.casefold()
        for character in normalized
        if character.isalnum()
    )

    if (
        len(
            compact_alphanumeric
        )
        >= 5
        and len(
            set(
                compact_alphanumeric
            )
        )
        == 1
    ):
        return _invalid(
            normalized,
            reason="repeated_character",
        )


    # --------------------------------------------------------
    # Common keyboard mash
    # --------------------------------------------------------

    words = re.findall(
        r"[a-zA-Z]+",
        normalized.casefold(),
    )

    if (
        len(words) == 1
        and words[0]
        in KEYBOARD_MASH_PATTERNS
    ):
        return _invalid(
            normalized,
            reason="keyboard_mash",
        )


    # --------------------------------------------------------
    # Very low-information input
    # --------------------------------------------------------

    if (
        len(
            compact_alphanumeric
        )
        <= 1
        and len(
            normalized
        )
        >= 5
    ):
        return _invalid(
            normalized,
            reason="insufficient_content",
        )


    # --------------------------------------------------------
    # Normalize for conversational intent matching
    #
    # Examples:
    #
    # "HI!!!"       -> "hi"
    # "Hello There" -> "hello there"
    # "What CAN you do?" -> "what can you do"
    # --------------------------------------------------------

    intent_text = (
        _normalize_for_intent(
            normalized
        )
    )


    # --------------------------------------------------------
    # Greeting
    # --------------------------------------------------------

    if (
        intent_text
        in GREETING_MESSAGES
    ):
        return AIChatGuardResult(
            is_valid=True,

            normalized_message=(
                normalized
            ),

            reason="greeting",

            response_message=(
                # Non-cryptographic choice only varies
                # harmless greeting wording.
                random.choice(  # nosec B311
                    GREETING_RESPONSES
                )
            ),
        )


    # --------------------------------------------------------
    # Help / capability question
    # --------------------------------------------------------

    if (
        intent_text
        in CAPABILITY_MESSAGES
    ):
        return AIChatGuardResult(
            is_valid=True,

            normalized_message=(
                normalized
            ),

            reason="capability_question",

            response_message=(
                # Non-cryptographic choice only varies
                # harmless capability-response wording.
                random.choice(  # nosec B311
                    CAPABILITY_RESPONSES
                )
            ),
        )


    # --------------------------------------------------------
    # Continue to grounded semantic AI classification
    # --------------------------------------------------------

    return AIChatGuardResult(
        is_valid=True,

        normalized_message=(
            normalized
        ),
    )


# ============================================================
# Internal helpers
# ============================================================

def _normalize_message(
    message: str,
) -> str:
    """
    Collapse repeated whitespace and trim surrounding spaces.
    """

    return " ".join(
        message.split()
    )


def _normalize_for_intent(
    message: str,
) -> str:
    """
    Produce a case-insensitive representation for simple
    conversational intent matching.

    Harmless punctuation is ignored.
    """

    lowered = (
        message.casefold()
    )

    without_punctuation = re.sub(
        r"[^\w\s]",
        " ",
        lowered,
    )

    return " ".join(
        without_punctuation.split()
    )


def _invalid(
    normalized_message: str,
    *,
    reason: str,
) -> AIChatGuardResult:
    """
    Create a consistent invalid-question response.
    """

    return AIChatGuardResult(
        is_valid=False,

        normalized_message=(
            normalized_message
        ),

        reason=reason,

        response_message=(
            INVALID_QUESTION_RESPONSE
        ),
    )