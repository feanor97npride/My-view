export default function Loading() {
  const block = "animate-pulse rounded-[26px] bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando indicadores…</p>
      <div className="flex flex-col gap-2">
        <div className={`${block} h-4 w-32 rounded-lg`} />
        <div className={`${block} h-10 w-52 rounded-xl`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${block} h-72 lg:col-span-7`} />
        <div className={`${block} h-72 lg:col-span-5`} />
      </div>
    </main>
  );
}
