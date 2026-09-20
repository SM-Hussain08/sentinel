"""
Always-on SENTINEL operational event processor.

Responsibilities
----------------
- activate/resume the selected detector generation;
- discover newly arrived live Events;
- process each Event in its own atomic transaction;
- maintain processor heartbeat and counters;
- shut down cleanly on SIGINT / SIGTERM.

This worker is independent from the simulator.

The simulator only generates observable Events.
The processor notices those Events and performs:

    feature engineering
      -> ML scoring
      -> incremental correlation
      -> incident persistence
      -> deterministic investigation

No simulator ground truth is consulted.
No Ollama / generative AI is invoked.
"""

from __future__ import annotations

import logging
import os
import signal
import socket
import time
from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.database.session import (
    SessionLocal,
)

from app.services.event_processing import (
    EventProcessingService,
)

from app.services.ml_scoring import (
    get_selected_model,
)

from app.services.event_processor_runtime import (
    activate_processor,
    discover_live_events,
    heartbeat_processor,
    mark_processor_failed,
    mark_processor_running,
    mark_processor_stopped,
)


LOGGER = logging.getLogger(
    "sentinel.event_processor"
)

DEFAULT_POLL_INTERVAL_SECONDS: Final[
    float
] = 1.0

DEFAULT_BATCH_SIZE: Final[int] = 100

WORKER_VERSION: Final[str] = "1.0"


@dataclass
class ProcessorConfig:
    poll_interval_seconds: float

    batch_size: int

    worker_id: str


class EventProcessorWorker:
    """
    Long-running operational processor.
    """

    def __init__(
        self,
        *,
        config: ProcessorConfig,
    ) -> None:
        self.config = config

        self._stop_requested = False

        self._state_id = None

    # ========================================================
    # Lifecycle
    # ========================================================

    def run(
        self,
    ) -> None:
        """
        Start the processor loop.

        The processor performs a production-model preflight before
        consuming any Events. If the selected detector artifact is
        missing, unreadable, or incompatible, the worker records a
        FAILED runtime state instead of remaining alive with an
        unusable scoring pipeline.
        """

        self._install_signal_handlers()

        LOGGER.info(
            "Starting SENTINEL event processor."
        )

        self._activate()

        try:
            self._preflight_selected_model()

            while not self._stop_requested:
                processed_count = (
                    self._process_available_batch()
                )

                if processed_count == 0:
                    self._heartbeat_idle()

                    self._sleep_interruptibly(
                        self.config
                        .poll_interval_seconds
                    )

        except Exception as exc:
            LOGGER.exception(
                "Event processor failed."
            )

            self._record_failure(
                exc
            )

            raise

        finally:
            if self._state_id is not None:
                self._record_clean_stop()

            LOGGER.info(
                "SENTINEL event processor stopped."
            )

    # ========================================================
    # Activation
    # ========================================================

    def _activate(
        self,
    ) -> None:
        db = SessionLocal()

        try:
            state = activate_processor(
                db=db,

                worker_id=(
                    self.config.worker_id
                ),

                configuration={
                    "poll_interval_seconds":
                        self.config
                        .poll_interval_seconds,

                    "batch_size":
                        self.config.batch_size,

                    "worker_version":
                        WORKER_VERSION,
                },
            )

            mark_processor_running(
                db=db,
                state=state,
            )

            db.commit()

            self._state_id = (
                state.id
            )

            LOGGER.info(
                (
                    "Processor active. "
                    "state=%s "
                    "activated_at=%s "
                    "detector=%s v%s"
                ),
                state.id,
                state.activated_at,
                state.detector_name,
                state.detector_version,
            )

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    # ========================================================
    # Preflight Check
    # ========================================================

    def _preflight_selected_model(
        self,
    ) -> None:
        """
        Load and validate the selected production detector before
        the worker begins consuming live Events.

        get_selected_model() verifies that the selected artifact
        exists and can be deserialized. It is cached afterward, so
        live scoring reuses the same loaded model.
        """

        get_selected_model()

        LOGGER.info(
            "Selected production model preflight passed."
        )

    # ========================================================
    # Work discovery
    # ========================================================

    def _process_available_batch(
        self,
    ) -> int:
        """
        Discover one live batch, then process each Event separately.

        Discovery itself is read-only.

        Each Event receives its own database transaction so failure on
        one Event does not roll back already-completed earlier Events.
        """

        event_ids = (
            self._discover_event_ids()
        )

        if not event_ids:
            return 0

        processed = 0

        for event_id in event_ids:
            if self._stop_requested:
                break

            result = (
                self._process_one_event(
                    event_id
                )
            )

            if result is not None:
                processed += 1

        return processed

    def _discover_event_ids(
        self,
    ) -> list:
        db = SessionLocal()

        try:
            state = db.get(
                self._state_model(),
                self._state_id,
            )

            if state is None:
                raise RuntimeError(
                    "Processor state disappeared."
                )

            result = discover_live_events(
                db=db,

                state=state,

                batch_size=(
                    self.config.batch_size
                ),
            )

            return [
                event.id
                for event
                in result.events
            ]

        finally:
            db.close()

    # ========================================================
    # Per-event transaction
    # ========================================================

    def _process_one_event(
        self,
        event_id,
    ):
        db = SessionLocal()

        try:
            service = (
                EventProcessingService(
                    db=db
                )
            )

            result = (
                service.process_event(
                    event_id=event_id,
                    processor_state_id=(
                        self._state_id
                    ),
                )
            )

            db.commit()

            LOGGER.info(
                (
                    "event=%s status=%s "
                    "risk=%s score=%s "
                    "created=%s updated=%s"
                ),
                result.event_id,
                result.status,
                result.risk_level,
                result.anomaly_score,
                result.incidents_created,
                result.incidents_updated,
            )

            return result

        except Exception as exc:
            db.rollback()

            LOGGER.exception(
                (
                    "Failed processing Event "
                    "%s."
                ),
                event_id,
            )

            self._record_event_error(
                exc
            )

            # Do not kill the entire processor for one malformed Event.
            return None

        finally:
            db.close()

    # ========================================================
    # Heartbeat
    # ========================================================

    def _heartbeat_idle(
        self,
    ) -> None:
        db = SessionLocal()

        try:
            state = db.get(
                self._state_model(),
                self._state_id,
            )

            if state is None:
                raise RuntimeError(
                    "Processor state disappeared."
                )

            heartbeat_processor(
                db=db,
                state=state,
                runtime_metadata={
                    "worker_state":
                        "idle",

                    "last_poll_epoch":
                        time.time(),
                },
            )

            db.commit()

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    # ========================================================
    # Failure / shutdown state
    # ========================================================

    def _record_event_error(
        self,
        error: Exception,
    ) -> None:
        """
        Keep processor alive but expose the latest per-event error.
        """

        db = SessionLocal()

        try:
            state = db.get(
                self._state_model(),
                self._state_id,
            )

            if state is None:
                return

            state.last_error = str(
                error
            )

            heartbeat_processor(
                db=db,
                state=state,
                runtime_metadata={
                    "last_event_error":
                        str(
                            error
                        ),
                },
            )

            db.commit()

        except Exception:
            db.rollback()

            LOGGER.exception(
                "Could not record processor event error."
            )

        finally:
            db.close()

    def _record_failure(
        self,
        error: Exception,
    ) -> None:
        if self._state_id is None:
            return

        db = SessionLocal()

        try:
            state = db.get(
                self._state_model(),
                self._state_id,
            )

            if state is None:
                return

            mark_processor_failed(
                db=db,
                state=state,
                error=error,
            )

            db.commit()

        except Exception:
            db.rollback()

            LOGGER.exception(
                "Could not record processor failure."
            )

        finally:
            db.close()

    def _record_clean_stop(
        self,
    ) -> None:
        db = SessionLocal()

        try:
            state = db.get(
                self._state_model(),
                self._state_id,
            )

            if state is None:
                return

            # Preserve FAILED if the outer loop failed.
            if state.status == "failed":
                return

            mark_processor_stopped(
                db=db,
                state=state,
            )

            db.commit()

        except Exception:
            db.rollback()

            LOGGER.exception(
                "Could not record clean processor stop."
            )

        finally:
            db.close()

    # ========================================================
    # Signals
    # ========================================================

    def _install_signal_handlers(
        self,
    ) -> None:
        signal.signal(
            signal.SIGINT,
            self._handle_shutdown_signal,
        )

        signal.signal(
            signal.SIGTERM,
            self._handle_shutdown_signal,
        )

    def _handle_shutdown_signal(
        self,
        signum,
        frame,
    ) -> None:
        del frame

        LOGGER.info(
            (
                "Shutdown signal received: "
                "%s"
            ),
            signum,
        )

        self._stop_requested = True

    # ========================================================
    # Utilities
    # ========================================================

    def _sleep_interruptibly(
        self,
        seconds: float,
    ) -> None:
        """
        Sleep in short intervals so shutdown feels immediate.
        """

        remaining = seconds

        while (
            remaining > 0
            and not self._stop_requested
        ):
            interval = min(
                0.25,
                remaining,
            )

            time.sleep(
                interval
            )

            remaining -= interval

    @staticmethod
    def _state_model():
        """
        Local import avoids widening module import cycles.
        """

        from app.models import (
            EventProcessorState,
        )

        return EventProcessorState


