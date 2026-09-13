"""
Grounded prompt construction for SENTINEL's local AI investigator.

The prompt builder converts an already-safe AI evidence package into a
compact, deterministic prompt for a local language model.

The LLM is not asked to detect attacks. Detection, anomaly scoring,
correlation, and deterministic investigation have already happened
before this stage.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# ============================================================
# Prompt bundle
# ============================================================

@dataclass(
    frozen=True,
)
class AIPromptBundle:
    """
    System and user prompts supplied to the local AI provider.
    """

    prompt_version: str

    system_prompt: str
    user_prompt: str

    total_timeline_events: int
    included_timeline_events: int


# ============================================================
# Prompt builder
# ============================================================

class AIPromptBuilder:
    """
    Convert a SENTINEL AI evidence package into a grounded prompt.

    The builder deliberately:
    - separates instructions from incident evidence
    - explains anomaly-score semantics
    - prevents unsupported certainty
    - limits large timelines to a representative subset
    - requests structured output
    """

    PROMPT_VERSION = (
        "1.0"
    )

    MAX_TIMELINE_EVENTS = 24


    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def build(
        self,
        package: dict[
            str,
            Any,
        ],
    ) -> AIPromptBundle:
        """
        Build the system and incident-specific prompts.
        """

        full_timeline = list(
            package.get(
                "timeline",
                [],
            )
        )

        selected_timeline = (
            self._select_timeline_events(
                full_timeline
            )
        )

        system_prompt = (
            self._build_system_prompt()
        )

        user_prompt = (
            self._build_user_prompt(
                package=package,
                timeline=selected_timeline,
                total_timeline_events=len(
                    full_timeline
                ),
            )
        )

        return AIPromptBundle(
            prompt_version=(
                self.PROMPT_VERSION
            ),

            system_prompt=system_prompt,

            user_prompt=user_prompt,

            total_timeline_events=len(
                full_timeline
            ),

            included_timeline_events=len(
                selected_timeline
            ),
        )


    # --------------------------------------------------------
    # System grounding contract
    # --------------------------------------------------------

    @staticmethod
    def _build_system_prompt() -> str:
        return """
You are SENTINEL AI Investigator, a local assistant supporting a
Security Operations Center analyst.

SENTINEL has already performed anomaly detection, incident correlation,
and deterministic investigation before you receive this evidence.

Your role is to explain and organize the supplied evidence. You are not
the primary detection engine.

STRICT EVIDENCE RULES:

1. Use only information explicitly supplied in the evidence.
2. Never invent users, IP addresses, timestamps, devices, systems,
   malware, locations, resources, causes, or attacker identities.
3. Never claim that an account, endpoint, or organization is definitely
   compromised unless the evidence explicitly proves that.
4. Distinguish observed facts from reasonable analyst interpretation.
5. A high anomaly percentile means behavior is unusual relative to the
   historical baseline. It is NOT an attack probability.
6. Severity is SENTINEL's operational incident severity, not proof that
   malicious activity occurred.
7. Do not infer simulator scenarios, injected attacks, ground-truth
   labels, or evaluation results.
8. Do not add external threat intelligence or facts that were not
   supplied.
9. Containment guidance must remain conditional when legitimacy has not
   been established.
10. If evidence is insufficient for a conclusion, state that clearly.
11. Preserve numerical values exactly as supplied. Do not substitute
    total event counts for counts of a specific event type or signal.
12. When mentioning a count, ensure that the number corresponds to the
    exact named evidence field. If uncertain, omit the number rather
    than estimate or derive it.

Return concise analyst-oriented output.

The response must contain these fields:

executive_assessment
why_suspicious
timeline_interpretation
investigation_priorities
containment_considerations
confidence
limitations

confidence must be exactly one of:

