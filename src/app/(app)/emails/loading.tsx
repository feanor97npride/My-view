export default function Loading() {
  const block = "animate-pulse rounded-[20px] bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:p-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando e-mails…</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`${block} h-10 w-56 rounded-xl`} />
        <div className={`${block} h-10 w-72 rounded-xl`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${block} h-9 w-28 rounded-full`} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${block} h-20 w-full`} />
        ))}
      </div>
    </main>
  );
}
