"""
Unit tests for SENTINEL's always-on EventProcessorWorker.

These tests exercise worker orchestration without opening database sessions.

Database transaction semantics are covered separately by PostgreSQL-backed
integration tests.
"""

from __future__ import annotations

import signal
from uuid import uuid4

import pytest

import app.workers.event_processor as worker_module

from app.workers.event_processor import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_POLL_INTERVAL_SECONDS,
    EventProcessorWorker,
    ProcessorConfig,
    load_config,
)


# ============================================================
# Helpers
# ============================================================


def _worker() -> EventProcessorWorker:
    return EventProcessorWorker(
        config=ProcessorConfig(
            poll_interval_seconds=1.0,
            batch_size=10,
            worker_id="pytest-worker",
        )
    )


# ============================================================
# Configuration
# ============================================================


@pytest.mark.unit
def test_load_config_uses_defaults_and_hostname_worker_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(
        "SENTINEL_PROCESSOR_POLL_SECONDS",
        raising=False,
    )

    monkeypatch.delenv(
        "SENTINEL_PROCESSOR_BATCH_SIZE",
        raising=False,
    )

    monkeypatch.delenv(
        "SENTINEL_PROCESSOR_WORKER_ID",
        raising=False,
    )

    monkeypatch.setattr(
        worker_module.socket,
        "gethostname",
        lambda: "pytest-host",
    )

    config = load_config()

    assert (
        config.poll_interval_seconds
        == DEFAULT_POLL_INTERVAL_SECONDS
    )

    assert (
        config.batch_size
        == DEFAULT_BATCH_SIZE
    )

    assert (
        config.worker_id
        == "processor-pytest-host"
    )


@pytest.mark.unit
def test_load_config_accepts_explicit_environment_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "SENTINEL_PROCESSOR_POLL_SECONDS",
        "2.5",
    )

    monkeypatch.setenv(
        "SENTINEL_PROCESSOR_BATCH_SIZE",
        "25",
    )

    monkeypatch.setenv(
        "SENTINEL_PROCESSOR_WORKER_ID",
        "processor-explicit-test",
    )

    config = load_config()

    assert config.poll_interval_seconds == 2.5
    assert config.batch_size == 25

    assert (
        config.worker_id
        == "processor-explicit-test"
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    (
        "poll_value",
        "batch_value",
        "expected_message",
    ),
    [
        (
            "0",
            "10",
            "SENTINEL_PROCESSOR_POLL_SECONDS must be > 0.",
        ),
        (
            "-1",
            "10",
            "SENTINEL_PROCESSOR_POLL_SECONDS must be > 0.",
        ),
        (
            "1",
            "0",
            "SENTINEL_PROCESSOR_BATCH_SIZE must be >= 1.",
        ),
        (
            "1",
            "-4",
            "SENTINEL_PROCESSOR_BATCH_SIZE must be >= 1.",
        ),
    ],
)
def test_load_config_rejects_invalid_runtime_values(
    monkeypatch: pytest.MonkeyPatch,
    poll_value: str,
    batch_value: str,
    expected_message: str,
) -> None:
    monkeypatch.setenv(
        "SENTINEL_PROCESSOR_POLL_SECONDS",
        poll_value,
    )

    monkeypatch.setenv(
        "SENTINEL_PROCESSOR_BATCH_SIZE",
        batch_value,
    )

    with pytest.raises(
        ValueError,
        match=expected_message,
    ):
        load_config()


# ============================================================
# Model preflight
# ============================================================


@pytest.mark.unit
def test_preflight_selected_model_loads_production_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    calls: list[str] = []

    def fake_get_selected_model():
        calls.append(
            "selected-model-loaded"
        )

        return object()

    monkeypatch.setattr(
        worker_module,
        "get_selected_model",
        fake_get_selected_model,
    )

    worker._preflight_selected_model()

    assert calls == [
        "selected-model-loaded"
    ]


# ============================================================
# Batch orchestration
# ============================================================


@pytest.mark.unit
def test_process_available_batch_processes_each_discovered_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    event_ids = [
        uuid4(),
        uuid4(),
        uuid4(),
    ]

    processed_ids = []

    monkeypatch.setattr(
        worker,
        "_discover_event_ids",
        lambda: list(
            event_ids
        ),
    )

    def fake_process_one_event(
        event_id,
    ):
        processed_ids.append(
            event_id
        )

        return object()

    monkeypatch.setattr(
        worker,
        "_process_one_event",
        fake_process_one_event,
    )

    processed_count = (
        worker._process_available_batch()
    )

    assert processed_count == 3

    assert processed_ids == event_ids


@pytest.mark.unit
def test_process_available_batch_counts_only_successful_processing_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    event_ids = [
        uuid4(),
        uuid4(),
        uuid4(),
    ]

    monkeypatch.setattr(
        worker,
        "_discover_event_ids",
        lambda: list(
            event_ids
        ),
    )

    results = {
        event_ids[0]: object(),
        event_ids[1]: None,
        event_ids[2]: object(),
    }

    monkeypatch.setattr(
        worker,
        "_process_one_event",
        lambda event_id: results[
            event_id
        ],
    )

    processed_count = (
        worker._process_available_batch()
    )

    assert processed_count == 2


@pytest.mark.unit
def test_process_available_batch_stops_before_next_event_when_shutdown_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    event_ids = [
        uuid4(),
        uuid4(),
        uuid4(),
    ]

    processed_ids = []

    monkeypatch.setattr(
        worker,
        "_discover_event_ids",
        lambda: list(
            event_ids
        ),
    )

    def fake_process_one_event(
        event_id,
    ):
        processed_ids.append(
            event_id
        )

        worker._stop_requested = True

        return object()

    monkeypatch.setattr(
        worker,
        "_process_one_event",
        fake_process_one_event,
    )

    processed_count = (
        worker._process_available_batch()
    )

    assert processed_count == 1

    assert processed_ids == [
        event_ids[0]
    ]


