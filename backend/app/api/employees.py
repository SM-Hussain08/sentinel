from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models import Employee
from app.schemas import EmployeeRead


router = APIRouter(
    prefix="/employees",
    tags=["Employees"],
)


@router.get(
    "",
    response_model=list[EmployeeRead],
)
def list_employees(
    db: Session = Depends(get_db),
) -> list[Employee]:
    """
    Return all simulated employees currently stored in SENTINEL.

    Employees represent the behavioral baseline used by the simulator
    and anomaly-detection pipeline.
    """

    statement = (
        select(Employee)
        .order_by(Employee.user_id)
    )

    employees = db.scalars(statement).all()

    return list(employees)