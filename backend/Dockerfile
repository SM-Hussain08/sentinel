FROM python:3.14-slim

ARG SENTINEL_VERSION=1.0.0

LABEL org.opencontainers.image.title="SENTINEL Backend" \
      org.opencontainers.image.description="AI-powered anomaly detection and incident intelligence backend for SENTINEL" \
      org.opencontainers.image.version="${SENTINEL_VERSION}" \
      org.opencontainers.image.source="https://github.com/SM-Hussain08/sentinel" \
      org.opencontainers.image.vendor="SENTINEL"

# ------------------------------------------------------------
# Unprivileged runtime identity
# ------------------------------------------------------------
#
# The image is shared by several SENTINEL services. Core
# runtime services explicitly opt into this account through
# Docker Compose, while utility/benchmark profiles can retain
# their existing user contracts.
# ------------------------------------------------------------

RUN groupadd \
        --gid 10001 \
        sentinel \
    && useradd \
        --uid 10001 \
        --gid 10001 \
        --no-create-home \
        --shell /usr/sbin/nologin \
        sentinel

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:/app/backend

WORKDIR /app

# ------------------------------------------------------------
# Python dependencies
# ------------------------------------------------------------

COPY backend/requirements.txt /app/backend/requirements.txt

RUN pip install \
    --no-cache-dir \
    --upgrade pip \
    && pip install \
    --no-cache-dir \
    -r /app/backend/requirements.txt

# ------------------------------------------------------------
# Application + production model
# ------------------------------------------------------------

COPY backend /app/backend
COPY ml_engine /app/ml_engine

# ------------------------------------------------------------
# Production model governance preflight
# ------------------------------------------------------------
#
# The image must not be produced unless the promoted model
# passes SENTINEL's canonical governance contract.
#
# This validates:
# - selected detector identity/version
# - production promotion status
# - manifest schema
# - artifact filename
# - SHA-256 integrity
# - feature ordering
# - preprocessing schema
# - training configuration
# - serialized detector metadata
# - fitted training state
# - underlying sklearn estimator contract
#
# No database connection is required for this check.
# ------------------------------------------------------------

RUN PYTHONPATH="/app/backend:/app" python - <<'PY'
from app.model_governance import (
    validate_model_governance,
)

report = validate_model_governance()

print(
    "Selected production model build validation: PASS - "
    f"{report.model_name} "
    f"v{report.model_version} "
    f"sha256={report.artifact_sha256}"
)
PY

# ------------------------------------------------------------
# Runtime package-manager hardening
# ------------------------------------------------------------
#
# Dependency installation is complete and the production model
# governance preflight has passed. The running SENTINEL image
# does not require pip or ensurepip.
#
# Removing package-management tooling:
# - reduces runtime attack surface
# - prevents package installation inside the running container
# - removes pip-vendored dependencies from vulnerability scans
# ------------------------------------------------------------

RUN rm -rf \
        /usr/local/lib/python3.14/site-packages/pip \
        /usr/local/lib/python3.14/site-packages/pip-*.dist-info \
        /usr/local/lib/python3.14/ensurepip \
    && rm -f \
        /usr/local/bin/pip \
        /usr/local/bin/pip3 \
        /usr/local/bin/pip3.14

# ------------------------------------------------------------
# Remaining runtime assets
# ------------------------------------------------------------

COPY simulator /app/simulator
COPY scripts /app/scripts

WORKDIR /app/backend

EXPOSE 8000

CMD [ "sh", "-c", "alembic -c alembic.ini upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000" ]
