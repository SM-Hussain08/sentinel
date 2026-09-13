"""
SENTINEL AI Grounding Validation

This script compares:
1. Incident detail
2. Correlated timeline
3. Deterministic investigation
4. Local AI investigation

It is intended for manual grounding validation during Phase 7.9.

The script DOES NOT use simulator ground-truth labels.
"""

from __future__ import annotations

import argparse
from collections import Counter
from typing import Any

import httpx


API_BASE_URL = "http://127.0.0.1:8000/api/v1"

# These values must never appear in operational AI output.
FORBIDDEN_GROUND_TRUTH_TERMS = {
    "is_injected_anomaly",
    "scenario_type",
    "simulation_batch",
}


def get_json(
    endpoint: str,
) -> Any:
    """Send a GET request and return parsed JSON."""

    response = httpx.get(
        f"{API_BASE_URL}{endpoint}",
        timeout=15.0,
    )

    response.raise_for_status()

    return response.json()


def post_json(
    endpoint: str,
) -> Any:
    """Send a POST request and return parsed JSON."""

    response = httpx.post(
        f"{API_BASE_URL}{endpoint}",
        timeout=110.0,
    )

    response.raise_for_status()

    return response.json()


def heading(
    title: str,
) -> None:
    """Print a readable console section heading."""

    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


def print_list(
    values: list[str],
) -> None:
    """Print a numbered list."""

    if not values:
        print("  None")
        return

    for index, value in enumerate(
        values,
        start=1,
    ):
        print(
            f"  {index}. {value}",
        )


