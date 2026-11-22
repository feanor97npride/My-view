"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ReplanItem = { taskId: string; date: string };
type WaitingItem = { threadId: string; to: string; subject: string; dias: number };

export default function DailyAutomations({
  account,
  todayKey,
  shouldRunReplan,
  shouldRunFollowup,
  replan,
  waiting,
}: {
  account: string;
  todayKey: string;
  shouldRunReplan: boolean;
  shouldRunFollowup: boolean;
  replan: ReplanItem[];
  waiting: WaitingItem[];
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldRunReplan && !shouldRunFollowup) return;
    const lockKey = `myview:automations:${account}:${todayKey}:${shouldRunReplan ? "r" : ""}${shouldRunFollowup ? "f" : ""}`;
    try {
      if (sessionStorage.getItem(lockKey) === "1") return;
      sessionStorage.setItem(lockKey, "1");
    } catch {
      // ignore storage errors
    }

    let cancelled = false;
    fetch("/api/automations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        todayKey,
        replan: shouldRunReplan ? replan : [],
        waiting: shouldRunFollowup ? waiting : [],
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { replanned?: number; followups?: number } | null) => {
        if (cancelled || !d) return;
        const parts: string[] = [];
        if (d.replanned && d.replanned > 0) {
          parts.push(`${d.replanned} ${d.replanned === 1 ? "atrasada replanejada" : "atrasadas replanejadas"}`);
        }
        if (d.followups && d.followups > 0) {
          parts.push(`${d.followups} ${d.followups === 1 ? "tarefa de follow-up criada" : "tarefas de follow-up criadas"}`);
        }
        if (parts.length > 0) {
          setSummary(`⚡ Rotina automática: ${parts.join(" · ")}`);
          router.refresh();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [account, todayKey, shouldRunReplan, shouldRunFollowup, replan, waiting, router]);

  if (!summary) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft/60 px-4 py-2.5 text-xs font-medium text-primary-ink"
    >
      <span>{summary}</span>
      <button
        type="button"
        onClick={() => setSummary(null)}
        aria-label="Dispensar aviso de rotina"
        className="cursor-pointer border-0 bg-transparent px-1 text-sm font-bold text-primary-ink/70 hover:text-primary-ink"
      >
        ×
      </button>
    </div>
  );
}
