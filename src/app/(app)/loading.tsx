// Shown instantly while a screen fetches Google, ClickUp and the database (the first load can take several seconds).
export default function Loading() {
  const block = "animate-pulse rounded-[26px] bg-line motion-reduce:animate-none";
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-8 md:py-8 xl:px-10" aria-busy="true">
      <p role="status" className="sr-only">Carregando…</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${block} h-56 lg:col-span-8`} />
        <div className={`${block} h-28 lg:col-span-4 lg:h-56`} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`${block} h-80 lg:col-span-7`} />
        <div className={`${block} h-80 lg:col-span-5`} />
      </div>
    </main>
  );
}