@pytest.mark.unit
def test_process_available_batch_returns_zero_when_no_work_exists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    monkeypatch.setattr(
        worker,
        "_discover_event_ids",
        lambda: [],
    )

    assert (
        worker._process_available_batch()
        == 0
    )


# ============================================================
# Signal handling
# ============================================================


@pytest.mark.unit
def test_install_signal_handlers_registers_sigint_and_sigterm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    registrations = []

    def fake_signal(
        signum,
        handler,
    ):
        registrations.append(
            (
                signum,
                handler,
            )
        )

    monkeypatch.setattr(
        worker_module.signal,
        "signal",
        fake_signal,
    )

    worker._install_signal_handlers()

    assert registrations == [
        (
            signal.SIGINT,
            worker._handle_shutdown_signal,
        ),
        (
            signal.SIGTERM,
            worker._handle_shutdown_signal,
        ),
    ]


@pytest.mark.unit
def test_shutdown_signal_requests_graceful_stop() -> None:
    worker = _worker()

    assert worker._stop_requested is False

    worker._handle_shutdown_signal(
        signal.SIGTERM,
        None,
    )

    assert worker._stop_requested is True


# ============================================================
# Interruptible sleeping
# ============================================================


@pytest.mark.unit
def test_sleep_interruptibly_uses_short_intervals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    sleep_calls = []

    monkeypatch.setattr(
        worker_module.time,
        "sleep",
        lambda seconds: sleep_calls.append(
            seconds
        ),
    )

    worker._sleep_interruptibly(
        0.6
    )

    assert sleep_calls == pytest.approx(
        [
            0.25,
            0.25,
            0.10,
        ]
    )


@pytest.mark.unit
def test_sleep_interruptibly_stops_immediately_after_shutdown_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    sleep_calls = []

    def fake_sleep(
        seconds: float,
    ) -> None:
        sleep_calls.append(
            seconds
        )

        worker._stop_requested = True

    monkeypatch.setattr(
        worker_module.time,
        "sleep",
        fake_sleep,
    )

    worker._sleep_interruptibly(
        10.0
    )

    assert sleep_calls == [
        0.25
    ]


# ============================================================
# Main worker lifecycle
# ============================================================


@pytest.mark.unit
def test_run_performs_preflight_before_polling_and_stops_cleanly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    call_order = []

    def fake_install_signal_handlers():
        call_order.append(
            "signals"
        )

    def fake_activate():
        call_order.append(
            "activate"
        )

        worker._state_id = uuid4()

    def fake_preflight():
        call_order.append(
            "preflight"
        )

    def fake_process_available_batch():
        call_order.append(
            "poll"
        )

        return 0

    def fake_heartbeat_idle():
        call_order.append(
            "heartbeat"
        )

    def fake_sleep_interruptibly(
        seconds: float,
    ):
        assert seconds == 1.0

        call_order.append(
            "sleep"
        )

        worker._stop_requested = True

    def fake_record_clean_stop():
        call_order.append(
            "clean-stop"
        )

    monkeypatch.setattr(
        worker,
        "_install_signal_handlers",
        fake_install_signal_handlers,
    )

    monkeypatch.setattr(
        worker,
        "_activate",
        fake_activate,
    )

    monkeypatch.setattr(
        worker,
        "_preflight_selected_model",
        fake_preflight,
    )

    monkeypatch.setattr(
        worker,
        "_process_available_batch",
        fake_process_available_batch,
    )

    monkeypatch.setattr(
        worker,
        "_heartbeat_idle",
        fake_heartbeat_idle,
    )

    monkeypatch.setattr(
        worker,
        "_sleep_interruptibly",
        fake_sleep_interruptibly,
    )

    monkeypatch.setattr(
        worker,
        "_record_clean_stop",
        fake_record_clean_stop,
    )

    worker.run()

    assert call_order == [
        "signals",
        "activate",
        "preflight",
        "poll",
        "heartbeat",
        "sleep",
        "clean-stop",
    ]


@pytest.mark.unit
def test_run_records_catastrophic_failure_and_reraises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = _worker()

    state_id = uuid4()

    worker._state_id = state_id

    recorded_failures = []
    clean_stop_calls = []

    monkeypatch.setattr(
        worker,
        "_install_signal_handlers",
        lambda: None,
    )

    monkeypatch.setattr(
        worker,
        "_activate",
        lambda: None,
    )

    def fake_preflight():
        raise RuntimeError(
            "production model preflight failed"
        )

    monkeypatch.setattr(
        worker,
        "_preflight_selected_model",
        fake_preflight,
    )

    monkeypatch.setattr(
        worker,
        "_record_failure",
        lambda error: (
            recorded_failures.append(
                str(
                    error
                )
            )
        ),
    )

    monkeypatch.setattr(
        worker,
        "_record_clean_stop",
        lambda: (
            clean_stop_calls.append(
                True
            )
        ),
    )

    with pytest.raises(
        RuntimeError,
        match="production model preflight failed",
    ):
        worker.run()

    assert recorded_failures == [
        "production model preflight failed"
    ]

    # run() always enters its cleanup path once a state exists.
    # The real _record_clean_stop implementation deliberately preserves
    # FAILED state instead of overwriting it with STOPPED.
    assert clean_stop_calls == [
        True
    ]
