SENTINEL — Phase 8 README Notes
================================

Phase:
Frontend Architecture & Investigation UX

Status:
COMPLETED

Purpose
-------
Phase 8 transformed SENTINEL's frontend from a mostly page-state-driven
dashboard into a URL-routed investigation workspace.

The phase focused on frontend architecture, analyst navigation, investigation
UX, operational refresh behavior, error handling, and maintainability.

The existing SENTINEL visual language was preserved where it was already
strong. The main redesign effort was intentionally focused on Incidents and
Anomalies, while Overview received targeted operational improvements and the
Model page was retained without unnecessary redesign.


1. ROUTED FRONTEND ARCHITECTURE
-------------------------------

React Router was introduced so major SENTINEL workspaces now have stable,
shareable URLs.

Primary frontend routes:

    /                           Security Operations Overview

    /incidents                  Incident operations queue

    /incidents/:incidentId      Dedicated incident investigation workspace

    /anomalies                  Behavioral anomaly detection queue

    /anomalies/:eventId         Dedicated anomaly analysis workspace

    /model                      Existing model intelligence page

Unknown routes now render a dedicated SENTINEL 404 workspace rather than
silently redirecting to the Overview page.

Examples:

    /does-not-exist
        -> generic SENTINEL 404 page

    /incidents/INVALID-ID
        -> incident-specific "Incident not found" state

    /anomalies/INVALID-ID
        -> anomaly-specific "Detection not found" state

The sidebar remains correctly highlighted for nested routes such as:

    /incidents/:incidentId
    /anomalies/:eventId


2. INCIDENT OPERATIONS QUEUE
----------------------------

The /incidents page was simplified into a dedicated incident operations queue.

The old mixed queue/detail layout was removed.

Current capabilities include:

- incident search
- severity filtering
- sorting
- pagination
- operational KPI cards
- manual refresh
- last-refreshed indicator
- clickable incident rows
- dedicated arrow navigation affordance
- subtle risk/severity-aware hover behavior
- direct navigation to /incidents/:incidentId

The queue intentionally contains no investigation-detail content.

Incident detail logic now belongs entirely to the routed investigation
workspace.


3. INCIDENT INVESTIGATION WORKSPACE
-----------------------------------

Each incident now has a dedicated workspace:

    /incidents/:incidentId

The workspace contains:

- incident hero / summary
- affected identity information
- event and anomaly statistics
- key indicators
- bounded internal-scroll incident timeline
- deterministic investigation findings
- recommended investigation steps
- decision-support questions
- containment recommendations
- Local AI Investigator
- Local AI Analyst Chat

The page performs a silent operational refresh every 10 seconds.

Refresh behavior:

- initial route load uses a normal loading state
- subsequent refreshes keep the current investigation visible
- scroll position remains unchanged
- manual refresh is available
- last-refreshed state is shown
- failed background refreshes preserve previous valid data

Local AI components are not remounted by the 10-second operational refresh.


4. AI CHAT SCROLL BEHAVIOR
--------------------------

The AI Analyst Chat previously used a generic effect that could scroll the
entire incident page to the AI section when an incident was opened.

This was replaced with explicit interaction-based scrolling.

The chat now scrolls only when appropriate, such as:

- analyst sends a new question
- a final AI response is rendered
- analyst retries an AI request when needed

Opening an incident no longer automatically jumps down to the Local AI area.

This behavior also supports cached AI conversations because hydrating previous
messages does not trigger automatic page scrolling.


5. LOCAL AI FRONTEND PERSISTENCE
--------------------------------

Local AI output now uses browser sessionStorage for lightweight,
incident-scoped persistence.

The backend and database were intentionally not modified for this feature.

This is appropriate because Local AI is an optional host-local capability and
may not always be available on the machine running SENTINEL.

Persistence is keyed by incident ID.

Conceptually:

    sentinel:incident-ai:investigation:<incidentId>

    sentinel:incident-ai:chat:<incidentId>

Behavior:

- successful AI investigation output is cached per incident
- completed chat conversations are cached per incident
- navigating Incident A -> Incident B keeps their AI states independent
- returning to Incident A restores its previous AI investigation and chat
- browser refresh during the same session restores cached AI output
- persisted chat hydration does not auto-scroll the page
- Clear Chat removes the current incident's cached chat
- clearing chat does not remove the cached AI Investigator result
- Local AI availability/status remains runtime state and is not cached
- loading states are not cached
- timeout/error states are not cached
- incomplete user questions are not committed to persistent chat state

The cache therefore behaves as a "last known-good AI output" layer.

React component keys are scoped by incident ID so switching between incidents
creates the correct incident-specific AI workspace without synchronous
setState reset effects.


6. ANOMALY OPERATIONS QUEUE
---------------------------

