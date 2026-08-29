import { useEffect, useMemo, useState } from "react";

import {
  getAnomalies,
  getEmployees,
  getEvents,
} from "./services/api";

import type {
  AnomalyResult,
  Employee,
  SecurityEvent,
} from "./types/api";


function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const unitIndex = Math.floor(
    Math.log(bytes) / Math.log(1024),
  );

  const value = bytes / Math.pow(1024, unitIndex);

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}


function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}


function riskClass(riskLevel: string): string {
  switch (riskLevel) {
    case "CRITICAL":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "HIGH":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";

    case "MEDIUM":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "LOW":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}


function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    async function loadSentinelData() {
      try {
        setIsLoading(true);
        setError(null);

        const [
          employeeData,
          eventData,
          anomalyData,
        ] = await Promise.all([
          getEmployees(),
          getEvents(),
          getAnomalies(),
        ]);

        setEmployees(employeeData);
        setEvents(eventData);
        setAnomalies(anomalyData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred.";

        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadSentinelData();
  }, []);


  const anomalyMap = useMemo(() => {
    return new Map(
      anomalies.map((anomaly) => [
        anomaly.event_id,
        anomaly,
      ]),
    );
  }, [anomalies]);


  const totalTransferred = useMemo(() => {
    return events.reduce(
      (total, event) =>
        total + event.bytes_sent + event.bytes_received,
      0,
    );
  }, [events]);


  const highestRisk = useMemo(() => {
    if (anomalies.length === 0) {
      return null;
    }

    return anomalies.reduce(
      (highest, current) =>
        current.anomaly_score > highest.anomaly_score
          ? current
          : highest,
    );
  }, [anomalies]);


  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">

        <header className="mb-10 flex flex-col gap-6 border-b border-slate-800/80 pb-8 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />

              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400">
                Security Intelligence Platform
              </p>
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              SENTINEL
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Behavioral anomaly detection and incident intelligence
              for a simulated enterprise environment.
            </p>
          </div>


          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Detection Online
              </p>

              <p className="text-xs text-slate-500">
                API + Database + Scoring
              </p>
            </div>
          </div>

        </header>


        {isLoading && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
              Loading security intelligence...
            </p>
          </section>
        )}


        {error && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="font-semibold text-red-300">
              Backend connection failed
            </p>

            <p className="mt-2 text-sm text-red-200/70">
              {error}
            </p>
          </section>
        )}


        {!isLoading && !error && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Users
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {employees.filter((employee) => employee.is_active).length}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Simulated identities monitored
                </p>
              </article>


              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Events Processed
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {events.length}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Security activity captured
                </p>
              </article>


              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Events Scored
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {anomalies.length}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Behavioral analyses completed
                </p>
              </article>


              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Highest Risk
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {highestRisk
                    ? highestRisk.anomaly_score.toFixed(2)
                    : "—"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {highestRisk
                    ? highestRisk.risk_level
                    : "No analyzed events"}
                </p>
              </article>

            </section>


            <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">

              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">

                <div>
                  <h2 className="font-semibold">
                    Security Event Intelligence
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Live activity enriched with behavioral anomaly scoring
                  </p>
                </div>

                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                  DETECTION PIPELINE
                </span>

              </div>


              <div className="overflow-x-auto">

                <table className="w-full min-w-[950px] text-left text-sm">

                  <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4">Traffic</th>
                      <th className="px-6 py-4">Score</th>
                      <th className="px-6 py-4">Risk</th>
                      <th className="px-6 py-4">Time</th>
                    </tr>
                  </thead>


                  <tbody>

                    {events.map((event) => {
                      const anomaly = anomalyMap.get(
                        event.event_id,
                      );

                      return (
                        <tr
                          key={event.id}
                          className="border-b border-slate-800/70 transition hover:bg-slate-800/30"
                        >

                          <td className="px-6 py-5 font-mono text-xs text-cyan-300">
                            {event.event_id}
                          </td>


                          <td className="px-6 py-5 font-medium text-slate-200">
                            {event.event_type}
                          </td>


                          <td className="px-6 py-5 font-mono text-xs text-slate-400">
                            {event.source_ip}
                          </td>


                          <td className="px-6 py-5 text-slate-400">
                            {formatBytes(
                              event.bytes_sent
                              + event.bytes_received,
                            )}
                          </td>


                          <td className="px-6 py-5">
                            {anomaly ? (
                              <span className="font-mono text-base font-semibold">
                                {anomaly.anomaly_score.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                —
                              </span>
                            )}
                          </td>


                          <td className="px-6 py-5">

                            {anomaly ? (
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClass(
                                  anomaly.risk_level,
                                )}`}
                              >
                                {anomaly.risk_level}
                              </span>
                            ) : (
                              <span className="rounded-full border border-slate-700 bg-slate-800/40 px-2.5 py-1 text-xs text-slate-500">
                                UNSCORED
                              </span>
                            )}

                          </td>


                          <td className="px-6 py-5 text-xs text-slate-500">
                            {formatTimestamp(event.timestamp)}
                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>

            </section>


            {highestRisk && (
              <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">

                <article className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                    Detection Detail
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    Highest-Risk Event
                  </h2>


                  <div className="mt-6 space-y-4">

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Event
                      </p>

                      <p className="mt-1 font-mono text-cyan-300">
                        {highestRisk.event_id}
                      </p>
                    </div>


                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Employee
                      </p>

                      <p className="mt-1">
                        {highestRisk.employee_user_id}
                      </p>
                    </div>


                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Detector
                      </p>

                      <p className="mt-1">
                        {highestRisk.detector_name}
                        {" "}
                        v{highestRisk.detector_version}
                      </p>
                    </div>


                    <div className="flex items-end justify-between gap-4 border-t border-slate-800 pt-5">

                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          Anomaly Score
                        </p>

                        <p className="mt-1 text-4xl font-semibold">
                          {highestRisk.anomaly_score.toFixed(2)}
                        </p>
                      </div>


                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${riskClass(
                          highestRisk.risk_level,
                        )}`}
                      >
                        {highestRisk.risk_level}
                      </span>

                    </div>

                  </div>

                </article>


                <article className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                    Explainability
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    Detection Reasoning
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Why SENTINEL assigned this risk score.
                  </p>


                  <div className="mt-6 space-y-3">

                    {highestRisk.explanation.reasons?.map(
                      (reason, index) => (
                        <div
                          key={`${reason}-${index}`}
                          className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                        >

                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />

                          <p className="text-sm leading-6 text-slate-300">
                            {reason}
                          </p>

                        </div>
                      ),
                    )}

                  </div>

                </article>

              </section>
            )}


            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/20 p-5">

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                <div>
                  <p className="text-sm font-medium">
                    Data observed
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Total traffic represented by currently loaded events
                  </p>
                </div>

                <p className="text-2xl font-semibold">
                  {formatBytes(totalTransferred)}
                </p>

              </div>

            </section>
          </>
        )}

      </div>
    </main>
  );
}


export default App;