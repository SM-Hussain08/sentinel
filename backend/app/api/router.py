from fastapi import APIRouter

from app.api import ai
from app.api import anomaly_feed
from app.api import evaluation
from app.api import incidents
from app.api import ml
from app.api import operations

from app.api.anomalies import (
    router as anomalies_router,
)

from app.api.employees import (
    router as employees_router,
)

from app.api.events import (
    router as events_router,
)


api_router = APIRouter(
    prefix="/api/v1",
)


api_router.include_router(
    employees_router
)

api_router.include_router(
    events_router
)

api_router.include_router(
    anomalies_router
)

api_router.include_router(
    ml.router
)

api_router.include_router(
    incidents.router
)

api_router.include_router(
    evaluation.router
)

api_router.include_router(
    anomaly_feed.router
)

api_router.include_router(
    operations.router
)

api_router.include_router(
    ai.router
)