The /anomalies page was converted into a dedicated behavioral-detection queue.

The previous inline selected-anomaly detail panel was removed.

The page preserves:

- real server-side anomaly pagination
- search
- risk-level filtering
- ML summary metrics
- risk distribution
- model threshold context

Enhancements include:

- manual Refresh Detections control
- last-refreshed indicator
- clickable anomaly rows
- navigation arrow affordance
- subtle risk-aware hover behavior
- direct navigation to /anomalies/:eventId

Search, filter, and pagination actions change the current anomaly view but do
not falsely reset the full-detection refresh timestamp.


7. ANOMALY ANALYSIS WORKSPACE
-----------------------------

Each anomaly now has a dedicated analysis route:

    /anomalies/:eventId

The detail workspace includes:

- prominent event identity metadata
- event ID badge
- event type badge
- employee/user badge
- event timestamp badge
- anomaly percentile KPI
- raw Isolation Forest score KPI
- recorded feature count KPI
- linked-incident count KPI
- anomaly hero
- risk level
- threshold context
- curated behavioral feature signals
- detection interpretation
- complete feature snapshot
- detector name and version
- raw detector context
- linked security incidents

The page silently refreshes every 10 seconds while keeping the current
analysis visible.

Invalid event IDs receive a dedicated anomaly-not-found state.


8. ANOMALY <-> INCIDENT CORRELATION NAVIGATION
----------------------------------------------

Phase 8 introduced two-way investigation navigation between behavioral
detections and correlated incidents.

Backend support added:

    GET /api/v1/incidents/by-event/{event_id}

The endpoint performs a reverse lookup through the existing relationship:

    Event
        -> IncidentEvent
        -> Incident

No new database table or migration was required.

Example validated relationship:

    Event:
        EVT-AB9F6631645B

    Linked Incident:
        INC-2026-0010
        Potential Network Reconnaissance
        HIGH
        OPEN

The anomaly detail workspace displays linked incidents as clickable operational
cards.

Selecting one navigates to:

    /incidents/:incidentId

The Incident Timeline was also upgraded so timeline events are clickable.

Selecting a scored timeline event navigates to:

    /anomalies/:eventId

This creates a two-way analyst workflow:

    Incident Investigation
            |
            | timeline event
            v
    Anomaly Analysis
            |
            | linked incident
            v
    Incident Investigation


9. INCIDENT TIMELINE UX
-----------------------

Incident timeline events now behave as investigation navigation targets.

Enhancements include:

- entire event card is clickable
- navigation to anomaly analysis
- subtle hover lift
- subtle cyan edge accent
- event ID emphasis
- arrow navigation affordance
- timeline-node hover feedback
- existing internal timeline scrolling retained

The visual effect is intentionally restrained so the timeline remains
analytical rather than feeling like a generic navigation list.


10. SECURITY OPERATIONS OVERVIEW
--------------------------------

The existing Overview page visual design was preserved because it already fit
SENTINEL's visual and operational goals.

The page now performs a silent 10-second intelligence refresh.

The Overview refreshes:

- employee count
- incident summary
- incident candidate pool
- ML summary
- model metadata
- evaluation summary

Operational header controls now include:

- SYSTEM OPERATIONAL status
- last-refreshed indicator
- manual Refresh Intelligence action

Background refresh behavior:

- existing dashboard remains visible
- page position remains stable
- refresh timestamp resets only on successful refresh
- refresh failures preserve the previous valid dashboard

The Recent Security Incidents section was converted into a selected priority
queue.

Overview fetches a broader incident pool and displays only the top operational
incidents.

Priority selection considers:

1. severity
       CRITICAL > HIGH > MEDIUM

2. operational state
       active/open investigations ahead of resolved cases

3. recency
       newer incidents used as the tie-breaker

Only the top five selected incidents are displayed.

Rows are clickable and navigate directly to:

    /incidents/:incidentId

Overview incident hover effects are intentionally more subtle than those on
the dedicated /incidents queue.

A "Go to Incidents" control was added to open the complete incident operations
queue.


11. COMPONENT EXTRACTION
------------------------

Large page components were reduced by extracting reusable operational UI.

Anomaly components include:

    src/components/anomalies/
        AnomalyDetailHero.tsx
        AnomalyDetailKpiCard.tsx
        AnomalyDetectorContext.tsx
        AnomalyExplanation.tsx
        AnomalyFeatureSignals.tsx
        AnomalyFeatureSnapshot.tsx
        AnomalyFilters.tsx
        AnomalyLinkedIncidents.tsx
        AnomalyQueue.tsx
        AnomalyRiskBadge.tsx
        AnomalyRiskDistribution.tsx
        AnomalyStatCard.tsx
        anomalyFormatters.ts
        anomalyStyles.ts

