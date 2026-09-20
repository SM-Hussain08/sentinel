SENTINEL — PHASE 9 README NOTES
Enterprise Simulation, Operational Runtime, Identity Intelligence,
Architecture Hardening, Frontend Expansion, and Final Regression

======================================================================
PURPOSE OF THIS FILE
======================================================================

These are temporary Phase 9 notes intended to preserve the architectural,
technical, product, benchmark, testing, and UX decisions made during Phase 9.

They are NOT the final project README.

The final README will be rewritten and consolidated during Phase 10 using:
- the existing project history
- Phase 7 README notes
- Phase 8 README notes
- these Phase 9 notes
- final production/testing/release work completed in Phase 10


======================================================================
PHASE 9 OVERVIEW
======================================================================

Phase 9 began as the "Enterprise Simulation & Employee Management" phase,
but ultimately became one of the most substantial architectural phases of
the SENTINEL project.

It significantly changed SENTINEL from a strong security analytics prototype
into a more complete operational security intelligence platform.

The phase went beyond the original simulation-focused plan and added:

- a reproducible, isolated ML benchmark workflow
- a dedicated production ML scoring boundary
- incremental feature generation for live events
- persistent always-on event processing
- live synthetic enterprise activity
- private simulation/evaluation ground truth
- strict separation between simulator and detection pipeline
- incremental incident correlation
- persistent processor runtime state
- realistic employee generation
- employee/identity intelligence APIs
- employee overview and detail interfaces
- operational runtime-status APIs
- simulation operations visibility
- a dedicated system Architecture page
- redesigned sidebar/navigation structure
- frontend status integration and UX polish
- Docker service/profile architecture
- fresh-database startup testing
- repository/script cleanup
- benchmark/live provenance separation
- extensive backend, ML, Docker, frontend, and GT-isolation regression testing

A useful summary of the final architecture is:

    The simulator generates the world.
    SENTINEL independently observes, scores, correlates, and investigates it.

And the distinction between SENTINEL's two synthetic workflows is:

    The benchmark proves SENTINEL.
    The live simulator demonstrates SENTINEL.


======================================================================
9.1 — PHASE 9 ARCHITECTURE AUDIT
======================================================================

Phase 9 began with a detailed audit of the existing system.

The audit identified several important architectural requirements:

1. The simulator must not directly trigger anomaly detection.
2. Ground truth must never be used by operational inference.
3. The controlled benchmark and live simulator must have different purposes.
4. Live event processing must happen independently and continuously.
5. Existing historical operational data must not be destroyed.
6. The selected ML detector must have one canonical production boundary.
7. Incident creation must reuse production correlation/persistence services.
8. The frontend must remain observational rather than becoming a simulation
   control panel.
9. Docker Compose must support a normal production-like stack plus optional
   profiles for simulation, benchmark, and utility jobs.

The Phase 9 architecture was therefore designed around separation of concerns
rather than simply adding more synthetic data.


======================================================================
9.2 — CANONICAL PRODUCTION ML SCORING
======================================================================

A dedicated operational ML scoring service was introduced:

    backend/app/services/ml_scoring.py

This became the canonical production boundary for:

- selected model loading
- incremental scoring
- batch/backfill scoring
- anomaly score persistence
- detector lineage
- feature snapshot persistence
- risk classification

The selected production detector is:

    Detector: isolation-forest
    Version: 1.2
    Selected experiment: V1
    Feature count: 17
    Trees: 300
    Random state: 42
    Alert threshold: 99th historical percentile

The anomaly score remains a historical percentile-style anomaly score.

It is NOT presented as a probability that an event is malicious.


======================================================================
9.3 — INCREMENTAL FEATURE ENGINEERING
======================================================================

Feature engineering was refactored so batch and live scoring share the same
feature construction logic.

Important code:

    ml_engine/features/event_features.py

The shared implementation supports:

1. Historical/batch feature generation
2. Incremental event feature generation

The live method:

    build_event_row(...)

uses prior observable employee activity and defaults to:

    include_evaluation_metadata=False

The selected V1 production feature set contains exactly 17 features and no
simulation or ground-truth fields.

V1 features:

- hour_sin
- hour_cos
- outside_work_hours
- source_ip_is_baseline
- remote_work_probability
- bytes_sent
- bytes_received
- total_bytes
- data_volume_ratio
- success
- failed_logins_10m
- events_5m
- file_events_30m
- network_events_5m
- unique_destinations_5m
- bytes_sent_30m
- bytes_received_30m

