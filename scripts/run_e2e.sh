#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.e2e.yml"

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

echo
echo "============================================================"
echo " SENTINEL — Full End-to-End Regression"
echo "============================================================"
echo

cd "${ROOT_DIR}"

echo "[1/8] Validating E2E Docker Compose configuration..."
compose config >/dev/null
echo "      OK"

echo
echo "[2/8] Resetting the isolated SENTINEL E2E environment..."
echo "      This removes E2E containers only."
echo "      No production database or Docker volume is touched."
compose down --remove-orphans

echo
echo "[3/8] Building E2E application and browser-test images..."
compose build \
  e2e-backend \
  e2e-event-processor \
  e2e-frontend \
  e2e-playwright

echo
echo "[4/8] Starting isolated E2E runtime..."
compose up -d \
  e2e-postgres \
  e2e-backend \
  e2e-event-processor \
  e2e-frontend

echo
echo "[5/8] Waiting for the production-style frontend gateway..."

FRONTEND_READY=false

for attempt in $(seq 1 60); do
  FRONTEND_CONTAINER="$(compose ps -q e2e-frontend)"

  if [ -n "${FRONTEND_CONTAINER}" ]; then
    FRONTEND_HEALTH="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
        "${FRONTEND_CONTAINER}" \
        2>/dev/null || true
    )"

    if [ "${FRONTEND_HEALTH}" = "healthy" ]; then
      FRONTEND_READY=true
      break
    fi
  fi

  echo "      Waiting for frontend health... (${attempt}/60)"
  sleep 1
done

if [ "${FRONTEND_READY}" != "true" ]; then
  echo
  echo "ERROR: E2E frontend did not become healthy."
  echo
  compose ps
  exit 1
fi

echo "      Frontend gateway is healthy."

echo
echo "[6/8] Waiting for the event processor activation boundary..."

PROCESSOR_READY=false

for attempt in $(seq 1 60); do
  if compose exec -T e2e-backend python - <<'PY'
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen(
        "http://127.0.0.1:8000/api/v1/operations/status",
        timeout=3,
    ) as response:
        payload = json.load(response)

    sentinel = payload.get("sentinel") or {}

    ready = (
        sentinel.get("operational") is True
        and sentinel.get("health") == "HEALTHY"
        and sentinel.get("status") == "running"
        and sentinel.get("worker_id") == "processor-e2e"
    )

    sys.exit(0 if ready else 1)

except Exception:
    sys.exit(1)
PY
  then
    PROCESSOR_READY=true
    break
  fi

  echo "      Waiting for processor heartbeat... (${attempt}/60)"
  sleep 1
done

if [ "${PROCESSOR_READY}" != "true" ]; then
  echo
  echo "ERROR: E2E event processor did not become operational."
  echo
  compose ps
  echo
  compose logs --tail=100 e2e-event-processor
  exit 1
fi

echo "      Event processor is active."

echo
echo "[7/8] Seeding deterministic processor-backed E2E events..."

compose exec -T \
  e2e-backend \
  python /app/scripts/seed_e2e.py

echo
echo "      Waiting for scoring and incident correlation..."

PIPELINE_READY=false

for attempt in $(seq 1 90); do
  if compose exec -T e2e-backend python - <<'PY'
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen(
        "http://127.0.0.1:8000/api/v1/operations/status",
        timeout=3,
    ) as response:
        payload = json.load(response)

    sentinel = payload.get("sentinel") or {}
    counters = sentinel.get("counters") or {}

    ready = (
        sentinel.get("operational") is True
        and sentinel.get("health") == "HEALTHY"
        and sentinel.get("status") == "running"
        and counters.get("events_processed", 0) >= 5
        and counters.get("scores_created", 0) >= 5
        and counters.get("incidents_created", 0) >= 1
        and counters.get("incidents_updated", 0) >= 2
        and counters.get("live_backlog", -1) == 0
        and sentinel.get("last_error") is None
    )

    sys.exit(0 if ready else 1)

except Exception:
    sys.exit(1)
PY
  then
    PIPELINE_READY=true
    break
  fi

  echo "      Waiting for processor-backed intelligence... (${attempt}/90)"
  sleep 1
done

if [ "${PIPELINE_READY}" != "true" ]; then
  echo
  echo "ERROR: Processor did not complete the deterministic E2E scenario."
  echo
  compose ps
  echo
  compose logs --tail=150 e2e-event-processor
  exit 1
fi

echo "      Processor-backed anomaly scoring and incident correlation complete."

echo
echo "[8/8] Running Dockerized Playwright regression..."
echo

compose run --rm e2e-playwright

echo
echo "============================================================"
echo " SENTINEL E2E REGRESSION PASSED"
echo "============================================================"
echo
echo "Validated:"
echo "  - isolated PostgreSQL E2E database"
echo "  - production backend image"
echo "  - always-on event processor"
echo "  - real feature engineering and Isolation Forest scoring"
echo "  - deterministic incident correlation"
echo "  - production Nginx gateway"
echo "  - React SOC workspace"
echo "  - Dockerized Chromium / Playwright journeys"
echo