def validate_forbidden_terms(
    ai_response: dict[str, Any],
) -> None:
    """
    Check that simulator-only ground-truth terms
    are absent from the AI response.
    """

    serialized = str(
        ai_response,
    ).lower()

    leaked_terms = [
        term
        for term in FORBIDDEN_GROUND_TRUTH_TERMS
        if term.lower() in serialized
    ]

    heading(
        "AUTOMATED GROUND-TRUTH LEAKAGE CHECK",
    )

    if leaked_terms:
        print(
            "FAIL - forbidden simulator terms found:",
        )

        for term in leaked_terms:
            print(
                f"  - {term}",
            )
    else:
        print(
            "PASS - no simulator ground-truth terms found.",
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Validate SENTINEL local AI grounding "
            "for one incident."
        ),
    )

    parser.add_argument(
        "incident_id",
        help="Example: INC-2026-0005",
    )

    args = parser.parse_args()

    incident_id = args.incident_id


    print()
    print(
        f"Validating AI grounding for {incident_id}",
    )


    #
    # Retrieve deterministic operational data.
    #

    detail = get_json(
        f"/incidents/{incident_id}",
    )

    timeline = get_json(
        f"/incidents/{incident_id}/timeline",
    )

    investigation = get_json(
        f"/incidents/{incident_id}/investigation",
    )


    #
    # Derive simple observable facts from
    # the correlated timeline.
    #

    event_type_counts = Counter(
        event["event_type"]
        for event in timeline
    )

    source_ips = sorted({
        event["source_ip"]
        for event in timeline
        if event.get("source_ip")
    })

    destination_ips = sorted({
        event["destination_ip"]
        for event in timeline
        if event.get("destination_ip")
    })

    max_anomaly_score = max(
        (
            event["anomaly_score"]
            for event in timeline
        ),
        default=0.0,
    )


    heading(
        "DETERMINISTIC INCIDENT FACTS",
    )

    print(
        f"Incident ID:       {detail['incident_id']}",
    )

    print(
        f"Incident type:     {detail['incident_type']}",
    )

    print(
        f"Severity:          {detail['severity']}",
    )

    print(
        f"Affected identity: "
        f"{detail.get('primary_employee_user_id')}",
    )

    print(
        f"Correlated events: {detail['event_count']}",
    )

    print(
        f"Anomaly events:    {detail['anomaly_count']}",
    )

    print(
        f"Peak anomaly:      {max_anomaly_score:.4f}",
    )


    heading(
        "OBSERVED EVENT-TYPE COUNTS",
    )

    for event_type, count in sorted(
        event_type_counts.items(),
    ):
        print(
            f"{event_type:<24} {count}",
        )


    heading(
        "OBSERVED SOURCE IPS",
    )

    if source_ips:
        for source_ip in source_ips:
            print(
                f"  - {source_ip}",
            )
    else:
        print(
            "  None",
        )


    heading(
        "OBSERVED DESTINATION IPS",
    )

    if destination_ips:
        for destination_ip in destination_ips:
            print(
                f"  - {destination_ip}",
            )
    else:
        print(
            "  None",
        )


    heading(
        "DETERMINISTIC KEY FINDINGS",
    )

    for index, finding in enumerate(
        investigation["key_findings"],
        start=1,
    ):
        print(
            f"{index}. "
            f"[{finding['category']}] "
            f"{finding['finding']}"
        )

        print(
            f"   Observed value: "
            f"{finding.get('value')}"
        )


    heading(
        "DETERMINISTIC INVESTIGATION STEPS",
    )

    for step in investigation[
        "investigation_steps"
    ]:
        print(
            f"{step['priority']}. "
            f"{step['action']}"
        )

        print(
            f"   Reason: {step['reason']}",
        )


    #
    # Generate the local AI investigation.
    #

    heading(
        "REQUESTING LOCAL AI INVESTIGATION",
    )

    print(
        "This can take approximately 30-90 seconds...",
    )

    ai_response = post_json(
        f"/ai/incidents/{incident_id}/investigation",
    )

    content = ai_response[
        "content"
    ]


    heading(
        "AI EXECUTIVE ASSESSMENT",
    )

    print(
        content[
            "executive_assessment"
        ],
    )


    heading(
        "AI - WHY SUSPICIOUS",
    )

    print_list(
        content[
            "why_suspicious"
        ],
    )


    heading(
        "AI - TIMELINE INTERPRETATION",
    )

    print(
        content[
            "timeline_interpretation"
        ],
    )


    heading(
        "AI - INVESTIGATION PRIORITIES",
    )

    print_list(
        content[
            "investigation_priorities"
        ],
    )


    heading(
        "AI - CONTAINMENT CONSIDERATIONS",
    )

    print_list(
        content[
            "containment_considerations"
        ],
    )


    heading(
        "AI - CONFIDENCE",
    )

    print(
        content[
            "confidence"
        ],
    )


    heading(
        "AI - LIMITATIONS",
    )

    print_list(
        content[
            "limitations"
        ],
    )


    heading(
        "GENERATION METADATA",
    )

    print(
        f"Provider:   {ai_response['provider']}",
    )

    print(
        f"Model:      {ai_response['model']}",
    )

    print(
        "Grounded:   "
        f"{ai_response['grounded_on_deterministic_evidence']}",
    )

    print(
        "Duration:   "
        f"{ai_response['generation_duration_ms'] / 1000:.1f}s",
    )


    validate_forbidden_terms(
        ai_response,
    )


    heading(
        "MANUAL GROUNDING REVIEW",
    )

    print(
        "[ ] All numerical counts match the deterministic facts above."
    )

    print(
        "[ ] Every IP/resource mentioned by AI exists in the evidence."
    )

    print(
        "[ ] AI does not invent malware, devices, users, or attacker identity."
    )

    print(
        "[ ] AI does not claim compromise as proven fact unless evidence proves it."
    )

    print(
        "[ ] High anomaly percentile is treated as unusualness, not attack probability."
    )

    print(
        "[ ] Containment guidance remains conditional where legitimacy is unresolved."
    )

    print(
        "[ ] Limitations clearly state what the evidence cannot establish."
    )

    print(
        "[ ] No simulator ground-truth or injected-scenario information appears."
    )

    print()


if __name__ == "__main__":
    main()