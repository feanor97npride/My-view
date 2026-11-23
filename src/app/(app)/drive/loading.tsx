export default function DriveLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-3 py-4 sm:p-4 md:px-8 md:py-8 xl:px-10" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-56 animate-pulse rounded bg-line" />
        <div className="h-9 w-48 animate-pulse rounded-xl bg-line" />
      </div>
      <div className="h-28 animate-pulse rounded-3xl bg-line" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-line" />
        ))}
      </div>
    </main>
  );
}
