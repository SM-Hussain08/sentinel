from dataclasses import dataclass
from typing import Any

from app.models import Incident


@dataclass
class InvestigationResult:
    """
    Structured analyst guidance generated from one correlated incident.
    """

    severity_rationale: str

    key_findings: list[
        dict[str, Any]
    ]

    investigation_steps: list[
        dict[str, Any]
    ]

    analyst_questions: list[str]

    containment_actions: list[
        dict[str, Any]
    ]


class InvestigationEngine:
    """
    Convert correlated incident evidence into deterministic,
    analyst-oriented investigation intelligence.

    No simulator ground-truth labels are used.
    """

    def analyze(
        self,
        incident: Incident,
    ) -> InvestigationResult:
        signals = (
            incident.evidence.get(
                "signals",
                {},
            )
        )

        severity_rationale = (
            self._severity_rationale(
                incident,
                signals,
            )
        )

        key_findings = (
            self._key_findings(
                incident,
                signals,
            )
        )

        investigation_steps = (
            self._investigation_steps(
                incident,
                signals,
            )
        )

        analyst_questions = (
            self._analyst_questions(
                incident,
                signals,
            )
        )

        containment_actions = (
            self._containment_actions(
                incident,
                signals,
            )
        )

        return InvestigationResult(
            severity_rationale=(
                severity_rationale
            ),

            key_findings=(
                key_findings
            ),

            investigation_steps=(
                investigation_steps
            ),

            analyst_questions=(
                analyst_questions
            ),

            containment_actions=(
                containment_actions
            ),
        )

    # ---------------------------------------------------------
    # Severity explanation
    # ---------------------------------------------------------

    def _severity_rationale(
        self,
        incident: Incident,
        signals: dict[str, Any],
    ) -> str:
        if (
            incident.incident_type
            == "POTENTIAL_ACCOUNT_COMPROMISE"
        ):
            return (
                "Critical severity because repeated authentication "
                "failures were followed by successful access and "
                "subsequent resource activity."
            )

        if (
            incident.incident_type
            == "SUSPICIOUS_DATA_TRANSFER"
        ):
            return (
                "Critical severity because the incident contains "
                "unusually large data movement combined with "
                "high-risk file activity."
            )

        if (
            incident.incident_type
            == "NETWORK_RECONNAISSANCE"
        ):
            return (
                "High severity because one identity contacted many "
                "destinations within a short time window, which may "
                "indicate internal discovery or reconnaissance."
            )

        if (
            incident.incident_type
            == "AUTHENTICATION_ATTACK"
        ):
            return (
                "High severity because numerous failed authentication "
                "attempts occurred within a short period."
            )

        if (
            incident.incident_type
            == "PRIVILEGED_ACCESS_ANOMALY"
        ):
            return (
                "High severity because unusual off-hours activity "
                "involved sensitive resources and elevated file access."
            )

        return (
            "Medium severity because multiple unusual behavioral "
            "signals were correlated, but the evidence does not yet "
            "support a more specific high-confidence incident type."
        )

    # ---------------------------------------------------------
    # Findings
    # ---------------------------------------------------------

    def _key_findings(
        self,
        incident: Incident,
        signals: dict[str, Any],
    ) -> list[dict[str, Any]]:
        findings: list[
            dict[str, Any]
        ] = []

        def add(
            category: str,
            finding: str,
            value: Any,
            confidence: str,
        ) -> None:
            findings.append(
                {
                    "category": category,
                    "finding": finding,
                    "value": value,
                    "confidence": confidence,
                }
            )

        login_failures = int(
            signals.get(
                "login_failures",
                0,
            )
        )

        if login_failures:
            add(
                "authentication",
                "Failed authentication attempts",
                login_failures,
                "HIGH",
            )

        if (
            signals.get(
                "login_successes",
                0,
            )
            and login_failures >= 3
        ):
            add(
                "authentication",
                (
                    "Successful authentication "
                    "followed repeated failures"
                ),
                True,
                "HIGH",
            )

        non_baseline = int(
            signals.get(
                "non_baseline_source_events",
                0,
            )
        )

        if non_baseline:
            add(
                "identity",
                "Events from non-baseline source",
                non_baseline,
                "HIGH",
            )

        off_hours = int(
            signals.get(
                "off_hours_events",
                0,
            )
        )

        if off_hours:
            add(
                "temporal",
                "Events occurred outside normal work hours",
                off_hours,
                "MEDIUM",
            )

        unique_destinations = int(
            signals.get(
                "max_unique_destinations_5m",
                0,
            )
        )

        if unique_destinations >= 5:
            add(
                "network",
                "Rapid destination fan-out",
                unique_destinations,
                "HIGH",
            )

        bytes_sent = int(
            signals.get(
                "total_bytes_sent",
                0,
            )
        )

        if bytes_sent >= 100_000_000:
            add(
                "data_transfer",
                "Large outbound data volume",
                bytes_sent,
                (
                    "HIGH"
                    if bytes_sent
                    < 1_000_000_000
                    else "CRITICAL"
                ),
            )

        restricted = int(
            signals.get(
                "restricted_resource_events",
                0,
            )
        )

        if restricted:
            add(
                "resource",
                "Sensitive resource interactions",
                restricted,
                "HIGH",
            )

        file_burst = int(
            signals.get(
                "max_file_events_30m",
                0,
            )
        )

        if file_burst >= 5:
            add(
                "file_activity",
                "Elevated file activity",
                file_burst,
                "MEDIUM",
            )

        add(
            "machine_learning",
            "Maximum anomaly percentile",
            round(
                float(
                    incident.max_anomaly_score
                ),
                4,
            ),
            "HIGH",
        )

        return findings

    # ---------------------------------------------------------
    # Investigation workflow
    # ---------------------------------------------------------

    def _investigation_steps(
        self,
        incident: Incident,
        signals: dict[str, Any],
    ) -> list[dict[str, Any]]:
        steps: list[
            dict[str, Any]
        ] = []

        def add(
            priority: int,
            action: str,
            reason: str,
        ) -> None:
            steps.append(
                {
                    "priority": priority,
                    "action": action,
                    "reason": reason,
                }
            )

        add(
            1,
            "Validate the affected user's activity",
            (
                "Confirm whether the identity owner recognizes "
                "the observed activity and time window."
            ),
        )

        if (
            incident.incident_type
            in {
                "AUTHENTICATION_ATTACK",
                "POTENTIAL_ACCOUNT_COMPROMISE",
            }
        ):
            add(
                2,
                (
                    "Review authentication logs, "
                    "source IPs, and device context"
                ),
                (
                    "Determine whether failed attempts and "
                    "successful authentication originated "
                    "from expected infrastructure."
                ),
            )

            add(
                3,
                "Inspect recent account sessions",
                (
                    "Look for additional sessions, tokens, "
                    "or authentication activity associated "
                    "with the identity."
                ),
            )

        if (
            incident.incident_type
            == "NETWORK_RECONNAISSANCE"
        ):
            add(
                2,
                "Review destination systems contacted",
                (
                    "Determine whether the destination fan-out "
                    "matches legitimate administrative activity."
                ),
            )

            add(
                3,
                "Inspect network telemetry around the incident",
                (
                    "Check ports, protocols, connection outcomes, "
                    "and any follow-on access."
                ),
            )

        if (
            incident.incident_type
            in {
                "SUSPICIOUS_DATA_TRANSFER",
                "PRIVILEGED_ACCESS_ANOMALY",
            }
        ):
            add(
                2,
                "Review accessed files and data classification",
                (
                    "Determine whether accessed resources were "
                    "appropriate for the user's role."
                ),
            )

            add(
                3,
                "Review transfer destinations and volumes",
                (
                    "Identify whether data left approved systems "
                    "or exceeded expected business activity."
                ),
            )

        add(
            len(steps) + 1,
            "Preserve supporting event evidence",
            (
                "Retain authentication, file, database, and "
                "network records associated with the incident."
            ),
        )

        add(
            len(steps) + 1,
            "Search for related activity",
            (
                "Check nearby time windows and other identities "
                "for matching source addresses or behavior."
            ),
        )

        return steps

    # ---------------------------------------------------------
    # Analyst questions
    # ---------------------------------------------------------

    def _analyst_questions(
        self,
        incident: Incident,
        signals: dict[str, Any],
    ) -> list[str]:
        questions = [
            (
                "Does the affected user recognize the activity "
                "during this incident window?"
            ),
            (
                "Does this behavior match the user's normal role "
                "and responsibilities?"
            ),
        ]

        if (
            signals.get(
                "non_baseline_source_events",
                0,
            )
            > 0
        ):
            questions.append(
                (
                    "Is the non-baseline source address associated "
                    "with an approved VPN, office, or device?"
                )
            )

        if (
            signals.get(
                "off_hours_events",
                0,
            )
            > 0
        ):
            questions.append(
                (
                    "Was the user expected to be active outside "
                    "their normal working hours?"
                )
            )

        if (
            signals.get(
                "restricted_resource_events",
                0,
            )
            > 0
        ):
            questions.append(
                (
                    "Was the user authorized to access the "
                    "sensitive resources involved?"
                )
            )

        if (
            signals.get(
                "total_bytes_sent",
                0,
            )
            >= 100_000_000
        ):
            questions.append(
                (
                    "Was the observed outbound transfer required "
                    "for legitimate business activity?"
                )
            )

        if (
            signals.get(
                "max_unique_destinations_5m",
                0,
            )
            >= 5
        ):
            questions.append(
                (
                    "Is rapid access to many internal systems "
                    "normal for this user's job function?"
                )
            )

        return questions

    # ---------------------------------------------------------
    # Containment guidance
    # ---------------------------------------------------------

    def _containment_actions(
        self,
        incident: Incident,
        signals: dict[str, Any],
    ) -> list[dict[str, Any]]:
        actions: list[
            dict[str, Any]
        ] = []

        def add(
            urgency: str,
            action: str,
            condition: str,
        ) -> None:
            actions.append(
                {
                    "urgency": urgency,
                    "action": action,
                    "condition": condition,
                }
            )

        if (
            incident.incident_type
            == "POTENTIAL_ACCOUNT_COMPROMISE"
        ):
            add(
                "IMMEDIATE",
                (
                    "Consider disabling active sessions "
                    "and resetting credentials"
                ),
                (
                    "Use if the activity cannot be "
                    "validated as legitimate."
                ),
            )

        if (
            incident.incident_type
            == "AUTHENTICATION_ATTACK"
        ):
            add(
                "HIGH",
                (
                    "Consider temporarily restricting "
                    "the attacking source"
                ),
                (
                    "Use if repeated attempts continue "
                    "or the source is unauthorized."
                ),
            )

        if (
            incident.incident_type
            == "SUSPICIOUS_DATA_TRANSFER"
        ):
            add(
                "IMMEDIATE",
                "Review and potentially block the transfer destination",
                (
                    "Use if the destination is unapproved "
                    "or data movement is ongoing."
                ),
            )

        if (
            incident.incident_type
            == "NETWORK_RECONNAISSANCE"
        ):
            add(
                "HIGH",
                "Consider isolating the originating endpoint",
                (
                    "Use if reconnaissance activity "
                    "cannot be explained by legitimate administration."
                ),
            )

        if (
            incident.incident_type
            == "PRIVILEGED_ACCESS_ANOMALY"
        ):
            add(
                "HIGH",
                "Consider temporarily restricting sensitive access",
                (
                    "Use if resource access cannot "
                    "be validated by the user or manager."
                ),
            )

        if not actions:
            add(
                "REVIEW",
                "Continue enhanced monitoring",
                (
                    "Escalate containment if additional "
                    "high-risk behavior appears."
                ),
            )

        return actions