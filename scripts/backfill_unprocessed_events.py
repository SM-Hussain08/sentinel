"""
Explicit SENTINEL maintenance backfill.

Usage
-----

Process every Event currently missing the selected detector version:

    python scripts/backfill_unprocessed_events.py

Process only one UTC Event date:

    python scripts/backfill_unprocessed_events.py 2026-09-17

Inspect without changing anything:

    python scripts/backfill_unprocessed_events.py --dry-run

    python scripts/backfill_unprocessed_events.py 2026-09-17 --dry-run

Important
---------

This is NOT a second daemon.

The always-on event processor remains SENTINEL's normal operational path.

This utility exists for:
- historical Events;
- recovery after older bugs;
- model-version migrations;
- explicit maintenance/reprocessing.

It uses the same operational Event pipeline as live processing, but does not
change the live processor activation boundary, heartbeat or counters.
"""

from __future__ import annotations

import argparse
from datetime import (
    date,
)
from pathlib import Path
import sys
import time


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

project_root_string = str(
    PROJECT_ROOT
)

if (
    project_root_string
    not in sys.path
):
    sys.path.insert(
        0,
        project_root_string,
    )


import scripts._bootstrap  # noqa: E402,F401

from app.database.session import (  # noqa: E402
    SessionLocal,
)

from app.selected_detector import (  # noqa: E402
    SELECTED_DETECTOR,
)

from app.services.event_backfill import (  # noqa: E402
    DEFAULT_BACKFILL_BATCH_SIZE,
    count_unprocessed_events,
    discover_unprocessed_events,
)

from app.services.event_processing import (  # noqa: E402
    EventProcessingService,
)


def parse_date(
    value: str,
) -> date:
    try:
        return date.fromisoformat(
            value
        )

    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            (
                "Date must use YYYY-MM-DD format. "
                f"Received: {value!r}"
            )
        ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Process SENTINEL Events missing the "
            "currently selected detector version."
        )
    )

    parser.add_argument(
        "date",
        nargs="?",
        type=parse_date,
        default=None,
        help=(
            "Optional UTC Event date in YYYY-MM-DD format. "
            "If omitted, all unprocessed Events are eligible."
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=(
            DEFAULT_BACKFILL_BATCH_SIZE
        ),
        help=(
            "Discovery batch size. "
            f"Default: {DEFAULT_BACKFILL_BATCH_SIZE}"
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Show how many Events are eligible "
            "without processing them."
        ),
    )

    return parser.parse_args()


def print_header(
    *,
    requested_date: date | None,
    eligible_events: int,
    dry_run: bool,
) -> None:
    print()
    print(
        "SENTINEL explicit event backfill"
    )
    print(
        "=" * 72
    )

    print(
        "Detector             : "
        f"{SELECTED_DETECTOR.name} "
        f"v{SELECTED_DETECTOR.version}"
    )

    print(
        "Scope                : "
        + (
            (
                requested_date.isoformat()
                + " UTC"
            )
            if requested_date is not None
            else "ALL unprocessed Events"
        )
    )

    print(
        "Eligible Events      : "
        f"{eligible_events:,}"
    )

    print(
        "Mode                 : "
        + (
            "DRY RUN"
            if dry_run
            else "PROCESS"
        )
    )

    print(
        "=" * 72
    )


def run_backfill(
    *,
    requested_date: date | None,
    batch_size: int,
    dry_run: bool,
) -> None:
    if batch_size < 1:
        raise ValueError(
            "--batch-size must be >= 1."
        )

    db = SessionLocal()

    try:
        eligible_events = (
            count_unprocessed_events(
                db=db,
                requested_date=(
                    requested_date
                ),
            )
        )

    finally:
        db.close()

    print_header(
        requested_date=(
            requested_date
        ),
        eligible_events=(
            eligible_events
        ),
        dry_run=dry_run,
    )

    if dry_run:
        print()
        print(
            "No database changes were made."
        )
        return

    if eligible_events == 0:
        print()
        print(
            "Nothing to backfill."
        )
        return

    started = time.monotonic()

    processed = 0
    skipped = 0

    incidents_created = 0
    incidents_updated = 0

    risk_counts = {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0,
        "NORMAL": 0,
    }

    while True:
        discovery_db = (
            SessionLocal()
        )

        try:
            discovery = (
                discover_unprocessed_events(
                    db=discovery_db,
                    requested_date=(
                        requested_date
                    ),
                    batch_size=(
                        batch_size
                    ),
                )
            )

            event_ids = [
                event.id
                for event
                in discovery.events
            ]

        finally:
            discovery_db.close()

        if not event_ids:
            break

        for event_id in event_ids:
            event_db = SessionLocal()

            try:
                service = (
                    EventProcessingService(
                        db=event_db
                    )
                )

                result = (
                    service
                    .process_event_backfill(
                        event_id=event_id
                    )
                )

                event_db.commit()

            except Exception:
                event_db.rollback()
                raise

            finally:
                event_db.close()

            if (
                result.status
                == "PROCESSED"
            ):
                processed += 1

                incidents_created += (
                    result.incidents_created
                )

                incidents_updated += (
                    result.incidents_updated
                )

                if (
                    result.risk_level
                    in risk_counts
                ):
                    risk_counts[
                        result.risk_level
                    ] += 1

            else:
                skipped += 1

            completed = (
                processed
                + skipped
            )

            if (
                completed % 100 == 0
                or completed
                == eligible_events
            ):
                print(
                    (
                        f"[{completed:,}/"
                        f"{eligible_events:,}] "
                        f"processed={processed:,} "
                        f"skipped={skipped:,} "
                        f"incidents_created="
                        f"{incidents_created:,} "
                        f"incidents_updated="
                        f"{incidents_updated:,}"
                    )
                )

    elapsed = (
        time.monotonic()
        - started
    )

    print()
    print(
        "Backfill complete."
    )
    print(
        "=" * 72
    )

    print(
        f"Processed             : "
        f"{processed:,}"
    )

    print(
        f"Skipped               : "
        f"{skipped:,}"
    )

    print(
        f"Incidents created     : "
        f"{incidents_created:,}"
    )

    print(
        f"Incidents updated     : "
        f"{incidents_updated:,}"
    )

    print(
        f"Elapsed seconds       : "
        f"{elapsed:.2f}"
    )

    print()
    print(
        "Risk distribution"
    )
    print(
        "-" * 72
    )

    for risk_level in (
        "CRITICAL",
        "HIGH",
        "MEDIUM",
        "LOW",
        "NORMAL",
    ):
        print(
            f"{risk_level:<20}"
            f"{risk_counts[risk_level]:>10,}"
        )

    print(
        "=" * 72
    )


def main() -> None:
    args = parse_args()

    run_backfill(
        requested_date=args.date,
        batch_size=(
            args.batch_size
        ),
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
