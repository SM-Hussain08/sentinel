SENTINEL — PHASE 7 README NOTES
================================
Phase 7: Local AI Investigation

Purpose
-------
Phase 7 added an optional local AI explanatory layer on top of
SENTINEL's existing deterministic detection, anomaly scoring,
incident correlation, and investigation pipeline.

The AI does NOT perform anomaly detection and does NOT determine
whether an incident is malicious.

Core Architecture
-----------------
Deterministic SENTINEL Evidence
        |
        v
Whitelisted AI Evidence Builder
        |
        v
Grounded Prompt Builder
        |
        v
Local Ollama Model
        |
        v
Pydantic-Validated Structured Output
        |
        v
React Incident Investigation UI

Local AI Provider
-----------------
Provider: Ollama
Selected model: llama3.2:3b

Development hardware used:
- CPU inference
- Intel Core i5-1145G7
- approximately 8 GB RAM
- no dedicated GPU

AI is optional.
If Ollama is unavailable, SENTINEL's core incident detection,
correlation, anomaly scoring, timelines, and deterministic
investigation remain available.

Grounding and Safety
--------------------
The LLM receives only a controlled whitelist of operational evidence.

Ground-truth simulator/evaluation fields are deliberately excluded,
including:
- is_injected_anomaly
- scenario_type
- other synthetic ground-truth labels

The LLM is instructed:
- never to invent unsupported evidence
- never to treat anomaly percentile as attack probability
- never to treat severity as proof of compromise
- preserve numerical values and labels
- use conditional language for containment where appropriate
- explicitly acknowledge evidence limitations

The evidence builder performs safety validation before evidence is
provided to the local model.

Structured AI Investigator
--------------------------
Incident page contains a Local AI / AI Investigator section.

Structured response contains:
- Executive Assessment
- Why Suspicious
- Timeline Interpretation
- Investigation Priorities
- Containment Considerations
- Confidence
- Limitations

AI output is parsed and validated through Pydantic before being
returned to the frontend.

Malformed model output is rejected rather than displayed.

AI Service Resilience
---------------------
Supported AI service states include:
- enabled / ready
- Ollama unavailable
- configured model unavailable
- generation timeout
- malformed model response
- AI disabled

Frontend provides status checking and Check Again functionality.

Core deterministic investigation remains usable when Local AI is
offline.

Incident AI Analyst Chat
-------------------------
Phase 7 was extended with an incident-scoped AI Analyst Chat below
the structured AI Investigator.

The chat is NOT a general-purpose chatbot.

It is restricted to the currently selected incident.

Supported semantic response types:
1. ANSWER
2. INVALID_QUESTION
3. OUT_OF_SCOPE
4. INSUFFICIENT_EVIDENCE

Examples:
- Valid grounded incident question -> ANSWER
- Incoherent input -> INVALID_QUESTION
- General/unrelated question -> OUT_OF_SCOPE
- Incident-related question unsupported by evidence ->
  INSUFFICIENT_EVIDENCE

Chat Grounding
--------------
The chat uses the same whitelisted deterministic incident evidence.

Short conversation history is included only for conversational
context and is NOT treated as evidence.

Only the most recent six chat messages are sent as history.

The model must always resolve conflicts in favor of SENTINEL's
deterministic evidence.

Chat JSON Validation
--------------------
Ollama JSON mode is enabled specifically for incident chat responses.

Chat output is validated against the AIIncidentChatContent Pydantic
schema before being exposed to the frontend.

Backend canonical responses are enforced for:
- INVALID_QUESTION
- OUT_OF_SCOPE
- INSUFFICIENT_EVIDENCE

Deterministic Chat Guard
------------------------
A fast deterministic guard handles:
- empty input
- symbols-only input
- numbers-only input
- repeated-character junk
- common keyboard mash
- simple greetings
- help/capability questions

Simple greetings and capability questions do not invoke Ollama.

Examples:
- Hi
- Hello
- Good evening
- What can you do?
- Help
- What can I ask?

These deterministic responses return from the backend with
generation_duration_ms = 0.

Several controlled greeting/help response variants are selected
randomly to avoid repetitive UI behavior.

Frontend Chat UX
----------------
Frontend component:
AIAnalystChat.tsx

Features:
- separate Local AI / AI Analyst Chat section
- incident-scoped conversation
- user and AI message bubbles
- starter question suggestions
- Enter to send
- Shift+Enter for newline
- 500-character question limit
- Clear Chat
- automatic chat reset when incident changes
- progressive long-inference status messages
- minimum 5-second visible thinking experience
- local CPU inference notice
- AI response classification badges
- retry support for latest AI result
- retry support for failures
- failed request removed when user asks a new question
- failed responses excluded from future chat history
- stale request protection
- auto-scroll to newest response

Only the latest AI result exposes Retry.

Retrying an answer removes that answer and regenerates the response
for the same user question.

Long Inference UX
-----------------
Progressive frontend states include:
- Thinking through your question
- Reviewing incident evidence
- Cross-checking timeline and risk signals
- Evaluating available evidence
- Building a grounded response
- Local AI is still processing
- longer-than-usual CPU inference message

Local CPU inference may take approximately 60-90 seconds for heavier
questions depending on available hardware.

This is an acknowledged local-development limitation rather than a
failure of the detection pipeline.

Grounding Validation
--------------------
Grounding validation was performed against representative incidents:

INC-2026-0005
- authentication failures followed by successful login and later
  activity
- AI response checked against deterministic timeline and findings

INC-2026-0008
- high-volume outbound activity
- sensitive resource interactions
- external transfer evidence
- AI statements checked against whitelisted evidence

INC-2026-0010
- network activity / rapid fan-out pattern
- numerical distinctions such as total anomaly count versus fan-out
  count were explicitly validated

Final grounding validation result:
- no simulator ground-truth leakage observed
- numerical evidence preserved
- unsupported facts not intentionally introduced
- cautious language used where certainty was unavailable

Important README Explanation
----------------------------
The README should clearly state:

SENTINEL uses machine learning for anomaly detection.

The local language model is NOT the detector.

Pipeline:

Synthetic Events
    -> Feature Engineering
    -> Isolation Forest
    -> Normalized Anomaly/Risk Scoring
    -> Rule-Based Incident Correlation
    -> Deterministic Investigation
    -> Optional Local AI Explanation

The LLM operates only after the deterministic security pipeline and
acts as an explanatory / investigation-assistance layer.

Important Portfolio Points
--------------------------
Phase 7 demonstrates:
- local open-source LLM integration
- grounded generation
- defensive prompt design
- structured AI output
- schema validation
- hallucination mitigation
- evidence whitelisting
- graceful model failure handling
- CPU-only local inference
- incident-scoped conversational AI
- deterministic + generative AI architecture
- React AI UX
- FastAPI AI integration

README later should include diagrams for:
1. Overall SENTINEL pipeline
2. Local AI investigation architecture
3. Incident AI chat request flow

END OF PHASE 7 NOTES