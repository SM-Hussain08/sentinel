import { useEffect, useMemo, useState } from "react";

import { getEmployees, getEvents } from "./services/api";
import type { Employee, SecurityEvent } from "./types/api";


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


function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    async function loadSentinelData() {
      try {
        setIsLoading(true);
        setError(null);

        const [employeeData, eventData] = await Promise.all([
          getEmployees(),
          getEvents(),
        ]);

        setEmployees(employeeData);
        setEvents(eventData);
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


  const totalTransferred = useMemo(() => {
    return events.reduce(
      (total, event) =>
        total + event.bytes_sent + event.bytes_received,
      0,
    );
  }, [events]);


  const successfulEvents = useMemo(() => {
    return events.filter((event) => event.success).length;
  }, [events]);


  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">

        {/* Header */}
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
              AI-powered anomaly detection and incident intelligence
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
                System Online
              </p>

              <p className="text-xs text-slate-500">
                API + Database connected
              </p>
            </div>
          </div>

        </header>


        {/* Loading */}
        {isLoading && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-400">
              Loading intelligence...
            </p>
          </section>
        )}


        {/* Error */}
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
            {/* Summary cards */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Users
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {employees.filter((employee) => employee.is_active).length}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Simulated workforce online
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
                  Security activity recorded
                </p>
              </article>


              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Successful Events
                </p>

                <p className="mt-3 text-3xl font-semibold text-emerald-300">
                  {successfulEvents}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Successful operations
                </p>
              </article>


              <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Data Observed
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {formatBytes(totalTransferred)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Combined event traffic
                </p>
              </article>

            </section>


            {/* Main content */}
            <section className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">

              {/* Event stream */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">

                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                  <div>
                    <h2 className="font-semibold">
                      Security Event Stream
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Latest corporate activity captured by SENTINEL
                    </p>
                  </div>

                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                    LIVE DATA
                  </span>
                </div>


                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">

                    <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Event</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Source</th>
                        <th className="px-6 py-4">Resource</th>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>


                    <tbody>
                      {events.map((event) => (
                        <tr
                          key={event.id}
                          className="border-b border-slate-800/70 transition hover:bg-slate-800/30"
                        >
                          <td className="px-6 py-5 font-mono text-xs text-cyan-300">
                            {event.event_id}
                          </td>

                          <td className="px-6 py-5">
                            <span className="font-medium text-slate-200">
                              {event.event_type}
                            </span>
                          </td>

                          <td className="px-6 py-5 font-mono text-xs text-slate-400">
                            {event.source_ip}
                          </td>

                          <td className="px-6 py-5 text-slate-400">
                            {event.resource_name ?? "—"}
                          </td>

                          <td className="px-6 py-5 text-xs text-slate-500">
                            {formatTimestamp(event.timestamp)}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={
                                event.success
                                  ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300"
                                  : "rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
                              }
                            >
                              {event.success ? "SUCCESS" : "FAILED"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>

              </div>


              {/* Employee intelligence */}
              <aside className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">

                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                  Entity Intelligence
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Employee Baseline
                </h2>


                {employees.length > 0 ? (
                  <div className="mt-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">

                      <div className="flex items-start justify-between gap-4">

                        <div>
                          <p className="text-lg font-semibold">
                            {employees[0].name}
                          </p>

                          <p className="mt-1 font-mono text-xs text-cyan-400">
                            {employees[0].user_id}
                          </p>
                        </div>

                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                          ACTIVE
                        </span>

                      </div>


                      <div className="mt-6 space-y-4 text-sm">

                        <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                          <span className="text-slate-500">
                            Department
                          </span>

                          <span>
                            {employees[0].department}
                          </span>
                        </div>


                        <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                          <span className="text-slate-500">
                            Role
                          </span>

                          <span className="text-right">
                            {employees[0].job_role}
                          </span>
                        </div>


                        <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                          <span className="text-slate-500">
                            Typical IP
                          </span>

                          <span className="font-mono text-xs">
                            {employees[0].typical_ip}
                          </span>
                        </div>


                        <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                          <span className="text-slate-500">
                            Work Window
                          </span>

                          <span>
                            {String(employees[0].normal_start_hour).padStart(2, "0")}
                            :00
                            {" — "}
                            {String(employees[0].normal_end_hour).padStart(2, "0")}
                            :00
                          </span>
                        </div>


                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">
                            Typical Location
                          </span>

                          <span className="text-right">
                            {employees[0].typical_location}
                          </span>
                        </div>

                      </div>

                    </div>


                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Baseline Activity
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-4">

                        <div>
                          <p className="text-xl font-semibold">
                            {employees[0].typical_login_frequency}
                          </p>

                          <p className="text-xs text-slate-500">
                            logins / day
                          </p>
                        </div>


                        <div>
                          <p className="text-xl font-semibold">
                            {employees[0].typical_files_accessed}
                          </p>

                          <p className="text-xs text-slate-500">
                            files / day
                          </p>
                        </div>

                      </div>
                    </div>

                  </div>
                ) : (
                  <p className="mt-6 text-sm text-slate-500">
                    No employees have been generated yet.
                  </p>
                )}

              </aside>

            </section>
          </>
        )}

      </div>
    </main>
  );
}


export default App;