LOW
MEDIUM
HIGH
""".strip()


    # --------------------------------------------------------
    # Incident-specific prompt
    # --------------------------------------------------------

    def _build_user_prompt(
        self,
        package: dict[
            str,
            Any,
        ],
        timeline: list[
            dict[
                str,
                Any,
            ]
        ],
        total_timeline_events: int,
    ) -> str:
        incident = dict(
            package.get(
                "incident",
                {},
            )
        )

        identity = dict(
            package.get(
                "identity_context",
                {},
            )
        )

        correlation = dict(
            package.get(
                "correlation",
                {},
            )
        )

        investigation = dict(
            package.get(
                "deterministic_investigation",
                {},
            )
        )

        sections = [
            self._incident_section(
                incident
            ),

            self._identity_section(
                identity
            ),

            self._signals_section(
                correlation
            ),

            self._findings_section(
                investigation
            ),

            self._investigation_section(
                investigation
            ),

            self._timeline_section(
                timeline=timeline,
                total_timeline_events=(
                    total_timeline_events
                ),
            ),

            self._output_instruction(),
        ]

        return "\n\n".join(
            section
            for section in sections
            if section
        )


    # --------------------------------------------------------
    # Evidence sections
    # --------------------------------------------------------

    @staticmethod
    def _incident_section(
        incident: dict[
            str,
            Any,
        ],
    ) -> str:
        return "\n".join(
            [
                "=== INCIDENT ===",

                (
                    "Incident ID: "
                    f"{incident.get('incident_id')}"
                ),

                (
                    "Type: "
                    f"{incident.get('incident_type')}"
                ),

                (
                    "Severity: "
                    f"{incident.get('severity')}"
                ),

                (
                    "Status: "
                    f"{incident.get('status')}"
                ),

                (
                    "First seen: "
                    f"{incident.get('first_seen')}"
                ),

                (
                    "Last seen: "
                    f"{incident.get('last_seen')}"
                ),

                (
                    "Event count: "
                    f"{incident.get('event_count')}"
                ),

                (
                    "Anomalous event count: "
                    f"{incident.get('anomaly_count')}"
                ),

                (
                    "Maximum anomaly percentile: "
                    f"{incident.get('maximum_anomaly_percentile')}"
                ),

                (
                    "Summary: "
                    f"{incident.get('summary')}"
                ),

                (
                    "Correlation reason: "
                    f"{incident.get('correlation_reason')}"
                ),
            ]
        )


    @staticmethod
    def _identity_section(
        identity: dict[
            str,
            Any,
        ],
    ) -> str:
        return "\n".join(
            [
                "=== IDENTITY BASELINE ===",

                (
                    "User ID: "
                    f"{identity.get('user_id')}"
                ),

                (
                    "Department: "
                    f"{identity.get('department')}"
                ),

                (
                    "Job role: "
                    f"{identity.get('job_role')}"
                ),

                (
                    "Normal working hours: "
                    f"{identity.get('normal_start_hour')}"
                    "-"
                    f"{identity.get('normal_end_hour')}"
                ),

                (
                    "Typical location: "
                    f"{identity.get('typical_location')}"
                ),
            ]
        )


    @staticmethod
    def _signals_section(
        correlation: dict[
            str,
            Any,
        ],
    ) -> str:
        signals = dict(
            correlation.get(
                "signals",
                {},
            )
        )

        lines = [
            "=== OBSERVED CORRELATION SIGNALS ===",
        ]

        for key in sorted(
            signals
        ):
            lines.append(
                (
                    f"{key}: "
                    f"{signals[key]}"
                )
            )

        return "\n".join(
            lines
        )


    @staticmethod
    def _findings_section(
        investigation: dict[
            str,
            Any,
        ],
    ) -> str:
        findings = list(
            investigation.get(
                "key_findings",
                [],
            )
        )

        lines = [
            "=== DETERMINISTIC FINDINGS ===",
        ]

        severity_rationale = (
            investigation.get(
                "severity_rationale",
                "",
            )
        )

        if severity_rationale:
            lines.append(
                (
                    "Severity rationale: "
                    f"{severity_rationale}"
                )
            )

        for index, finding in enumerate(
            findings,
            start=1,
        ):
            lines.append(
                (
                    f"{index}. "
                    f"{finding.get('finding')} | "
                    f"value={finding.get('value')} | "
                    f"confidence={finding.get('confidence')}"
                )
            )

        return "\n".join(
            lines
        )


    @staticmethod
    def _investigation_section(
        investigation: dict[
            str,
            Any,
        ],
    ) -> str:
        lines = [
            "=== EXISTING INVESTIGATION GUIDANCE ===",
        ]

        steps = list(
            investigation.get(
                "investigation_steps",
                [],
            )
        )

        for step in steps:
            lines.append(
                (
                    "STEP "
                    f"{step.get('priority')}: "
                    f"{step.get('action')} "
                    f"({step.get('reason')})"
                )
            )

        questions = list(
            investigation.get(
                "analyst_questions",
                [],
            )
        )

        if questions:
            lines.append(
                "Analyst questions:"
            )

            for question in questions:
                lines.append(
                    f"- {question}"
                )

        actions = list(
            investigation.get(
                "containment_actions",
                [],
            )
        )

        if actions:
            lines.append(
                "Existing containment guidance:"
            )

            for action in actions:
                lines.append(
                    (
                        f"- [{action.get('urgency')}] "
                        f"{action.get('action')} "
                        f"Condition: "
                        f"{action.get('condition')}"
                    )
                )

        return "\n".join(
            lines
        )


    # --------------------------------------------------------
    # Timeline
    # --------------------------------------------------------

    def _timeline_section(
        self,
        timeline: list[
            dict[
                str,
                Any,
            ]
        ],
        total_timeline_events: int,
    ) -> str:
        lines = [
            "=== CORRELATED EVENT TIMELINE ===",
            (
                "Events in complete incident: "
                f"{total_timeline_events}"
            ),
            (
                "Events included below: "
                f"{len(timeline)}"
            ),
        ]

        if (
            len(timeline)
            < total_timeline_events
        ):
            lines.append(
                (
                    "Note: the timeline was compacted for local-model "
                    "context efficiency. Aggregate signals above describe "
                    "the complete incident."
                )
            )

        for event in timeline:
            lines.append(
                self._timeline_event_line(
                    event
                )
            )

        return "\n".join(
            lines
        )


    @staticmethod
    def _timeline_event_line(
        event: dict[
            str,
            Any,
        ],
    ) -> str:
        resource = (
            event.get(
                "resource_name"
            )
            or event.get(
                "resource_type"
            )
            or "-"
        )

        destination = (
            event.get(
                "destination_ip"
            )
            or "-"
        )

        return (
            "#"
            f"{event.get('sequence_number')} "
            f"{event.get('timestamp')} | "
            f"{event.get('event_type')} | "
            f"success={event.get('success')} | "
            f"src={event.get('source_ip')} | "
            f"dst={destination} | "
            f"resource={resource} | "
            f"bytes_sent={event.get('bytes_sent')} | "
            f"bytes_received={event.get('bytes_received')} | "
            f"anomaly_percentile="
            f"{event.get('anomaly_percentile')} | "
            f"risk={event.get('risk_level')}"
        )


    # --------------------------------------------------------
    # Timeline compaction
    # --------------------------------------------------------

    def _select_timeline_events(
        self,
        timeline: list[
            dict[
                str,
                Any,
            ]
        ],
    ) -> list[
        dict[
            str,
            Any,
        ]
    ]:
        """
        Keep all events for normal-sized incidents.

        For larger incidents, preserve:
        - the beginning of the incident
        - the highest-anomaly events
        - the end of the incident

        Aggregate correlation signals still represent the complete
        incident.
        """

        if (
            len(timeline)
            <= self.MAX_TIMELINE_EVENTS
        ):
            return timeline

        first_count = 8
        high_risk_count = 8
        last_count = 8

        first_events = (
            timeline[
                :first_count
            ]
        )

        last_events = (
            timeline[
                -last_count:
            ]
        )

        highest_anomaly_events = sorted(
            timeline,
            key=lambda item: float(
                item.get(
                    "anomaly_percentile",
                    0.0,
                )
            ),
            reverse=True,
        )[
            :high_risk_count
        ]

        selected_by_sequence: dict[
            int,
            dict[
                str,
                Any,
            ],
        ] = {}

        for event in (
            first_events
            + highest_anomaly_events
            + last_events
        ):
            sequence_number = int(
                event.get(
                    "sequence_number",
                    0,
                )
            )

            selected_by_sequence[
                sequence_number
            ] = event

        return [
            selected_by_sequence[
                sequence
            ]
            for sequence in sorted(
                selected_by_sequence
            )
        ]


    # --------------------------------------------------------
    # Expected output
    # --------------------------------------------------------

    @staticmethod
    def _output_instruction() -> str:
        return """
=== REQUIRED OUTPUT ===

Return exactly ONE valid JSON object.

Do not use Markdown.
Do not use code fences.
Do not include text before or after the JSON object.

Use exactly this structure:

{
  "executive_assessment": "short evidence-grounded assessment",
  "why_suspicious": [
    "evidence-backed reason"
  ],
  "timeline_interpretation": "concise interpretation of the observed sequence",
  "investigation_priorities": [
    "important analyst action"
  ],
  "containment_considerations": [
    "conditional containment consideration"
  ],
  "confidence": "LOW | MEDIUM | HIGH",
  "limitations": [
    "what cannot be concluded from the supplied evidence"
  ]
}

RULES:

- executive_assessment must be concise.
- why_suspicious must contain only evidence-backed observations.
- timeline_interpretation must describe only supplied events.
- investigation_priorities must be practical analyst actions.
- containment_considerations must remain conditional unless legitimacy
  or malicious intent is established.
- confidence must be exactly LOW, MEDIUM, or HIGH.
- limitations must state important uncertainty.
- A high anomaly percentile means unusual behavior relative to baseline.
  It is not an attack probability.
- Do not invent any fact that is not present in the evidence.
- Preserve every numerical count exactly as supplied in the evidence.
""".strip()