Ground-truth labels may optionally be attached to historical benchmark
dataframes for evaluation purposes only.

They are never part of the operational feature vector.


======================================================================
9.4 — REPRODUCIBLE CONTROLLED BENCHMARK
======================================================================

A dedicated benchmark orchestrator was created:

    scripts/run_benchmark.py

The benchmark is:

- deterministic
- controlled
- seed-based
- repeatable
- offline
- isolated from the operational database
- capable of evaluating ML and incident recovery end-to-end

Canonical benchmark seed:

    42

The benchmark workflow performs:

1. benchmark database reset
2. canonical employee generation
3. normal activity generation
4. controlled attack injection
5. dataset validation
6. feature generation
7. Isolation Forest V1 training/evaluation
8. Isolation Forest V2 training/evaluation
9. objective model comparison
10. selected production model training
11. benchmark event scoring
12. incident correlation
13. incident-level evaluation
14. evaluation registry generation
15. canonical result verification
16. benchmark report generation


======================================================================
9.4B — MODEL INTELLIGENCE UI
======================================================================

The Model page was expanded so the frontend clearly presents the controlled
evaluation methodology rather than implying that benchmark results are live
operational metrics.

The page communicates concepts including:

- Controlled
- Seed 42
- Reproducible
- Isolation Forest v1.2
- selected experiment
- feature count
- evaluation metrics
- comparison between V1 and V2
- benchmark provenance
- incident recovery

This improved the transparency and explainability of the ML system.


======================================================================
9.5 — BACKEND DOCKERIZATION
======================================================================

The backend was containerized with a production-oriented Dockerfile.

The backend container:

- contains backend application code
- contains required ML code
- contains the selected detector artifact
- runs Alembic migrations before API startup
- starts FastAPI/Uvicorn only after successful migration
- exposes health checks used by dependent services

The selected production model is baked into the backend image rather than
depending on a mutable runtime model mount.


======================================================================
9.6 — ISOLATED BENCHMARK DATABASE AND CONTAINER
======================================================================

The controlled benchmark received a dedicated PostgreSQL database and
container.

The benchmark database is completely separate from SENTINEL's operational
database.

This prevents controlled evaluation from:

- polluting live operational history
- changing processor state
- changing live incidents
- changing employee operational history

Benchmark services are exposed through the Docker Compose:

    benchmark

profile.

The benchmark runner owns its own migration and benchmark lifecycle.


======================================================================
9.7 — EMPLOYEE GENERATOR
======================================================================

A one-shot employee generator was created as a utility workflow.

The generator is additive and does not overwrite the existing workforce.

The enterprise population was expanded to approximately 300 operational
employees.

The workforce distribution was designed around departments and roles rather
than stereotypes.

Operational baseline distribution:

    Engineering          84  (28%)
    Sales                66  (22%)
    Finance              54  (18%)
    IT Operations        54  (18%)
    Human Resources      42  (14%)

Employee identity/context is localized for a Pakistani/Karachi corporate
environment, while behavior is driven by role, department, and configured
behavioral baselines.

The employee generator is exposed through the Docker Compose:

    utilities

profile.


======================================================================
9.8 — SIMULATION RUNTIME AND PRIVATE GROUND TRUTH
======================================================================

Persistent simulation runtime models were introduced.

Important concepts:

    SimulationRun
    SimulationGroundTruth

Simulation runs preserve:

- run identity
- runtime status
- seed
- start/stop timing
- worker identity
- runtime metrics
- configuration

Ground truth is stored separately from Event data.

The private ground-truth table exists only to evaluate known synthetic attack
campaigns and must never be treated as production evidence.


======================================================================
9.9 — REMOVE GROUND TRUTH FROM EVENT
======================================================================

Legacy simulation labels were removed from the Event schema.

Historical Event columns such as:

    is_injected_anomaly
    scenario_type

were removed through Alembic migration.

Ground truth is now stored only in:

    simulation_ground_truth

The operational Event represents observable telemetry only.


======================================================================
9.10 — LIVE SIMULATOR WORKER
======================================================================

A long-running simulator worker was introduced.

The simulator:

