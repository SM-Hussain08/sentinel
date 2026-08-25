from fastapi import FastAPI
from sqlalchemy import text

from app.config import settings
from app.database.session import engine


app = FastAPI(
    title="SENTINEL API",
    description=(
        "Backend API for the SENTINEL anomaly detection "
        "and incident intelligence platform."
    ),
    version="0.1.0",
)


@app.get("/")
def root():
    """
    Basic root endpoint.
    """

    return {
        "service": "SENTINEL API",
        "message": "SENTINEL backend is running.",
    }


@app.get("/health")
def health_check():
    """
    Verify that the API and PostgreSQL database are reachable.
    """

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "service": settings.app_name,
        "database": "connected",
    }