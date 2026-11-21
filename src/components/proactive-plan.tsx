"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PlanItem } from "@/components/day-plan";

export default function ProactivePlan({
  account,
  todayKey,
  planItems,
  replan,
}: {
  account: string;
  todayKey: string;
  planItems: PlanItem[];
  replan: { taskId: string; date: string }[];
}) {
  const router = useRouter();
  const dismissKey = `myview:proactive-dismissed:${account}:${todayKey}`;
  const [dismissed, setDismissed] = useState(false);
  const [running, setRunning] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(dismissKey) === "1") setDismissed(true);
    } catch {
      // ignore storage errors
    }
  }, [dismissKey]);

  if (dismissed || (planItems.length === 0 && replan.length === 0)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // ignore
    }
  };

  const acceptPlan = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    let scheduled = 0;
    let postponed = 0;

    try {
      for (const it of planItems) {
        const res = await fetch("/api/emails/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "schedule",
            title: it.title,
            description: [it.url ? `Tarefa: ${it.url}` : "", "Agendado pelo Assistente Pessoal (My View)"]
              .filter(Boolean)
              .join("\n"),
            startIso: it.startIso,
            endIso: it.endIso,
          }),
        });
        if (res.ok) scheduled++;
        else {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? "Não foi possível reservar todos os blocos.");
          break;
        }
      }

      if (replan.length > 0) {
        const res = await fetch("/api/tasks/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "postponeMany", items: replan }),
        });
        if (res.ok) {
          const j = (await res.json().catch(() => ({}))) as { prev?: unknown[] };
          postponed = j.prev?.length ?? replan.length;
        } else {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError((prev) => prev ?? j.error ?? "Não foi possível replanejar as atrasadas.");
        }
      }

      const parts: string[] = [];
      if (scheduled > 0) parts.push(`${scheduled} ${scheduled === 1 ? "bloco reservado" : "blocos reservados"} na agenda`);
      if (postponed > 0) parts.push(`${postponed} ${postponed === 1 ? "tarefa replanejada" : "tarefas replanejadas"}`);
      if (parts.length > 0) {
        setDoneMsg(`Plano aplicado: ${parts.join(" e ")}.`);
        router.refresh();
      }
    } catch {
      setError("Falha de conexão ao aplicar o plano.");
    } finally {
      setRunning(false);
    }
  };

  const parts: string[] = [];
  if (planItems.length > 0) {
    parts.push(`reservar ${planItems.length} ${planItems.length === 1 ? "bloco de foco" : "blocos de foco"} hoje`);
  }
  if (replan.length > 0) {
    parts.push(`replanejar ${replan.length} ${replan.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"} para os próximos dias úteis`);
  }

  return (
    <section
      aria-label="Sugestão proativa do assistente"
      className="spring-card flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-primary/30 bg-primary-soft/60 px-5 py-3.5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="chip chip-primary px-2 py-0.5 text-[10px]">✨ Assistente</span>
          <span className="text-sm font-semibold text-ink">
            {doneMsg ?? `Posso ${parts.join(" e ")}?`}
          </span>
        </div>
        {error && <p className="mt-1 mb-0 text-xs" style={{ color: "var(--red-fg)" }}>{error}</p>}
      </div>

      {!doneMsg ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void acceptPlan()}
            className="btn btn-primary spring-btn min-h-9 px-3.5 py-1.5 text-xs disabled:opacity-60"
          >
            {running ? "Aplicando plano…" : "✓ Aceitar plano"}
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("myview:open-assistant"))}
            className="btn spring-btn min-h-9 px-3 py-1.5 text-xs"
          >
            Ajustar no chat
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar sugestão hoje"
            className="btn spring-btn min-h-9 px-2.5 py-1.5 text-xs text-mute"
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" onClick={dismiss} className="btn spring-btn min-h-8 px-3 py-1 text-xs">
          Fechar
        </button>
      )}
    </section>
  );
}