- generates ordinary enterprise activity
- manages simulated time
- activates employees dynamically
- can optionally inject attack campaigns
- writes Events to PostgreSQL
- records private truth separately
- does NOT call the ML scorer
- does NOT call incident correlation
- does NOT instruct SENTINEL to analyze an event

This architectural separation is essential.

The simulator generates activity.

SENTINEL independently detects and analyzes that activity.


======================================================================
9.11 — REALISTIC SCHEDULING AND SIMULATION CALIBRATION
======================================================================

The simulation engine was calibrated to create a more realistic evolving
enterprise environment.

It includes:

- simulated clock progression
- employee activity windows
- controlled active-user scheduling
- role-driven activity
- per-tick event limits
- scenario cooldowns
- optional concurrent campaigns
- configurable simulation speed
- configurable attack campaign rate

Attack rate configuration represents expected security scenario/campaign
injection frequency per simulated hour.

It is not intended to represent an observed production incident rate.

Typical modes include:

    normal      attack rate 0
    realistic   approximately 0.25 campaigns / simulated hour
    demo        approximately 1 campaign / simulated hour


======================================================================
9.12 — INCREMENTAL INCIDENT CORRELATION AND LINEAGE
======================================================================

Incident correlation was refactored for incremental operational use.

New anomaly scores can now update/create correlated incidents without running
an offline full-history incident script.

Incident provenance was strengthened.

Incidents persist:

    detector_name
    detector_version
    correlation_engine
    correlation_version

Current canonical lineage:

    isolation-forest
    detector version 1.2
    multi-signal-rules
    correlation version 1.0

A historical/current consistency audit was also performed to ensure
investigation and incident data reflect the detector actually responsible for
the incident rather than blindly using the currently selected detector.


======================================================================
9.12 / 9.13 — ALWAYS-ON SENTINEL EVENT PROCESSOR
======================================================================

One of the most important Phase 9 additions was the persistent always-on event
processor.

The event processor:

- runs independently of the simulator
- discovers newly committed Events
- constructs incremental features
- scores them with Isolation Forest v1.2
- persists AnomalyScore rows
- performs incremental incident correlation
- persists processor runtime state
- emits heartbeats
- tracks processing counters
- records errors
- preserves detector identity and version

Persistent processor identity:

    f3fe8b62-9d0d-4465-ab4e-fdbed0a64c30

Original processor activation boundary:

    2026-09-17 18:27:41.260256+00:00

This state was deliberately preserved throughout testing.

The processor intentionally does NOT automatically process historical events
from before its activation boundary.

Historical backfill is explicit and separate.

This preserves a clean distinction between:

    live processing
    explicit historical backfill


======================================================================
9.13 — DOCKERIZED EVENT PROCESSOR
======================================================================

The event processor became a normal always-on Docker Compose service.

Normal Docker Compose startup now starts exactly:

    postgres
    backend
    event-processor
    frontend

The event processor may be stopped/restarted independently.

Although Docker uses backend health as a startup/schema-ready ordering gate,
the processor is not logically dependent on the backend API for its
operational processing.

It communicates with PostgreSQL and performs its own processing workflow.


======================================================================
FINAL DOCKER COMPOSE SERVICE MODEL
======================================================================

Normal:

    postgres
    backend
    event-processor
    frontend

Optional profile: benchmark

    benchmark-postgres
    benchmark-runner

Optional profile: utilities

    employee-generator
    event-backfill

Optional profile: simulation

    simulator-worker

Local Ollama remains host-managed and optional.

The simulator is not part of the required core runtime.


======================================================================
9.14 — EMPLOYEE INTELLIGENCE APIs
======================================================================

Employee APIs were expanded beyond the original basic employee listing.

Existing compatibility endpoint was preserved:

    GET /api/v1/employees

Additional endpoints include:

    GET /api/v1/employees/directory
    GET /api/v1/employees/{user_id}
    GET /api/v1/employees/{user_id}/activity
    GET /api/v1/employees/summary

Employee intelligence includes:

- identity
- department
- role
- baseline working hours
- typical IP
- typical location
- login behavior baseline
- file behavior baseline
- transfer behavior baseline
- event count
- selected detector score count
- anomaly count
- elevated anomaly count
- critical count
- highest risk level
- correlated incidents
- recent activity

Security metrics use selected detector lineage rather than mixing historical
detectors.


======================================================================
9.15 — EMPLOYEES OVERVIEW
======================================================================

A dedicated Employees page was created.

It provides a SOC-style identity intelligence view with:

