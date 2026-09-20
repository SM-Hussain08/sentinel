FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:/app/backend

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

RUN pip install \
    --no-cache-dir \
    --upgrade pip \
    && pip install \
    --no-cache-dir \
    -r /app/backend/requirements.txt

COPY backend /app/backend
COPY ml_engine /app/ml_engine

RUN PYTHONPATH="/app/backend:/app" python -c \
    "from app.selected_detector import SELECTED_DETECTOR, SELECTED_MODEL_PATH; from ml_engine.models import SentinelIsolationForest; assert SELECTED_MODEL_PATH.exists(), f'Selected model artifact missing: {SELECTED_MODEL_PATH}'; detector = SentinelIsolationForest.load(SELECTED_MODEL_PATH); assert detector.model_name == SELECTED_DETECTOR.name, f'Model name mismatch: expected {SELECTED_DETECTOR.name}, got {detector.model_name}'; assert detector.model_version == SELECTED_DETECTOR.version, f'Model version mismatch: expected {SELECTED_DETECTOR.version}, got {detector.model_version}'; print(f'Selected production model build validation: PASS - {detector.model_name} v{detector.model_version}')"

COPY simulator /app/simulator
COPY scripts /app/scripts

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "alembic -c alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
