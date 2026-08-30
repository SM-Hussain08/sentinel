from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AnomalyScore,
    Employee,
    Event,
)


DETECTOR_NAME = "isolation-forest"
DETECTOR_VERSION = "1.1"

SEED_RISK_LEVEL = "CRITICAL"

CLUSTER_GAP = timedelta(
    minutes=20,
)

EVIDENCE_PADDING = timedelta(
    minutes=5,
)


@dataclass
class ScoredEvent:
    """
    Observable security event with its selected ML analysis.
    """

    event: Event
    employee: Employee
    anomaly: AnomalyScore


@dataclass
class IncidentCandidate:
    """
    Correlated activity that is strong enough to become an incident.
    """

    primary_employee: Employee

    incident_type: str
    title: str
    severity: str

    first_seen: datetime
    last_seen: datetime

    events: list[ScoredEvent]

    indicators: list[
        dict[str, Any]
    ]

    evidence: dict[
        str,
        Any,
    ]

    summary: str
    correlation_reason: str

    max_anomaly_score: float
    anomaly_count: int


class IncidentCorrelationEngine:
    """
    Correlate individually scored security events into higher-level
    behavioral incidents.

    Ground-truth simulator labels are deliberately not queried or used.
    """

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

    # ---------------------------------------------------------
    # Data loading
    # ---------------------------------------------------------

    def _load_selected_scores(
        self,
    ) -> list[ScoredEvent]:
        rows = self.db.execute(
            select(
                Event,
                Employee,
                AnomalyScore,
            )
            .join(
                Employee,
                Event.employee_id
                == Employee.id,
            )
            .join(
                AnomalyScore,
                AnomalyScore.event_uuid
                == Event.id,
            )
            .where(
                AnomalyScore.detector_name
                == DETECTOR_NAME,

                AnomalyScore.detector_version
                == DETECTOR_VERSION,
            )
            .order_by(
                Employee.user_id,
                Event.timestamp,
            )
        ).all()

        return [
            ScoredEvent(
                event=event,
                employee=employee,
                anomaly=anomaly,
            )
            for (
                event,
                employee,
                anomaly,
            )
            in rows
        ]

    # ---------------------------------------------------------
    # Seed clustering
    # ---------------------------------------------------------

    def _critical_seeds(
        self,
        scored_events: list[
            ScoredEvent
        ],
    ) -> list[ScoredEvent]:
        return [
            item
            for item in scored_events
            if (
                item.anomaly.risk_level
                == SEED_RISK_LEVEL
            )
        ]

    def _group_seed_events(
        self,
        seeds: list[
            ScoredEvent
        ],
    ) -> list[
        list[ScoredEvent]
    ]:
        """
        Group critical events by employee and temporal proximity.

        A common session strengthens the relationship, but the engine
        does not depend on session IDs alone.
        """

        by_employee: dict[
            UUID,
            list[ScoredEvent],
        ] = {}

        for item in seeds:
            by_employee.setdefault(
                item.employee.id,
                [],
            ).append(
                item
            )

        clusters: list[
            list[ScoredEvent]
        ] = []

        for employee_events in (
            by_employee.values()
        ):
            employee_events.sort(
                key=lambda item:
                item.event.timestamp
            )

            current_cluster: list[
                ScoredEvent
            ] = []

            for item in employee_events:
                if not current_cluster:
                    current_cluster = [
                        item
                    ]

                    continue

                previous = (
                    current_cluster[-1]
                )

                time_gap = (
                    item.event.timestamp
                    - previous.event.timestamp
                )

                same_session = (
                    item.event.session_id
                    is not None
                    and
                    previous.event.session_id
                    is not None
                    and
                    item.event.session_id
                    == previous.event.session_id
                )

                if (
                    time_gap
                    <= CLUSTER_GAP
                    or same_session
                ):
                    current_cluster.append(
                        item
                    )

                else:
                    clusters.append(
                        current_cluster
                    )

                    current_cluster = [
                        item
                    ]

            if current_cluster:
                clusters.append(
                    current_cluster
                )

        return clusters

    # ---------------------------------------------------------
    # Cluster quality
    # ---------------------------------------------------------

    @staticmethod
    def _strong_single_event(
        item: ScoredEvent,
    ) -> bool:
        """
        Decide whether one critical event is independently strong enough
        to seed an incident.

        This avoids creating incidents for every isolated borderline
        critical event.
        """

        features = (
            item.anomaly.feature_snapshot
            or {}
        )

        data_ratio = float(
            features.get(
                "data_volume_ratio",
                0.0,
            )
            or 0.0
        )

        failed_logins = int(
            features.get(
                "failed_logins_10m",
                0,
            )
            or 0
        )

        unique_destinations = int(
            features.get(
                "unique_destinations_5m",
                0,
            )
            or 0
        )

        total_bytes = (
            item.event.bytes_sent
            + item.event.bytes_received
        )

        return (
            data_ratio >= 1.0
            or failed_logins >= 3
            or unique_destinations >= 10
            or total_bytes
            >= 1_000_000_000
        )

    def _cluster_is_actionable(
        self,
        cluster: list[
            ScoredEvent
        ],
    ) -> bool:
        if len(cluster) >= 2:
            return True

        return (
            len(cluster) == 1
            and self._strong_single_event(
                cluster[0]
            )
        )

    # ---------------------------------------------------------
    # Evidence expansion
    # ---------------------------------------------------------

    def _expand_cluster(
        self,
        cluster: list[
            ScoredEvent
        ],
        all_scored_events: list[
            ScoredEvent
        ],
    ) -> list[ScoredEvent]:
        """
        Expand around critical seed events to recover the surrounding
        timeline, including lower-scoring events.

        This lets an incident include evidence that occurred just before
        the detector crossed its alert threshold.
        """

        employee_id = (
            cluster[0].employee.id
        )

        first_seed = min(
            item.event.timestamp
            for item in cluster
        )

        last_seed = max(
            item.event.timestamp
            for item in cluster
        )

        start = (
            first_seed
            - EVIDENCE_PADDING
        )

        end = (
            last_seed
            + EVIDENCE_PADDING
        )

        expanded = [
            item
            for item in all_scored_events
            if (
                item.employee.id
                == employee_id
                and start
                <= item.event.timestamp
                <= end
            )
        ]

        return sorted(
            expanded,
            key=lambda item:
            item.event.timestamp,
        )

    # ---------------------------------------------------------
    # Observable signal extraction
    # ---------------------------------------------------------

    @staticmethod
    def _extract_signals(
        events: list[
            ScoredEvent
        ],
    ) -> dict[str, Any]:
        event_types = Counter(
            item.event.event_type
            for item in events
        )

        login_failures = (
            event_types[
                "LOGIN_FAILURE"
            ]
        )

        login_successes = (
            event_types[
                "LOGIN_SUCCESS"
            ]
        )

        file_events = sum(
            event_types[
                event_type
            ]
            for event_type
            in (
                "FILE_ACCESS",
                "FILE_DOWNLOAD",
                "FILE_UPLOAD",
            )
        )

        network_events = (
            event_types[
                "NETWORK_CONNECTION"
            ]
        )

        database_events = (
            event_types[
                "DATABASE_ACCESS"
            ]
        )

        total_bytes_sent = sum(
            item.event.bytes_sent
            for item in events
        )

        total_bytes_received = sum(
            item.event.bytes_received
            for item in events
        )

        max_anomaly_score = max(
            item.anomaly.anomaly_score
            for item in events
        )

        non_baseline_source_events = sum(
            1
            for item in events
            if (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "source_ip_is_baseline",
                        1,
                    )
                    or 0
                )
                == 0
            )
        )

        off_hours_events = sum(
            1
            for item in events
            if (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "outside_work_hours",
                        0,
                    )
                    or 0
                )
                == 1
            )
        )

        max_failed_logins_10m = max(
            (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "failed_logins_10m",
                        0,
                    )
                    or 0
                )
                for item in events
            ),
            default=0,
        )

        max_unique_destinations_5m = max(
            (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "unique_destinations_5m",
                        0,
                    )
                    or 0
                )
                for item in events
            ),
            default=0,
        )

        max_network_events_5m = max(
            (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "network_events_5m",
                        0,
                    )
                    or 0
                )
                for item in events
            ),
            default=0,
        )

        max_file_events_30m = max(
            (
                int(
                    item.anomaly
                    .feature_snapshot
                    .get(
                        "file_events_30m",
                        0,
                    )
                    or 0
                )
                for item in events
            ),
            default=0,
        )

        restricted_resource_events = sum(
            1
            for item in events
            if (
                str(
                    item.event
                    .event_metadata
                    .get(
                        "classification",
                        "",
                    )
                )
                in {
                    "CONFIDENTIAL",
                    "RESTRICTED",
                }
            )
        )

        external_source_events = sum(
            1
            for item in events
            if (
                item.event.source_location
                == (
                    "Unknown External "
                    "Network"
                )
            )
        )

        external_transfer_events = sum(
            1
            for item in events
            if (
                item.event
                .event_metadata
                .get(
                    "destination_type"
                )
                == "EXTERNAL"
            )
        )

        critical_events = sum(
            1
            for item in events
            if (
                item.anomaly.risk_level
                == "CRITICAL"
            )
        )

        anomalous_events = sum(
            1
            for item in events
            if (
                item.anomaly.risk_level
                != "NORMAL"
            )
        )

        return {
            "login_failures":
                login_failures,

            "login_successes":
                login_successes,

            "file_events":
                file_events,

            "network_events":
                network_events,

            "database_events":
                database_events,

            "total_bytes_sent":
                total_bytes_sent,

            "total_bytes_received":
                total_bytes_received,

            "non_baseline_source_events":
                non_baseline_source_events,

            "off_hours_events":
                off_hours_events,

            "max_failed_logins_10m":
                max_failed_logins_10m,

            "max_unique_destinations_5m":
                max_unique_destinations_5m,

            "max_network_events_5m":
                max_network_events_5m,

            "max_file_events_30m":
                max_file_events_30m,

            "restricted_resource_events":
                restricted_resource_events,

            "external_source_events":
                external_source_events,

            "external_transfer_events":
                external_transfer_events,

            "critical_events":
                critical_events,

            "anomalous_events":
                anomalous_events,

            "max_anomaly_score":
                max_anomaly_score,
        }

    # ---------------------------------------------------------
    # Behavioral classification
    # ---------------------------------------------------------

    @staticmethod
    def _classify_incident(
        signals: dict[
            str,
            Any,
        ],
    ) -> tuple[
        str,
        str,
        str,
    ]:
        """
        Infer an incident class strictly from observable behavioral signals.

        Returns:
            incident_type,
            title,
            severity
        """

        login_failures = (
            signals[
                "login_failures"
            ]
        )

        login_successes = (
            signals[
                "login_successes"
            ]
        )

        file_events = (
            signals[
                "file_events"
            ]
        )

        database_events = (
            signals[
                "database_events"
            ]
        )

        network_events = (
            signals[
                "network_events"
            ]
        )

        total_bytes_sent = (
            signals[
                "total_bytes_sent"
            ]
        )

        total_bytes_received = (
            signals[
                "total_bytes_received"
            ]
        )

        max_unique_destinations = (
            signals[
                "max_unique_destinations_5m"
            ]
        )

        restricted_events = (
            signals[
                "restricted_resource_events"
            ]
        )

        off_hours_events = (
            signals[
                "off_hours_events"
            ]
        )

        # Credential guessing followed by successful use.
        if (
            login_failures >= 3
            and login_successes >= 1
            and (
                file_events >= 1
                or database_events >= 1
            )
        ):
            return (
                "POTENTIAL_ACCOUNT_COMPROMISE",
                "Potential Account Compromise",
                "CRITICAL",
            )

        # Large outward movement of data.
        if (
            file_events >= 1
            and total_bytes_sent
            >= 1_000_000_000
        ):
            return (
                "SUSPICIOUS_DATA_TRANSFER",
                "Suspicious Data Transfer",
                "CRITICAL",
            )

        # Rapid connection fan-out to many destinations.
        if (
            network_events >= 8
            and max_unique_destinations
            >= 8
        ):
            return (
                "NETWORK_RECONNAISSANCE",
                "Potential Network Reconnaissance",
                "HIGH",
            )

        # Repeated unsuccessful authentication attempts.
        if login_failures >= 5:
            return (
                "AUTHENTICATION_ATTACK",
                "Repeated Authentication Attack",
                "HIGH",
            )

        # Valid identity + unusual sensitive file activity.
        if (
            file_events >= 5
            and (
                restricted_events >= 3
                or total_bytes_received
                >= 500_000_000
            )
            and off_hours_events >= 1
        ):
            return (
                "PRIVILEGED_ACCESS_ANOMALY",
                "Privileged Access Anomaly",
                "HIGH",
            )

        return (
            "GENERAL_BEHAVIORAL_ANOMALY",
            "Correlated Behavioral Anomaly",
            "MEDIUM",
        )

    # ---------------------------------------------------------
    # Explainability
    # ---------------------------------------------------------

    @staticmethod
    def _build_indicators(
        signals: dict[
            str,
            Any,
        ],
    ) -> list[
        dict[str, Any]
    ]:
        indicators: list[
            dict[str, Any]
        ] = []

        def add(
            indicator_type: str,
            label: str,
            value: Any,
            severity: str,
        ) -> None:
            indicators.append(
                {
                    "type":
                        indicator_type,

                    "label":
                        label,

                    "value":
                        value,

                    "severity":
                        severity,
                }
            )

        if (
            signals[
                "login_failures"
            ]
            >= 3
        ):
            add(
                "authentication",
                "Repeated login failures",
                signals[
                    "login_failures"
                ],
                "HIGH",
            )

        if (
            signals[
                "login_successes"
            ]
            >= 1
            and
            signals[
                "login_failures"
            ]
            >= 3
        ):
            add(
                "authentication",
                (
                    "Successful login after "
                    "multiple failures"
                ),
                True,
                "CRITICAL",
            )

        if (
            signals[
                "non_baseline_source_events"
            ]
            > 0
        ):
            add(
                "identity",
                "Non-baseline source activity",
                signals[
                    "non_baseline_source_events"
                ],
                "HIGH",
            )

        if (
            signals[
                "off_hours_events"
            ]
            > 0
        ):
            add(
                "temporal",
                "Off-hours activity",
                signals[
                    "off_hours_events"
                ],
                "MEDIUM",
            )

        if (
            signals[
                "max_unique_destinations_5m"
            ]
            >= 8
        ):
            add(
                "network",
                (
                    "Rapid unique destination "
                    "fan-out"
                ),
                signals[
                    "max_unique_destinations_5m"
                ],
                "HIGH",
            )

        if (
            signals[
                "total_bytes_sent"
            ]
            >= 1_000_000_000
        ):
            add(
                "data_transfer",
                "Large outbound transfer",
                signals[
                    "total_bytes_sent"
                ],
                "CRITICAL",
            )

        if (
            signals[
                "restricted_resource_events"
            ]
            >= 1
        ):
            add(
                "resource",
                (
                    "Sensitive resource "
                    "access"
                ),
                signals[
                    "restricted_resource_events"
                ],
                "HIGH",
            )

        if (
            signals[
                "max_file_events_30m"
            ]
            >= 5
        ):
            add(
                "file_activity",
                "Burst file activity",
                signals[
                    "max_file_events_30m"
                ],
                "MEDIUM",
            )

        return indicators

    @staticmethod
    def _build_summary(
        incident_type: str,
        employee: Employee,
        signals: dict[
            str,
            Any,
        ],
    ) -> str:
        summaries = {
            "POTENTIAL_ACCOUNT_COMPROMISE":
                (
                    f"Correlated authentication "
                    f"failures and subsequent "
                    f"resource access were observed "
                    f"for {employee.user_id}."
                ),

            "SUSPICIOUS_DATA_TRANSFER":
                (
                    f"Unusual file activity and "
                    f"large outbound data movement "
                    f"were correlated for "
                    f"{employee.user_id}."
                ),

            "NETWORK_RECONNAISSANCE":
                (
                    f"Rapid network activity across "
                    f"multiple destinations was "
                    f"observed for "
                    f"{employee.user_id}."
                ),

            "AUTHENTICATION_ATTACK":
                (
                    f"Repeated authentication "
                    f"failures were correlated for "
                    f"{employee.user_id}."
                ),

            "PRIVILEGED_ACCESS_ANOMALY":
                (
                    f"Unusual off-hours access to "
                    f"sensitive resources was "
                    f"correlated for "
                    f"{employee.user_id}."
                ),

            "GENERAL_BEHAVIORAL_ANOMALY":
                (
                    f"Multiple high-risk behavioral "
                    f"signals were correlated for "
                    f"{employee.user_id}."
                ),
        }

        return summaries[
            incident_type
        ]

    # ---------------------------------------------------------
    # Candidate construction
    # ---------------------------------------------------------

    def _candidate_from_cluster(
        self,
        cluster: list[
            ScoredEvent
        ],
        all_scored_events: list[
            ScoredEvent
        ],
    ) -> IncidentCandidate:
        expanded = self._expand_cluster(
            cluster,
            all_scored_events,
        )

        employee = (
            cluster[0].employee
        )

        signals = (
            self._extract_signals(
                expanded
            )
        )

        (
            incident_type,
            title,
            severity,
        ) = self._classify_incident(
            signals
        )

        indicators = (
            self._build_indicators(
                signals
            )
        )

        first_seen = min(
            item.event.timestamp
            for item in expanded
        )

        last_seen = max(
            item.event.timestamp
            for item in expanded
        )

        correlation_reason = (
            f"{signals['critical_events']} "
            f"critical Isolation Forest "
            f"alerts were correlated for "
            f"{employee.user_id} within a "
            f"{int(CLUSTER_GAP.total_seconds() / 60)}-minute "
            f"activity window."
        )

        evidence = {
            "correlation_engine":
                "multi-signal-rules",

            "correlation_version":
                "1.0",

            "detector_name":
                DETECTOR_NAME,

            "detector_version":
                DETECTOR_VERSION,

            "signals":
                signals,
        }

        return IncidentCandidate(
            primary_employee=employee,

            incident_type=(
                incident_type
            ),

            title=title,
            severity=severity,

            first_seen=first_seen,
            last_seen=last_seen,

            events=expanded,

            indicators=indicators,
            evidence=evidence,

            summary=(
                self._build_summary(
                    incident_type,
                    employee,
                    signals,
                )
            ),

            correlation_reason=(
                correlation_reason
            ),

            max_anomaly_score=float(
                signals[
                    "max_anomaly_score"
                ]
            ),

            anomaly_count=int(
                signals[
                    "anomalous_events"
                ]
            ),
        )

    # ---------------------------------------------------------
    # Public entry point
    # ---------------------------------------------------------

    def correlate(
        self,
    ) -> list[
        IncidentCandidate
    ]:
        all_scored_events = (
            self._load_selected_scores()
        )

        seeds = self._critical_seeds(
            all_scored_events
        )

        seed_clusters = (
            self._group_seed_events(
                seeds
            )
        )

        actionable_clusters = [
            cluster
            for cluster
            in seed_clusters
            if self._cluster_is_actionable(
                cluster
            )
        ]

        candidates = [
            self._candidate_from_cluster(
                cluster,
                all_scored_events,
            )
            for cluster
            in actionable_clusters
        ]

        return sorted(
            candidates,
            key=lambda candidate:
            candidate.first_seen,
        )