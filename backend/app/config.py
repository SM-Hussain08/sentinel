from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# SENTINEL repository root:
# sentinel/backend/app/config.py
#        ↑ backend
#        ↑ sentinel
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.

    During local development, values are read from the root .env file.
    """

    app_name: str = "SENTINEL"
    app_env: str = "development"
    debug: bool = True

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    database_url: str

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()