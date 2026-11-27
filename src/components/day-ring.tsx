"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/mva-motion";
import { BentoCard } from "@/components/ui";

const C = 2 * Math.PI * 38; // r=38

export default function DayRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  const [offset, setOffset] = useState(C);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOffset(C * (1 - pct / 100));
    });
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <BentoCard as="div" className="flex items-center gap-4 !py-4 lg:col-span-4 lg:gap-5 lg:!py-[22px]">
      <svg viewBox="0 0 96 96" className="h-[72px] w-[72px] shrink-0 -rotate-90 lg:h-24 lg:w-24" role="img" aria-label={`${pct}% do dia concluído`}>
        <defs>
          <linearGradient id="mva-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--mva-blue)" />
            <stop offset="100%" stopColor="var(--mva-blue-light)" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r="38" fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke="url(#mva-ring-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="min-w-0 space-y-0.5 lg:space-y-1">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-mute">Meta do dia</div>
        <div className="font-display text-2xl font-bold tabular-nums lg:text-3xl">
          <AnimatedNumber value={pct} suffix="%" />
        </div>
        <div className="text-xs text-mute">
          {total === 0 ? "Tudo livre hoje" : `${done} de ${total} concluídos`}
        </div>
      </div>
    </BentoCard>
  );
}
