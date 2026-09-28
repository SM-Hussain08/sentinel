SENTINEL — Phase 10 README / Release Notes
===========================================

Phase 10 focused on production hardening, automated testing,
CI/CD, MLOps governance, security automation, release engineering,
and final v1.0.0 release-candidate validation.

Product Release
---------------
SENTINEL product version: 1.0.0
Expected Git tag: v1.0.0

Independent component versions:
- Isolation Forest detector: 1.2
- Event Processor runtime: 1.0
- Incident correlation: 1.0
- Deterministic investigation: 1.0
- Feature schema: 1.0

These component versions intentionally remain independent from
the SENTINEL application release version.


1. Production Packaging and Runtime Hardening
---------------------------------------------

Production frontend:
- React application is compiled through a multi-stage Docker build.
- Nginx serves the production frontend.
- Nginx provides SPA fallback for React BrowserRouter deep links.
- /api/ requests are reverse proxied to FastAPI.
- /healthz provides a lightweight frontend/container health endpoint.
- Fingerprinted static assets receive long-lived immutable caching.
- SPA HTML is served with no-cache semantics.
- Nginx server tokens are disabled.

Backend:
- Production FastAPI image uses Python 3.14 slim.
- Application runs as a dedicated non-root sentinel user.
- Runtime pip, pip3, and ensurepip are removed after dependency
  installation.
- Production model governance validation runs during image build.
- Backend health verification checks both API and PostgreSQL access.

Docker / Compose:
- PostgreSQL 17 Alpine is used.
- Backend and PostgreSQL are not published directly to the host in
  production.
- The frontend is the production gateway.
- Service healthchecks and dependency ordering are defined.
- Strong PostgreSQL credentials are required through environment
  configuration.
- Weak/default production database passwords are not accepted.
- Runtime network exposure is intentionally minimized.


2. Backend Automated Testing
----------------------------

Backend test environment:
- Completely isolated PostgreSQL test database.
- Separate docker-compose.test.yml.
- Separate backend/Dockerfile.test.
- Alembic migrations execute against the isolated test database.
- Production data is never used by the test suite.

Final Phase 10 backend regression:
- 313 tests passed.
- 1 known Starlette/httpx deprecation warning.
- Total coverage: 93.90%.
- Required minimum coverage: 90%.

Coverage includes:
- API endpoints
- anomaly scoring
- feature engineering
- incident correlation
- incident persistence
- deterministic investigation
- event processor runtime
- simulator runtime state
- AI evidence and prompt safety
- model governance
- benchmark provenance-related contracts


3. Frontend Automated Testing
-----------------------------

Frontend test environment:
- Vitest
- React Testing Library
- jsdom
- V8 coverage
- Separate frontend/Dockerfile.test
- Separate docker-compose.frontend-test.yml

Final Phase 10 frontend regression:
- 53 test files passed.
- 475 tests passed.

Coverage:
- Statements: 91.30%
- Branches: 85.91%
- Functions: 96.19%
- Lines: 91.30%

Configured minimum thresholds:
- Statements >= 90%
- Branches >= 80%
- Functions >= 90%
- Lines >= 90%

Coverage includes:
- SOC overview
- incidents
- deterministic investigation
- anomaly intelligence
- employee investigation
- model workspace
- simulation workspace
- architecture/runtime telemetry
- Local AI graceful degradation
- navigation
- filtering
- pagination
- accessibility-related behavior
- API client behavior


4. Full Integration and End-to-End Testing
------------------------------------------

A fully isolated production-style E2E environment is implemented with:
- docker-compose.e2e.yml
- scripts/run_e2e.sh
- scripts/seed_e2e.py
- frontend/Dockerfile.e2e
- Playwright + Chromium

The E2E stack uses:
- isolated PostgreSQL
- production backend image
- always-on Event Processor
- real feature engineering
- real Isolation Forest scoring
- deterministic incident correlation
- production Nginx frontend gateway
- real React SOC workspace

