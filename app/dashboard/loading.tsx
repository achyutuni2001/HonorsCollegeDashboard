export default function DashboardLoading() {
  return (
    <main className="dashboard-grid min-h-screen">
      <div className="container space-y-6 py-6">
        <div className="h-14 animate-pulse rounded-2xl border bg-muted/40" />

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="h-[420px] animate-pulse rounded-xl border bg-muted/40" />
            <div className="h-[160px] animate-pulse rounded-xl border bg-muted/40" />
          </div>

          <div className="space-y-6">
            <div className="h-14 animate-pulse rounded-xl border bg-muted/40" />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
              <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
              <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
              <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[320px] animate-pulse rounded-xl border bg-muted/40" />
              <div className="h-[320px] animate-pulse rounded-xl border bg-muted/40" />
            </div>

            <div className="h-[360px] animate-pulse rounded-xl border bg-muted/40" />
          </div>
        </section>
      </div>
    </main>
  );
}