- employee directory
- filtering/search
- department information
- behavioral risk summaries
- anomaly indicators
- incident context
- links to employee investigations

This expanded SENTINEL beyond event-centric monitoring into identity-centric
security analysis.


======================================================================
9.16 — EMPLOYEE DETAIL WORKSPACE
======================================================================

A dedicated employee detail route was added:

    /employees/:userId

The page combines:

- identity profile
- department and role
- baseline behavior
- activity counts
- current risk information
- anomaly history
- incident relationships
- navigation into related investigations

This gives analysts a persistent entity-centric view of employee security
behavior.


======================================================================
9.17 — OPERATIONAL RUNTIME STATUS API
======================================================================

Persistent operational-status APIs were introduced:

    GET /api/v1/operations/status
    GET /api/v1/operations/processor
    GET /api/v1/operations/simulation

Runtime health values include:

    HEALTHY
    STALE
    STOPPED
    ERROR
    UNKNOWN

Processor status is determined from persistent database state and heartbeat
information.

The application does NOT require Docker socket access to determine runtime
health.

Processor runtime information includes:

- operational state
- worker identity
- worker version
- activated timestamp
- heartbeat
- detector lineage
- events processed
- scores created
- incidents created
- incidents updated
- live backlog
- last error

Simulator runtime status is treated separately from core SENTINEL health.


======================================================================
9.18 — SIMULATION OPERATIONS UI
======================================================================

A dedicated read-only Simulation page was added:

    /simulation

The frontend does not provide buttons to start or stop the simulator.

Simulation lifecycle remains external/operator controlled through Docker.

The page presents:

- simulator state
- simulation clock
- current run
- seed
- runtime duration
- simulated duration
- speed
- configuration
- employees loaded
- active employees
- generated events
- throughput
- observed incidents
- scenario configuration

The page clearly distinguishes:

    SENTINEL operational status

from:

    optional simulator status

Stopping the simulator therefore does not make the application appear
unhealthy.


======================================================================
9.19 — FRONTEND INFORMATION ARCHITECTURE AND POLISH
======================================================================

Phase 9 went beyond the original backend/simulation scope and substantially
polished the frontend.

Final sidebar structure:

    Overview
      Security operations

    Incidents
      Correlated investigations

    Anomalies
      Behavioral detection

    Employees
      Identity intelligence

    Model
      Detection intelligence

    Architecture
      System design

    Simulation
      Synthetic environment

A dedicated Architecture route was added:

    /architecture

The Architecture page explains the live architecture in product-facing form,
including:

- enterprise event sources
- PostgreSQL
- always-on event processor
- feature engineering
- Isolation Forest scoring
- anomaly persistence
- incident correlation
- deterministic investigation
- FastAPI
- React frontend
- optional local AI
- optional live simulation
- isolated controlled benchmark

The Overview page was also updated with runtime/system context.

The sidebar gained custom scrollbar behavior for better navigation on smaller
viewports.

Desktop UI scaling was retained so the application presents an appropriately
dense SOC-style workspace instead of appearing oversized.

The frontend therefore evolved substantially during Phase 9 rather than simply
adding employee and simulation pages.


======================================================================
FINAL FRONTEND ROUTES AFTER PHASE 9
======================================================================

    /
    /incidents
    /incidents/:incidentId
    /anomalies
    /anomalies/:eventId
    /employees
    /employees/:userId
    /model
    /architecture
    /simulation

The routed investigation architecture introduced in Phase 8 was preserved and
expanded.


======================================================================
9.20A — BENCHMARK / LIVE PROVENANCE DECOUPLING
======================================================================

Phase 9 hardening identified that benchmark provenance should not pretend to be
a live SimulationRun.

SimulationGroundTruth was therefore extended so each private truth record is
associated with exactly one provenance type:

    simulation_run_id

OR

    benchmark_batch_id

but never both.

Controlled benchmark attack injection uses:

    benchmark_batch_id = phase3_attack_batch_01

and creates:

    0 SimulationRun rows

This cleanly separates:

    controlled benchmark provenance

from:

    live simulation runtime provenance

An XOR database constraint enforces this separation.


======================================================================
9.20A — INCIDENT GENERATION UTILITY HARDENING
======================================================================

The old benchmark incident utility directly created Incident ORM rows.

This became invalid once detector/correlation lineage became mandatory.

