export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse space-y-4 px-4 py-6 sm:px-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-14 rounded-lg bg-card" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-card" />
        ))}
      </div>
      <div className="h-96 rounded-lg bg-card" />
    </main>
  );
}
