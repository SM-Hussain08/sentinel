# Changelog

All notable changes to SENTINEL are documented in this file.

The format follows a release-oriented changelog structure and
SENTINEL application releases use Semantic Versioning.

---

## [1.0.0] - 2026-09-26

### Overview

SENTINEL v1.0.0 is the first production-ready release of the
AI-powered anomaly detection and incident intelligence platform.

The release delivers a complete security operations workflow from
event ingestion through anomaly scoring, deterministic incident
correlation, investigation, visualization, simulation, benchmarking,
testing, governance, and release automation.

### Platform

- FastAPI backend for security operations and investigation APIs.
- React-based SOC dashboard served through production Nginx.
- PostgreSQL persistence for events, anomaly scores, incidents,
  runtime state, simulation data, and investigation provenance.
- Always-on Event Processor for incremental processing of incoming
  security events.
- Docker Compose based local and production-oriented deployment.
- Unprivileged runtime identities for core application services.

### Anomaly Detection

- Production Isolation Forest anomaly detector.
- Selected detector lineage: Isolation Forest v1.2.
- Seventeen-feature anomaly detection schema.
- Historical percentile/risk based anomaly scoring.
- Incremental feature engineering for event-stream processing.
- Explicit model artifact and manifest governance.
- SHA-256 artifact integrity verification.
- Exact feature-order and preprocessing validation.
- Serialized detector metadata validation.
- Production model governance preflight during backend image builds.

### Incident Intelligence

- Deterministic multi-signal incident correlation.
- Incident persistence with detector and correlation provenance.
- Deterministic investigation pipeline independent of LLM
  availability.
- Investigation engine lineage tracking.
- Incident timelines and evidence-oriented analysis.
- Optional local Ollama-assisted explanation and chat workflows.

### Event Processing

- Stateful Event Processor runtime.
- Persistent processor runtime state.
- Explicit processor version tracking.
- Selected detector provenance recorded during event processing.
- Incremental scoring and incident-generation workflow.
- Backfill support for historical events.

### Simulation

- Independent corporate security event simulator.
- Simulator writes ordinary operational Event records only.
- Simulation runtime and worker-state tracking.
- Operational inference remains isolated from simulator ground truth.
- Attack scenarios remain separated from model decision logic.

### Benchmarking

- Isolated benchmark environment with a separate PostgreSQL database.
- Private benchmark ground truth unavailable to operational inference.
- Deterministic benchmark seeding.
- Model-level anomaly detection evaluation.
- Incident-level correlation evaluation.
- Benchmark provenance verification.
- Selected production benchmark result:
  - Precision: 0.6614
  - Recall: 0.9438
  - F1 score: 0.7778
  - False-positive rate: 0.01113
- Incident correlation benchmark:
  - Precision: 0.6250
  - Recall: 1.0000
  - F1 score: 0.7692

### Testing

- Isolated backend pytest environment.
- 313 backend tests.
- Backend coverage above 90 percent.
- Frontend Vitest test suite.
- 475 frontend tests.
- Frontend coverage thresholds enforced.
- Integration and end-to-end browser testing with Playwright.
- Real Event Processor exercised during E2E testing.
- Dedicated isolated PostgreSQL databases for backend and E2E tests.
- Operational development database is not used by automated tests.

### CI / DevOps

- GitHub Actions continuous integration workflow.
- Backend test gate.
- Frontend build, lint, and coverage gates.
- Integration and E2E regression gate.
- Model governance gate.
- Benchmark provenance gate.
- Release-version consistency gate.
- Secret-scanning gate.
- Dependency vulnerability gate.
- Static security analysis gate.
- Container vulnerability gate.

### MLOps / Model Governance

- Canonical production model manifest.
- Selected detector configuration enforcement.
- Artifact checksum validation.
- Feature schema and preprocessing contract enforcement.
- Training configuration validation.
- Runtime detector metadata validation.
- CI enforcement of model governance.
- Benchmark provenance consistency checks.
- Build-time governance validation before production backend image
  creation.

### Security

- Gitleaks secret scanning across Git history.
- pip-audit scanning for backend production dependencies.
- pip-audit scanning for backend test dependencies.
- npm audit scanning for frontend dependencies.
- Bandit static security analysis.
- Trivy production image vulnerability scanning.
- CI failure on fixable HIGH or CRITICAL image vulnerabilities.
- Production backend runtime package-manager removal.
- Runtime attack-surface reduction.
- Strong-password requirement for operational PostgreSQL
  configuration.
- Safer backend default bind address outside container deployment.
- Runtime Nginx package security update for libexpat.

### Release Engineering

- Canonical repository VERSION file.
- SENTINEL application version: 1.0.0.
- FastAPI application metadata synchronized with the release version.
- Frontend package metadata synchronized with the release version.
- Automated release-version consistency validation.
- OCI-standard metadata on backend and frontend production images.
- CI container builds consume the canonical release version.
- Expected Git and GitHub release tag: v1.0.0.

### Independent Component Versions

The SENTINEL application release version is intentionally independent
from internal component lineage identifiers.

For v1.0.0:

- SENTINEL application release: 1.0.0
- Isolation Forest detector: 1.2
- Event Processor runtime: 1.0
- Correlation engine: 1.0
- Investigation engine: 1.0
- Feature schema: 1.0

These component versions are not required to match the overall
SENTINEL release version.