The utility was refactored to use the real production-style services:

    IncidentCorrelationEngine.correlate()
    IncidentPersistenceService.persist_candidate()

This removed duplicate persistence logic and ensures benchmark incidents follow
the same lineage rules as operational incidents.


======================================================================
9.20B — FRESH-VOLUME DOCKER / SCHEMA STARTUP HARDENING
======================================================================

Docker startup behavior was tested against a fresh temporary PostgreSQL volume.

The test verified that:

- PostgreSQL starts cleanly
- backend migrations run from zero to head
- backend becomes healthy
- processor starts only after schema readiness
- processor can create fresh state
- the selected model is available
- all current migrations apply successfully

The temporary fresh-volume environment was cleaned independently.

The real operational PostgreSQL volume was never deleted.

Important safety rule maintained throughout Phase 9:

    Never run docker compose down -v
    against the real SENTINEL operational stack.


======================================================================
9.20B — LIVE AUTO-PROCESSING PROOF
======================================================================

The optional simulator was started while the always-on event processor was
already running.

No scoring command, backfill command, or processor trigger was executed.

New Events appeared automatically and were independently processed by
SENTINEL.

This experimentally demonstrated the intended architecture:

    simulator
        |
        v
    ordinary Event rows
        |
        v
    always-on SENTINEL processor
        |
        +--> feature engineering
        |
        +--> Isolation Forest v1.2
        |
        +--> AnomalyScore
        |
        +--> incident correlation

When the simulator stopped, the processor remained running.


======================================================================
9.20C — SCRIPT AND REPOSITORY CLEANUP
======================================================================

Obsolete or superseded development utilities were removed.

Examples include:

    scripts/enrich_incidents.py
    scripts/analyze_initial_event.py
    scripts/create_suspicious_event.py
    backend/app/services/anomaly_scoring.py

The remaining scripts were audited according to their intended role:

- reproducible benchmark
- controlled evaluation
- company generation
- employee generation
- scoring
- backfill
- validation
- one-shot live scenarios
- production-compatible incident generation

Python compile checks and Git whitespace checks were performed.


======================================================================
9.21A — BACKEND / API REGRESSION
======================================================================

Backend and API regression verified:

- core Docker services
- health endpoints
- runtime operations endpoints
- selected model information
- ML summary
- evaluation summary
- employee APIs
- employee detail/activity
- incident list/detail
- incident timeline
- deterministic investigation
- event-to-incident lookup
- ML event detail
- expected 404 behavior
- local AI status
- detector lineage
- runtime logs
- repository whitespace integrity

The correct anomaly/event analysis endpoint is:

    GET /api/v1/ml/events/{event_id}

The frontend route:

    /anomalies/:eventId

is a React route and should not be confused with a backend API route.


======================================================================
9.21B — BENCHMARK REPRODUCIBILITY REGRESSION
======================================================================

The full isolated benchmark was rerun successfully.

Canonical dataset:

    Employees:            100
    Normal events:       5,814
    Attack events:          89
    Total events:        5,903
    Attack instances:        5

Canonical V1 evaluation:

    TP:              84
    FP:              43
    TN:            3819
    FN:               5

    Precision:     0.661
    Recall:        0.944
    F1:            0.778
    FPR:           1.113%

Scenario event detection:

    ACCOUNT_TAKEOVER      8/8
    BRUTE_FORCE          18/18
    DATA_EXFILTRATION     6/9
    INSIDER_THREAT       13/14
    NETWORK_SCAN         39/40

Canonical V2 evaluation:

    TP:              85
    FP:              54
    TN:            3808
    FN:               4

    Precision:     0.612
    Recall:        0.955
    F1:            0.746
    FPR:           1.398%

V1 remained selected because it achieved:

- higher F1
- higher precision
- fewer false positives
- a smaller 17-feature representation

Selected production model:

    isolation-forest v1.2


======================================================================
CANONICAL BENCHMARK RISK DISTRIBUTION
======================================================================

After scoring all 5,903 benchmark events:

    CRITICAL      147
    HIGH           51
    MEDIUM        179
    LOW           267
    NORMAL       5259


======================================================================
CANONICAL INCIDENT BENCHMARK
======================================================================

Incident correlation produced:

    Total incidents: 11

