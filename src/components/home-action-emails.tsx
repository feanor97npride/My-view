"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionToast, type ToastAction } from "@/components/ui";
import { speakPtBr, stopSpeaking } from "@/lib/voice";

export type HomeActionEmail = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  url: string;
};

function matchesAutoRead(item: HomeActionEmail, rules: string[]): boolean {
  if (rules.length === 0) return false;
  const hay = `${item.sender} ${item.subject}`.toLowerCase();
  return rules.some((r) => r && hay.includes(r));
}

export default function HomeActionEmails({
  initialItems,
  initialTotal,
  autoReadRules = [],
  todayKey = "",
}: {
  initialItems: HomeActionEmail[];
  initialTotal: number;
  autoReadRules?: string[];
  todayKey?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [queuePending, setQueuePending] = useState<HomeActionEmail[]>([]);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueCancelledRef = useRef(false);

  useEffect(() => {
    setItems(initialItems);
    setTotal(initialTotal);
  }, [initialItems, initialTotal]);

  useEffect(() => () => {
    queueCancelledRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking();
  }, []);

  const playQueue = (list: HomeActionEmail[]) => {
    if (list.length === 0) return;
    queueCancelledRef.current = false;
    let idx = 0;
    const next = () => {
      if (queueCancelledRef.current || idx >= list.length) {
        setSpeakingId(null);
        return;
      }
      const m = list[idx++];
      const script = `E-mail prioritário de ${m.sender}. Assunto: ${m.subject}. ${m.snippet || ""}`;
      speakPtBr(script, {
        onStart: () => {
          if (!queueCancelledRef.current) setSpeakingId(m.id);
        },
        onEnd: () => {
          if (!queueCancelledRef.current) next();
        },
      });
    };
    next();
  };

  useEffect(() => {
    const visible = items.slice(0, 3);
    const matched = visible.filter((m) => matchesAutoRead(m, autoReadRules));
    setQueuePending(matched);
    if (matched.length === 0 || !todayKey) return;

    const storageKey = `myview:autoread:${todayKey}`;
    let seenIds: string[] = [];
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) seenIds = JSON.parse(raw) as string[];
    } catch {
      // ignore
    }
    const unseen = matched.filter((m) => !seenIds.includes(m.id));
    if (unseen.length === 0) return;

    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...seenIds, ...unseen.map((m) => m.id)]));
    } catch {
      // ignore
    }
    playQueue(unseen);
  }, [items, autoReadRules, todayKey]);

  const showToast = (label: string, undo: () => Promise<void>) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ label, undo });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const markRead = async (item: HomeActionEmail) => {
    if (busyId) return;
    setBusyId(item.id);
    const prevItems = items;
    const prevTotal = total;
    setItems((cur) => cur.filter((x) => x.id !== item.id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", ids: [item.id] }),
      });
      if (!res.ok) {
        setItems(prevItems);
        setTotal(prevTotal);
        return;
      }
      showToast("E-mail marcado como lido", async () => {
        setItems(prevItems);
        setTotal(prevTotal);
        await fetch("/api/emails/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markUnread", ids: [item.id] }),
        }).catch(() => {});
        router.refresh();
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const createTask = async (item: HomeActionEmail) => {
    if (busyId || createdTaskIds.has(item.id)) return;
    setBusyId(item.id);
    try {
      const res = await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "task",
          title: item.subject,
          description: `De: ${item.sender}\n${item.url}\n\n${item.snippet}`,
          emailId: item.id,
          threadId: item.threadId,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { taskId?: string };
      if (!res.ok) return;
      setCreatedTaskIds((s) => new Set([...s, item.id]));
      if (j.taskId) {
        const taskId = j.taskId;
        showToast("Tarefa criada no ClickUp", async () => {
          setCreatedTaskIds((s) => {
            const n = new Set(s);
            n.delete(item.id);
            return n;
          });
          await fetch("/api/emails/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "untask", taskId }),
          }).catch(() => {});
          router.refresh();
        });
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const visible = items.slice(0, 3);

  return (
    <>
      {queuePending.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary-soft/50 px-3 py-2 text-xs">
          <span className="font-medium text-primary-ink">
            🔊 {queuePending.length} {queuePending.length === 1 ? "e-mail com leitura automática" : "e-mails com leitura automática"}
          </span>
          <div className="flex items-center gap-1.5">
            {speakingId ? (
              <button
                type="button"
                onClick={() => {
                  queueCancelledRef.current = true;
                  stopSpeaking();
                  setSpeakingId(null);
                }}
                className="btn spring-btn min-h-7 bg-card px-2.5 py-0.5 text-[11px]"
              >
                ⏹ Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => playQueue(queuePending)}
                className="btn btn-primary spring-btn min-h-7 px-2.5 py-0.5 text-[11px]"
              >
                ▶ Ouvir fila
              </button>
            )}
            <Link href="/configuracoes?aba=emails" className="text-[11px] font-semibold text-primary-ink no-underline hover:underline">
              Configurar
            </Link>
          </div>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="text-mute">Nenhum e-mail de ação por ler.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((m) => {
            const isBusy = busyId === m.id;
            const hasTask = createdTaskIds.has(m.id);
            const isAuto = matchesAutoRead(m, autoReadRules);
            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-2xl p-3.5 text-ink transition-all hover:outline hover:outline-2 hover:outline-[var(--primary)]"
                style={{ background: "var(--violet-bg)" }}
              >
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 text-ink no-underline"
                >
                  <span className="truncate text-[13px] text-mute">{m.sender}</span>
                  <span className="break-words font-semibold hover:underline">{m.subject}</span>
                </a>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="chip chip-violet" style={{ background: "var(--card)" }}>Ação necessária</span>
                    {isAuto && <span className="chip chip-primary px-2 py-0.5 text-[10px]">🔊 Auto</span>}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        queueCancelledRef.current = true;
                        if (speakingId === m.id) {
                          stopSpeaking();
                          setSpeakingId(null);
                          return;
                        }
                        const script = `E-mail de ${m.sender}. Assunto: ${m.subject}. ${m.snippet || ""}`;
                        speakPtBr(script, {
                          onStart: () => setSpeakingId(m.id),
                          onEnd: () => setSpeakingId((cur) => (cur === m.id ? null : cur)),
                        });
                      }}
                      aria-label={speakingId === m.id ? "Parar leitura do e-mail" : `Ouvir e-mail: ${m.subject}`}
                      className="btn spring-btn min-h-8 bg-card px-2.5 py-1 text-[11px]"
                    >
                      {speakingId === m.id ? "⏹ Parar" : "🔊 Ouvir"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => markRead(m)}
                      className="btn spring-btn min-h-8 bg-card px-2.5 py-1 text-[11px] disabled:opacity-50"
                    >
                      ✓ Lido
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || hasTask}
                      onClick={() => createTask(m)}
                      className="btn spring-btn min-h-8 bg-card px-2.5 py-1 text-[11px] disabled:opacity-60"
                    >
                      {hasTask ? "Tarefa ✓" : "+ Tarefa"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > 3 && (
        <Link href="/emails?categoria=acao&naolidos=1" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold">
          Ver os outros {total - 3} e-mails de ação
        </Link>
      )}
      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
