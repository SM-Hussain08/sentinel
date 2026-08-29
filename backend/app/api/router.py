from fastapi import APIRouter

from app.api.employees import router as employees_router
from app.api.events import router as events_router


api_router = APIRouter(
    prefix="/api/v1",
)


api_router.include_router(employees_router)
api_router.include_router(events_router)