Deterministic E2E seed:
- Employee: e2e_user_001
- Events: 5
- First event: E2E-EVT-001
- Last event: E2E-EVT-005

Before browser tests execute, the E2E runner verifies:
- Event Processor is operational.
- Processor worker identity is correct.
- At least 5 events are processed.
- At least 5 anomaly scores are created.
- At least 1 incident is created.
- At least 2 incident updates occur.
- Live backlog returns to zero.
- Processor reports no last_error.

Final E2E regression:
- 13 Playwright tests passed.

Validated browser journeys include:
- Nginx health
- Nginx -> FastAPI proxying
- production SPA loading
- deep-link routing
- processor-generated incident availability
- overview -> incident workflow
- deterministic investigation visibility
- incident -> employee navigation
- employee -> anomaly navigation
- anomaly -> incident correlation navigation
- production model lineage
- architecture/runtime intelligence
- graceful degradation when Local AI or simulator is unavailable


5. GitHub Actions CI
--------------------

Phase 10 introduced the GitHub Actions CI pipeline.

Required CI jobs:
- Release Version
- Secret Scanning
- Dependency Security
- Static Security
- Container Security
- Model Governance
- Backend Tests
- Frontend Tests
- E2E Tests

The CI pipeline validates:
- canonical release version consistency
- secrets in Git history
- Python dependency vulnerabilities
- Node dependency vulnerabilities
- Python static security
- production container vulnerabilities
- governed model integrity
- backend correctness and coverage
- frontend correctness and coverage
- full deployed-stack browser journeys


6. MLOps and Production Model Governance
----------------------------------------

SENTINEL uses a governed production-model contract rather than loading
an arbitrary model file.

Selected production detector:
- Model: isolation-forest
- Version: 1.2
- Algorithm: IsolationForest
- Promotion status: production
- Experiment: V1
- Feature schema version: 1.0
- Feature count: 17
- Estimators: 300
- Threshold percentile: 0.99
- Random state: 42

Training/evaluation:
- Training rows: 1,952
- Evaluation rows: 3,951

Production artifact:
- sentinel_iforest_v1_2.joblib

Artifact SHA-256:
b1da87092683ff27ee5ae9004881a9f93def8cce315da4f36195d8153971497c

Governance checks enforce:
- selected detector identity
- production promotion status
- artifact filename
- artifact SHA-256 integrity
- canonical feature ordering
- preprocessing schema
- training configuration
- serialized estimator identity
- fitted training state
- sklearn estimator contract

Governance is enforced:
- through scripts/verify_model_governance.py
- during backend production image build
- at runtime model loading
- in automated tests
- in GitHub Actions CI

This prevents silent model drift, accidental artifact replacement,
feature-order mismatch, and loading an unapproved detector.


7. Benchmark Provenance
-----------------------

scripts/verify_benchmark_provenance.py validates that the selected
production model and benchmark evidence belong to the same canonical
experiment.

Canonical benchmark:
- Seed: 42
- Selected experiment: V1
- Production detector: isolation-forest v1.2
- Feature count: 17
- Training rows: 1,952
- Evaluation rows: 3,951
- Ground-truth batch: phase3_attack_batch_01

Cross-artifact validation includes:
- promoted model manifest
- selected-model evaluation
- model experiment comparison
- evaluation registry
- benchmark report
- incident evaluation
- canonical benchmark signature

Selected detector benchmark:
- Precision: 0.6614
- Recall: 0.9438
- F1: 0.7778
- False-positive rate: 0.01113

Incident evaluation:
- Precision: 0.6250
- Recall: 1.0000
- F1: 0.7692

Important interpretation:
SENTINEL anomaly scores represent historical percentile/risk relative
to learned behavior. They are not probabilities that an event is
malicious.


8. Security Automation
----------------------

Secret scanning:
- Gitleaks scans full Git history.

