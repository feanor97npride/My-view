export default function Loading() {
  const block = "animate-pulse rounded-[26px] bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando repositórios do GitHub…</p>
      <div className="flex flex-col gap-2">
        <div className={`${block} h-4 w-56 rounded-lg`} />
        <div className={`${block} h-10 w-48 rounded-xl`} />
      </div>
      <div className={`${block} h-20 w-full`} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${block} h-48`} />
        ))}
      </div>
    </main>
  );
}
