from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import api_router
from app.config import settings
from app.database.session import engine


app = FastAPI(
    title="SENTINEL API",
    description=(
        "AI-powered anomaly detection and incident intelligence "
        "for a simulated corporate environment."
    ),
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
#
# During local development, the React frontend runs on port 5173
# while FastAPI runs on port 8000.
#
# CORS allows the browser-based frontend to communicate safely
# with the backend API.
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router)


@app.get(
    "/",
    tags=["System"],
)
def root():
    """
    Basic SENTINEL API information.
    """

    return {
        "service": "SENTINEL API",
        "version": "0.1.0",
        "message": "SENTINEL backend is running.",
    }


@app.get(
    "/health",
    tags=["System"],
)
def health_check():
    """
    Verify that both the API and PostgreSQL database are operational.
    """

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "service": settings.app_name,
        "database": "connected",
    }