Python dependency security:
- pip-audit
- production requirements audited
- test requirements audited

Frontend dependency security:
- npm audit
- complete dependency tree
- production dependency tree
- high-severity threshold enforced in CI

Static security analysis:
- Bandit
- Phase 10 final result:
  Low: 0
  Medium: 0
  High: 0

Container security:
- Trivy
- HIGH and CRITICAL vulnerabilities fail CI.
- Unfixed vulnerabilities are excluded from the blocking policy.

Final production image vulnerability result:
- Backend fixed HIGH/CRITICAL vulnerabilities: 0
- Frontend fixed HIGH/CRITICAL vulnerabilities: 0

Additional hardening:
- backend runs as non-root
- production runtime package manager removed
- strong database password required
- PostgreSQL not host-published in production
- backend not host-published in production
- Nginx is the public gateway
- frontend Alpine libexpat receives runtime security upgrade


9. Release Engineering
----------------------

Canonical release version:
- root VERSION file
- backend/app/version.py
- frontend/package.json
- frontend/package-lock.json

scripts/verify_release_version.py ensures all release-version sources
match.

SENTINEL v1.0.0 OCI image metadata includes:
- image title
- image description
- image version
- project source
- vendor

Production image titles:
- SENTINEL Backend
- SENTINEL Frontend

CHANGELOG.md documents the v1.0.0 release.

Expected final tag:
v1.0.0


10. Fresh-System Release Candidate Regression
---------------------------------------------

Phase 10 concluded with a completely isolated release-candidate
workspace created outside the normal repository runtime.

Fresh-system validation included:
- clean RC workspace
- fresh .env configuration
- Docker Compose configuration validation
- --pull / --no-cache production backend image build
- --pull / --no-cache production frontend image build
- OCI metadata validation
- backend package-manager hardening verification
- backend runtime dependency imports
- fresh PostgreSQL data directory
- full Alembic migration chain
- FastAPI startup
- Event Processor startup
- production model preflight
- Nginx startup
- React frontend HTTP verification
- Nginx -> FastAPI proxy verification
- SPA deep-link verification
- functional operational API smoke testing
- model telemetry verification
- backend full regression
- frontend full regression
- Dockerized E2E regression

Release-candidate runtime confirmed:
- Event Processor operational: true
- Event Processor health: HEALTHY
- Event Processor runtime version: 1.0
- Detector: isolation-forest
- Detector version: 1.2
- last_error: null
- live backlog: 0

The normal SENTINEL deployment and the release-candidate deployment
were run concurrently to prove isolation.

After validation, all temporary RC/test environments were removed
without deleting Docker volumes belonging to the normal deployment.

The normal SENTINEL stack remained healthy after cleanup.


11. Defects Caught During Final Regression
------------------------------------------

The fresh release-candidate regression detected two stale version
contracts before release:

1. FastAPI root endpoint returned the legacy version 0.1.0 even though
   the canonical SENTINEL release was 1.0.0.

   Fix:
   - root endpoint now uses SENTINEL_VERSION.

2. backend/tests/api/test_system.py still expected the legacy 0.1.0
   root response.

   Fix:
   - test contract updated to expect SENTINEL 1.0.0.

The complete backend regression was rerun after both fixes and passed.


12. Phase 10 Final Verification
-------------------------------

Backend:
- 313 passed
- Coverage: 93.90%

Frontend:
- 53 test files passed
- 475 tests passed
- Statements: 91.30%
- Branches: 85.91%
- Functions: 96.19%
- Lines: 91.30%

E2E:
- 13 Playwright tests passed

Release validation:
- SENTINEL version contract: PASS
- Model governance: PASS
- Benchmark provenance: PASS
- git diff --check: PASS

Production release candidate:
- SENTINEL application: 1.0.0
- Isolation Forest detector: 1.2
- Event Processor: 1.0

Phase 10 result:
SENTINEL is release-candidate validated for v1.0.0.