# ============================================================
# Configuration
# ============================================================

def load_config(
) -> ProcessorConfig:
    poll_interval = float(
        os.getenv(
            "SENTINEL_PROCESSOR_POLL_SECONDS",
            str(
                DEFAULT_POLL_INTERVAL_SECONDS
            ),
        )
    )

    batch_size = int(
        os.getenv(
            "SENTINEL_PROCESSOR_BATCH_SIZE",
            str(
                DEFAULT_BATCH_SIZE
            ),
        )
    )

    if poll_interval <= 0:
        raise ValueError(
            (
                "SENTINEL_PROCESSOR_POLL_SECONDS "
                "must be > 0."
            )
        )

    if batch_size < 1:
        raise ValueError(
            (
                "SENTINEL_PROCESSOR_BATCH_SIZE "
                "must be >= 1."
            )
        )

    worker_id = os.getenv(
        "SENTINEL_PROCESSOR_WORKER_ID"
    )

    if not worker_id:
        worker_id = (
            "processor-"
            + socket.gethostname()
        )

    return ProcessorConfig(
        poll_interval_seconds=(
            poll_interval
        ),

        batch_size=batch_size,

        worker_id=worker_id,
    )


def configure_logging(
) -> None:
    logging.basicConfig(
        level=logging.INFO,

        format=(
            "%(asctime)s "
            "%(levelname)s "
            "%(name)s "
            "%(message)s"
        ),
    )


def main(
) -> None:
    configure_logging()

    worker = EventProcessorWorker(
        config=load_config()
    )

    worker.run()


if __name__ == "__main__":
    main()