Overview components include:

    src/components/overview/
        OverviewIncidentQueue.tsx
        OverviewMetricCard.tsx
        OverviewRefreshControls.tsx
        overviewStyles.ts

Shared browser persistence utility:

    src/utils/incidentAIStorage.ts

This extraction keeps routed page components focused primarily on data loading,
state orchestration, refresh behavior, and navigation.


12. REFRESH MODEL
-----------------

Phase 8 intentionally uses different refresh behavior depending on the
workspace.

Overview:

    silent automatic refresh every 10 seconds
    manual refresh available

Incident Detail:

    silent automatic refresh every 10 seconds
    manual refresh available

Anomaly Detail:

    silent automatic refresh every 10 seconds
    manual refresh available

Incidents Queue:

    explicit/manual refresh model

Anomalies Queue:

    explicit/manual refresh model

This distinction keeps high-context operational investigation workspaces live
without making queue browsing unstable or constantly reshuffling the analyst's
current view.


13. ERROR AND RESILIENCE STATES
-------------------------------

Phase 8 strengthened frontend resilience.

Implemented states include:

- initial loading
- API failure
- background refresh warning
- invalid incident ID
- invalid anomaly/event ID
- generic unknown-route 404
- Local AI unavailable
- Local AI timeout
- invalid AI response
- retry behavior

Background-refresh failures do not destroy previously valid operational data.


14. MODEL PAGE
--------------

The existing Model page was reviewed and intentionally retained without
redesign.

Its current presentation already fits the frontend visual language and
provides the required model-level intelligence.

Avoiding unnecessary redesign kept Phase 8 focused on the routed investigation
architecture.


15. PHASE 8 VALIDATION
----------------------

Final frontend validation:

    npm run lint

Result:

    Found 0 warnings and 0 errors.

Latest production build:

    npm run build

Result:

    TypeScript build passed.
    Vite production build passed.
    68 modules transformed.

Phase 8 route regression was manually validated for:

    /
    /incidents
    /incidents/:incidentId
    /anomalies
    /anomalies/:eventId
    /model
    invalid routes
    invalid incident IDs
    invalid anomaly IDs
    browser Back
    browser Forward
    direct detail-route reload

Additional behavior validated:

- Overview 10-second refresh
- Incident Detail 10-second refresh
- Anomaly Detail 10-second refresh
- manual refresh controls
- last-refreshed indicators
- Incident -> Anomaly navigation
- Anomaly -> Incident navigation
- AI Investigator persistence
- AI Analyst Chat persistence
- chat Clear behavior
- no AI-induced page auto-scroll


16. ARCHITECTURAL RESULT
------------------------

Phase 8 established the frontend navigation model:

                    Overview
                       |
             +---------+---------+
             |                   |
             v                   v
         Incidents            Anomalies
             |                   |
             v                   v
    Incident Investigation <-> Anomaly Analysis

The frontend now distinguishes clearly between:

    operational queues

and:

    dedicated investigation/analysis workspaces


17. PHASE 9 HANDOFF
-------------------

Phase 9 will introduce:

Enterprise Simulation & Employee Management

Planned capabilities include:

- employee management workspace
- employee profile routes
- employee deactivate/reactivate workflow
- simulated enterprise controls
- benchmark seeded simulation mode
- live simulation mode
- pipeline execution controls
- evolving enterprise telemetry
- frontend polling for runtime changes

Planned routes include:

    /employees
    /employees/:employeeId
    /simulation

Ground-truth simulator labels must remain excluded from operational ML,
incident-correlation, investigation, and Local AI inputs.


18. DEFERRED TO PHASE 10
------------------------

Production/release engineering remains intentionally deferred.

Phase 10 will cover areas such as:

- final production Docker architecture
- frontend production serving
- Nginx SPA route fallback for deep links
- formal automated test suite
- CI
- reproducible deployment
- configuration/security cleanup
- clean-clone validation
- final README
- final Mermaid architecture diagrams
- portfolio/demo documentation
- release tagging

The temporary Phase 7 and Phase 8 README notes should be used as source
material when producing the final project README.


19. PHASE 8 CONCLUSION
----------------------

Phase 8 moved SENTINEL from a collection of dashboard views into a coherent
security operations workspace.

The key result is an investigation workflow in which analysts can:

    observe enterprise posture
        ->
    inspect prioritized incidents
        ->
    reconstruct incident timelines
        ->
    inspect individual ML anomalies
        ->
    move between correlated anomalies and incidents
        ->
    use deterministic and optional Local AI intelligence
        ->
    return to prior AI investigation context during the browser session

The frontend remains intentionally lightweight:

- React
- TypeScript
- React Router
- Tailwind CSS
- REST API integration
- sessionStorage for optional Local AI UX persistence

No unnecessary frontend state-management framework, message broker, or cloud
dependency was introduced.
