export default function Loading() {
  const block = "animate-pulse rounded-[26px] bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando tarefas do ClickUp…</p>
      <div className="flex flex-col gap-2">
        <div className={`${block} h-4 w-56 rounded-lg`} />
        <div className={`${block} h-10 w-44 rounded-xl`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${block} h-20`} />
        ))}
      </div>
      <div className={`${block} h-28 w-full`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
    </main>
  );
}
