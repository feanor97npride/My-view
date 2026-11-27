export function MvaMark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 74 44" className={className} aria-hidden="true">
      <polygon style={{ fill: "var(--logo-m)" }} points="0,0 6,0 6,44 0,44" />
      <polygon style={{ fill: "var(--logo-m)" }} points="0,0 7,0 20.5,26 13.5,26" />
      <polygon style={{ fill: "var(--logo-m)" }} points="13.5,26 20.5,26 34.5,0 27.5,0" />
      <polygon style={{ fill: "var(--logo-v)" }} points="27.5,0 34.5,0 47.5,44 40.5,44" />
      <polygon style={{ fill: "var(--logo-v)" }} points="40.5,44 47.5,44 60.5,0 53.5,0" />
      <polygon style={{ fill: "var(--logo-a)" }} points="53.5,0 60.5,0 73.5,44 66.5,44" />
      <polygon style={{ fill: "var(--logo-a)" }} points="52.2,28 62.8,28 64.5,34 50.5,34" />
    </svg>
  );
}

export function MvaBrand({
  compact = false,
  showSub = true,
  title = "MY-VIEW",
}: {
  compact?: boolean;
  showSub?: boolean;
  title?: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <MvaMark className={compact ? "h-5 w-auto" : "h-6 w-auto"} />
      {!compact && (
        <span className="grid gap-0.5 leading-none">
          <span className="font-display text-lg font-bold tracking-[0.04em] text-ink">{title}</span>
          {showSub && (
            <span
              className="font-display text-[8px] font-semibold uppercase tracking-[0.36em]"
              style={{ color: "var(--logo-sub)" }}
            >
              MVA SOLUTIONS
            </span>
          )}
        </span>
      )}
    </span>
  );
}
