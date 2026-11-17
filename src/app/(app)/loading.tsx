// Shown instantly while a screen fetches Google, ClickUp and the database (the first load can take several seconds).
export default function Loading() {
  const block = "animate-pulse rounded-2xl bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando…</p>
      <div className={`${block} h-12 w-64`} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-[98px]`} />
        ))}
      </div>
      <div className={`${block} h-72`} />
    </main>
  );
}
