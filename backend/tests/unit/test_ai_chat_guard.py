"""
Unit tests for SENTINEL's deterministic AI chat input guard.

These tests do not invoke Ollama or any generative model.
"""

from __future__ import annotations

import pytest

from app.services.ai_chat_guard import (
    CAPABILITY_RESPONSES,
    GREETING_RESPONSES,
    INVALID_QUESTION_RESPONSE,
    validate_ai_chat_message,
)


@pytest.mark.unit
def test_empty_message_is_rejected() -> None:
    result = validate_ai_chat_message(
        "   "
    )

    assert result.is_valid is False
    assert result.reason == "empty_message"

    assert (
        result.response_message
        == INVALID_QUESTION_RESPONSE
    )


@pytest.mark.unit
def test_symbols_only_message_is_rejected() -> None:
    result = validate_ai_chat_message(
        "!!! ??? ---"
    )

    assert result.is_valid is False
    assert result.reason == "symbols_only"


@pytest.mark.unit
def test_numbers_only_message_is_rejected() -> None:
    result = validate_ai_chat_message(
        "123456"
    )

    assert result.is_valid is False
    assert result.reason == "numbers_only"


@pytest.mark.unit
def test_repeated_character_message_is_rejected() -> None:
    result = validate_ai_chat_message(
        "aaaaaa"
    )

    assert result.is_valid is False

    assert (
        result.reason
        == "repeated_character"
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    [
        "asdf",
        "qwerty",
        "zxcvbnm",
        "hjkl",
    ],
)
def test_keyboard_mash_is_rejected(
    message: str,
) -> None:
    result = validate_ai_chat_message(
        message
    )

    assert result.is_valid is False
    assert result.reason == "keyboard_mash"


@pytest.mark.unit
def test_greeting_is_handled_without_ai_generation() -> None:
    result = validate_ai_chat_message(
        "  HELLO!!!  "
    )

    assert result.is_valid is True
    assert result.reason == "greeting"

    assert (
        result.normalized_message
        == "HELLO!!!"
    )

    assert (
        result.response_message
        in GREETING_RESPONSES
    )


@pytest.mark.unit
def test_capability_question_is_handled_locally() -> None:
    result = validate_ai_chat_message(
        "What CAN you do?"
    )

    assert result.is_valid is True

    assert (
        result.reason
        == "capability_question"
    )

    assert (
        result.response_message
        in CAPABILITY_RESPONSES
    )


@pytest.mark.unit
def test_repeated_whitespace_is_normalized() -> None:
    result = validate_ai_chat_message(
        "What    happened   here?"
    )

    assert result.is_valid is True

    assert (
        result.normalized_message
        == "What happened here?"
    )


@pytest.mark.unit
def test_normal_incident_question_passes_to_semantic_layer() -> None:
    result = validate_ai_chat_message(
        "Why was this incident considered suspicious?"
    )

    assert result.is_valid is True
    assert result.reason is None
    assert result.response_message is None

    assert (
        result.normalized_message
        == (
            "Why was this incident "
            "considered suspicious?"
        )
    )