Incident type distribution:

    AUTHENTICATION_ATTACK               1
    GENERAL_BEHAVIORAL_ANOMALY          6
    NETWORK_RECONNAISSANCE              1
    POTENTIAL_ACCOUNT_COMPROMISE        1
    PRIVILEGED_ACCESS_ANOMALY           1
    SUSPICIOUS_DATA_TRANSFER            1

Severity:

    CRITICAL     2
    HIGH         3
    MEDIUM       6

Controlled incident evaluation:

    True-positive incidents:      5
    False-positive incidents:     3
    Attack campaigns recovered:   5/5

    Incident precision:           0.625
    Incident recall:              1.000
    Incident F1:                  0.769

Attack timeline recovery:

    89 / 89 events
    100%


======================================================================
9.21C — LIVE PIPELINE REGRESSION
======================================================================

A live regression test started only the optional simulator in:

    preset = normal
    attack rate = 0

Before:

    operational Events:       13,046
    selected-model scores:     6,620

After a short simulation interval:

    operational Events:       13,059
    selected-model scores:     6,633

Delta:

    +13 Events
    +13 AnomalyScores

The processor independently discovered and processed every new event.

Live backlog returned to:

    0

The processor identity and activation boundary remained unchanged.

Stopping the simulator left:

    event processor = HEALTHY / running
    simulator       = STOPPED

This provided direct runtime proof that SENTINEL is operationally independent
from the simulator.


======================================================================
9.21D — FRONTEND REGRESSION
======================================================================

Frontend validation completed successfully.

Lint:

    oxlint
    0 warnings
    0 errors
    69 files

Production build:

    PASS
    90 modules transformed

Final JS bundle:

    approximately 653.96 kB
    gzip approximately 140.47 kB

Vite reports a >500 kB chunk-size warning.

This is not a functional failure.

Potential code splitting/bundle optimization is deferred to Phase 10.

All final routes were manually loaded successfully.

Cross-navigation between:

- employees
- incidents
- anomalies

was also verified.

Runtime UI behavior was checked across:

- Overview
- Model
- Architecture
- Simulation

No backend/frontend runtime errors were found.


======================================================================
9.21E — EXPLICIT GROUND-TRUTH ISOLATION REGRESSION
======================================================================

The final regression specifically audited private ground-truth isolation.

Verified:

- Event model contains no GT columns
- Event database table contains no GT columns
- V1 selected feature set contains no GT features
- production ml_scoring contains no GT dependency
- event processor contains no GT dependency
- incident correlation contains no GT dependency
- incident persistence contains no GT dependency
- deterministic investigation contains no GT dependency
- operational APIs expose no private GT
- live ML event analysis exposes no private GT
- private truth remains available for controlled evaluation
- simulator runtime may write private truth
- benchmark may read private truth for evaluation

The selected production feature set was explicitly asserted:

    17 features
    forbidden GT features: []

A historical metadata audit found 89 old Event rows containing:

    simulation_batch = phase3_attack_batch_01

All 89 had corresponding authoritative private SimulationGroundTruth records.

A final cleanup migration removed this obsolete benchmark provenance from
Event.event_metadata while preserving:

- all Events
- all other event metadata
- all anomaly scores
- all incidents
- all private ground truth

Cleanup migration:

    e8a2b5c7d9f0_remove_legacy_gt_event_metadata.py

Before cleanup:

    operational Events:          13,066
    private GT rows:                393
    legacy metadata rows:            89

After cleanup:

    operational Events:          13,066
    private GT rows:                393
    legacy metadata rows:             0

This provided a final structural guarantee that operational Event data does not
embed benchmark/simulator ground truth.


======================================================================
MIGRATION LINEAGE AFTER PHASE 9
======================================================================

Current Phase 9 migration chain includes:

    09c9507871ac
    3ab50abd62d1
    364902f30c1c
    7f3e9b2c4d10
    91d6c4b8e2f1
    a4c8d1e7f2b3
    b5d9e2f8c3a4
    c6e0f3a9d4b5
    d7f1a4b6c8e9
    e8a2b5c7d9f0

Current head:

    e8a2b5c7d9f0


======================================================================
FINAL PHASE 9 ARCHITECTURE
======================================================================

SENTINEL's final Phase 9 operational architecture is:

    Synthetic / Corporate Event Source
                 |
                 v
             PostgreSQL
                 |
                 v
       Always-On Event Processor
                 |
                 v
      Incremental Feature Engineering
                 |
                 v
         Isolation Forest v1.2
                 |
                 v
            AnomalyScore
                 |
                 v
      Multi-Signal Incident Correlation
                 |
                 v
      Deterministic Investigation
                 |
                 v
             FastAPI
                 |
                 v
         React SOC Dashboard

