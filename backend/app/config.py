"""
Application configuration for SENTINEL.

Settings are loaded from environment variables and the repository
root .env file during local development.

This module also contains the canonical configuration for the optional
local Ollama AI investigation layer introduced in Phase 7.
"""

from pathlib import Path

from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


# ============================================================
# Project paths
# ============================================================

# SENTINEL repository root:
#
# sentinel/
# ├── .env
# └── backend/
#     └── app/
#         └── config.py
#
PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)


# ============================================================
# Application settings
# ============================================================

class Settings(BaseSettings):
    """
    SENTINEL application configuration.

    Local development values are loaded from the repository root
    .env file. Environment variables can override those values.

    Ollama is intentionally optional. SENTINEL's ML detection,
    correlation, and deterministic investigation pipeline remain
    operational even when the local AI service is unavailable.
    """

    # --------------------------------------------------------
    # Application
    # --------------------------------------------------------

    app_name: str = (
        "SENTINEL"
    )

    app_env: str = (
        "development"
    )

    debug: bool = True


    # --------------------------------------------------------
    # Backend
    # --------------------------------------------------------

    backend_host: str = (
        "0.0.0.0"
    )

    backend_port: int = 8000


    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    database_url: str


    # --------------------------------------------------------
    # Local AI / Ollama
    # --------------------------------------------------------

    # Allows the entire AI layer to be disabled without affecting
    # SENTINEL's core security pipeline.
    ollama_enabled: bool = True

    # Ollama's default local HTTP API.
    ollama_base_url: str = (
        "http://127.0.0.1:11434"
    )

    # Selected after local Phase 7 benchmarking.
    ollama_model: str = (
        "llama3.2:3b"
    )

    # Our laptop benchmark produced an investigation brief in
    # approximately 20 seconds. A larger timeout gives the local
    # CPU model enough room while still preventing endless waits.
    ollama_timeout_seconds: float = (
        90.0
    )

    # Low temperature improves reproducibility and grounding.
    ollama_temperature: float = (
        0.0
    )

    # Keep analyst briefs concise enough for the dashboard.
    ollama_num_predict: int = (
        280
    )

    # Use a practical context size for our evidence packages rather
    # than the maximum context advertised by a model.
    ollama_context_window: int = (
        4096
    )

    # Keep the model loaded for a while after generation so repeated
    # demo requests avoid paying the full cold-start cost.
    ollama_keep_alive: str = (
        "10m"
    )


    # --------------------------------------------------------
    # Pydantic settings configuration
    # --------------------------------------------------------

    model_config = SettingsConfigDict(
        env_file=(
            PROJECT_ROOT
            / ".env"
        ),
        env_file_encoding=(
            "utf-8"
        ),
        extra="ignore",
    )


settings = Settings()