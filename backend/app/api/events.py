from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import Event
from app.schemas import EventRead


router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


@router.get(
    "",
    response_model=list[EventRead],
)
def list_events(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
) -> list[Event]:
    """
    Return the newest security events.

    The limit prevents the dashboard from requesting an unnecessarily
    large number of events at once.
    """

    statement = (
        select(Event)
        .order_by(Event.timestamp.desc())
        .limit(limit)
    )

    events = db.scalars(statement).all()

    return list(events)


@router.get(
    "/{event_id}",
    response_model=EventRead,
)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
) -> Event:
    """
    Return one security event using its public SENTINEL event ID.
    """

    statement = select(Event).where(
        Event.event_id == event_id
    )

    event = db.scalar(statement)

    if event is None:
        raise HTTPException(
            status_code=404,
            detail=f"Event '{event_id}' was not found.",
        )

    return event