Optional:

    Ollama local AI
        |
        v
    grounded incident explanation/chat

Optional simulation:

    simulator-worker
        |
        v
    ordinary Event rows

The simulator does not call scoring.

Optional controlled evaluation:

    benchmark-runner
        |
        +--> dedicated benchmark PostgreSQL
        +--> private benchmark ground truth
        +--> reproducible seed-42 evaluation


======================================================================
IMPORTANT ARCHITECTURAL PRINCIPLES ESTABLISHED IN PHASE 9
======================================================================

1. SENTINEL operates independently of its simulator.

2. Synthetic attack labels are never used as operational ML inputs.

3. Ground truth belongs to the evaluation/control plane.

4. Observable Event telemetry belongs to the operational data plane.

5. Benchmark and live simulation are intentionally different systems.

6. Benchmark:
       proves model/detection quality under controlled conditions.

7. Live simulator:
       demonstrates how the operational platform behaves over time.

8. The processor independently detects new Events.

9. The simulator never instructs SENTINEL what is malicious.

10. Incident creation follows shared correlation/persistence services.

11. Detector and correlation lineage is persisted.

12. Live processing and historical backfill are separate operations.

13. Runtime health is persisted in PostgreSQL rather than inferred from the
    Docker socket.

14. The frontend observes platform runtime state but does not control the
    simulator.

15. Optional AI is never required for deterministic investigation.


======================================================================
WHY PHASE 9 MATTERED
======================================================================

Phase 9 substantially increased SENTINEL's technical and portfolio value.

Before Phase 9, SENTINEL already had:

- synthetic security events
- Isolation Forest anomaly detection
- incident correlation
- deterministic investigation
- local grounded AI
- a routed React SOC dashboard

After Phase 9, SENTINEL also had:

- a real always-on operational processing model
- reproducible benchmark infrastructure
- live enterprise simulation
- clean control-plane/data-plane separation
- isolated private ground truth
- persistent processor state
- runtime health monitoring
- identity-centric intelligence
- more realistic Docker service boundaries
- cleaner operational provenance
- fresh-database startup confidence
- stronger regression evidence
- a much more complete information architecture
- a dedicated architecture explanation experience
- substantially more polished frontend navigation and runtime presentation

This phase therefore changed SENTINEL's character from:

    "an anomaly detection project with a dashboard"

toward:

    "an operational security intelligence platform with
     reproducible evaluation, live simulation, identity context,
     incident correlation, investigation, runtime observability,
     and optional grounded local AI."


======================================================================
PHASE 9 REGRESSION STATUS
======================================================================

    9.21A  Backend/API regression             PASS
    9.21B  Benchmark reproducibility          PASS
    9.21C  Live pipeline regression           PASS
    9.21D  Frontend regression                PASS
    9.21E  Ground-truth isolation             PASS

Overall:

    PHASE 9.21 FINAL REGRESSION SUITE: PASS


======================================================================
PHASE 10 CARRY-FORWARD
======================================================================

Phase 10 should use these notes when creating the final portfolio release.

Important remaining/future areas include:

- final README rewrite
- final architecture diagrams
- final testing organization
- deployment/release polish
- production engineering cleanup
- bundle/code-splitting optimization if worthwhile
- final screenshots/media if desired
- final Docker usage documentation
- final benchmark documentation
- final project story and technical highlights
- final repository hygiene/release checks

Potential frontend optimization:

    Vite currently reports one JS chunk above 500 kB.

This is acceptable for the current Phase 9 release but may be improved using
route-level dynamic imports/code splitting in Phase 10.


======================================================================
README PHRASES WORTH PRESERVING
======================================================================

"The benchmark proves SENTINEL; the live simulator demonstrates SENTINEL."

"The simulator generates the world. SENTINEL independently observes, scores,
correlates, and investigates it."

"SENTINEL's anomaly score is a historical anomaly percentile, not a malicious
event probability."

"Ground truth belongs to evaluation, never inference."

"Stopping the simulator does not stop SENTINEL."

"Local AI is optional. Deterministic investigation remains fully functional
without an LLM."


======================================================================
END OF PHASE 9 NOTES
======================================================================
