function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Security Intelligence Platform
          </p>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            SENTINEL
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            AI-powered anomaly detection and incident intelligence for a
            simulated corporate environment.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Frontend online
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;