"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionToast } from "@/components/ui";
import { CATEGORIES } from "@/lib/email-rules";
import { CATEGORY_CHIP, CATEGORY_LABEL, decodeEntities, filterEmails } from "@/lib/email-view";
import {
  FILAS,
  agruparInformativos,
  buildQueue,
  extractFinance,
  filaOf,
  maisBarulhento,
  resumir,
  senderInfo,
  tituloResumo,
  type Fila,
  type TriItem,
} from "@/lib/triage";

export type Waiting = { threadId: string; to: string; toAddress: string; subject: string; dias: number; url: string };

const fill = (c: string) => ({ background: `var(--k-${c})`, color: `var(--kt-${c})` });
const label = (c: string) => CATEGORY_LABEL[c] ?? c;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Avatar({ name, cat, size = 40 }: { name: string; cat: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{ width: size, height: size, fontSize: size / 2.6, ...fill(cat) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 text-[11px] font-medium text-mute">{children}</kbd>;
}

const ExtLink = ({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
    {children}
    <span className="sr-only"> (abre no Gmail, em nova aba)</span>
  </a>
);

export default function TriageBoard({
  items: initialItems,
  waiting,
  waitingError,
  dateLine,
  awaitingDays,
  initialFila,
  shortcutsEnabled = true,
  initialSnoozed = {},
  todayKey = "",
  templates = [],
}: {
  items: TriItem[];
  waiting: Waiting[] | null; // null = could not be read
  waitingError: string | null;
  dateLine: string;
  awaitingDays: number;
  initialFila: Fila | null;
  shortcutsEnabled?: boolean;
  initialSnoozed?: Record<string, string>;
  todayKey?: string;
  templates?: { id: string; label: string; body: string }[];
}) {
  const [items, setItems] = useState<TriItem[]>(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);

  const [snoozed, setSnoozed] = useState<Record<string, string>>(initialSnoozed);
  useEffect(() => setSnoozed(initialSnoozed), [initialSnoozed]);

  const [filtro, setFiltro] = useState<Fila | null>(initialFila);
  const [q, setQ] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ label: string; undo: () => void } | null>(null);
  const [sched, setSched] = useState<{ id: string; title: string; start: string; minutes: number } | null>(null);
  const [drafted, setDrafted] = useState<Record<string, boolean>>({});
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiDraftTone, setAiDraftTone] = useState<"direto" | "formal" | "followup">("direto");
  const [aiDraftPreview, setAiDraftPreview] = useState<{ emailId: string; text: string } | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const activeItems = useMemo(
    () => items.filter((i) => !(snoozed[i.id] && (todayKey ? snoozed[i.id] > todayKey : true))),
    [items, snoozed, todayKey],
  );
  const snoozedItems = useMemo(
    () => items.filter((i) => !!(snoozed[i.id] && (todayKey ? snoozed[i.id] > todayKey : true))),
    [items, snoozed, todayKey],
  );
  const visible = useMemo(() => (q.trim() ? filterEmails(activeItems, { q }) : activeItems), [activeItems, q]);
  const resumo = useMemo(() => resumir(activeItems), [activeItems]); // the header always describes the whole window
  const queue = useMemo(() => buildQueue(visible, filtro), [visible, filtro]);
  const focus = queue.find((i) => i.id === focusId) ?? queue[0] ?? null;
  const idx = focus ? queue.indexOf(focus) : -1;
  const aSeguir = queue.filter((i) => i !== focus).slice(0, 3);
  const grupos = useMemo(() => agruparInformativos(visible), [visible]);
  const barulhento = maisBarulhento(grupos);
  const outros = grupos.filter((g) => g !== barulhento);
  const informativos = visible.filter((i) => filaOf(i.category) === "informativo" && i.inInbox !== false);
  const unreadInformativos = informativos.filter((i) => i.unread);

  const count = (f: Fila) => (f === "aguardando" ? (waiting ? waiting.length : null) : (resumo.porCategoria[f] ?? 0));
  const title = tituloResumo(resumo);
  const done = resumo.importantesTotal ? resumo.importantesTriados / resumo.importantesTotal : 1;
  const unreadIn = (c: string) => visible.filter((i) => filaOf(i.category) === c && i.unread && i.inInbox !== false && !i.triado);

  const showToast = (msg: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ label: msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const postAction = async <T extends Record<string, unknown> = Record<string, unknown>>(
    body: unknown,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
    try {
      const res = await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (res.ok) return { ok: true, data: j };
      return { ok: false, error: j.error ?? `Erro ${res.status}` };
    } catch {
      return { ok: false, error: "Falha de conexão ao executar a ação." };
    }
  };

  const advanceWithMotion = (commit: () => void) => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) commit();
    else {
      setLeaving(true);
      setTimeout(commit, 150);
    }
  };

  const archiveFocus = (item: TriItem) => {
    setActionError(null);
    setSched(null);
    const nextItem = queue.find((i) => i.id !== item.id) ?? null;
    advanceWithMotion(() => {
      setLeaving(false);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, inInbox: false } : x)));
      setFocusId(nextItem?.id ?? null);
      const undo = () => {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, inInbox: true } : x)));
        setFocusId(item.id);
        void postAction({ action: "unarchive", id: item.id }).then((r) => {
          if (!r.ok) setActionError(r.error);
        });
      };
      showToast("Arquivado", undo);
      void postAction({ action: "archive", id: item.id }).then((r) => {
        if (!r.ok) {
          setToast(null);
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, inInbox: true } : x)));
          setFocusId(item.id);
          setActionError(r.error);
        }
      });
    });
  };

  const taskFocus = (item: TriItem) => {
    if (item.clickupTaskId) return;
    setActionError(null);
    setSched(null);
    const isFocused = item.id === focus?.id;
    const nextItem = isFocused ? (queue.find((i) => i.id !== item.id) ?? null) : null;
    const run = () => {
      setLeaving(false);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: true, clickupTaskId: "pending" } : x)));
      if (isFocused) setFocusId(nextItem?.id ?? null);
      const description = `${decodeEntities(item.snippet)}\n\nDe: ${item.sender}\nConversa: ${item.url}`.trim();
      void postAction<{ taskId?: string }>({ action: "task", title: item.subject, description, emailId: item.id, threadId: item.threadId }).then((r) => {
        if (!r.ok) {
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: false, clickupTaskId: undefined } : x)));
          if (isFocused) setFocusId(item.id);
          setActionError(r.error);
          return;
        }
        const taskId = r.data.taskId;
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, clickupTaskId: taskId } : x)));
        showToast("Tarefa criada no ClickUp", () => {
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: false, clickupTaskId: undefined } : x)));
          if (isFocused) setFocusId(item.id);
          if (taskId) {
            void postAction({ action: "untask", taskId }).then((u) => {
              if (!u.ok) setActionError(u.error);
            });
          }
        });
      });
    };
    if (isFocused) advanceWithMotion(run);
    else run();
  };

  const openSchedule = (item: TriItem) => {
    setActionError(null);
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    setSched({ id: item.id, title: item.subject, start: local, minutes: 30 });
  };

  const confirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sched) return;
    const item = items.find((x) => x.id === sched.id);
    if (!item) return;
    const startDate = new Date(sched.start);
    if (Number.isNaN(startDate.getTime())) {
      setActionError("Informe uma data e hora válidas.");
      return;
    }
    const endDate = new Date(startDate.getTime() + sched.minutes * 60_000);
    const payload = {
      action: "schedule",
      title: sched.title.trim() || item.subject,
      description: `${decodeEntities(item.snippet)}\n\nDe: ${item.sender}\nConversa: ${item.url}`.trim(),
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
    };
    setSched(null);
    setActionError(null);
    const nextItem = queue.find((i) => i.id !== item.id) ?? null;
    advanceWithMotion(() => {
      setLeaving(false);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: true, calendarEventId: "pending" } : x)));
      setFocusId(nextItem?.id ?? null);
      void postAction<{ eventId?: string }>(payload).then((r) => {
        if (!r.ok) {
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: false, calendarEventId: undefined } : x)));
          setFocusId(item.id);
          setActionError(r.error);
          return;
        }
        const eventId = r.data.eventId;
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, calendarEventId: eventId } : x)));
        showToast("Adicionado à agenda", () => {
          setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, triado: false, calendarEventId: undefined } : x)));
          setFocusId(item.id);
          if (eventId) {
            void postAction({ action: "unschedule", eventId }).then((u) => {
              if (!u.ok) setActionError(u.error);
            });
          }
        });
      });
    });
  };

  const toggleReadFocus = (item: TriItem) => {
    setActionError(null);
    const nextUnread = !item.unread;
    const nextItem = !nextUnread ? (queue.find((i) => i.id !== item.id) ?? null) : null;
    const apply = (unreadVal: boolean, focusTarget: string | null) => {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, unread: unreadVal } : x)));
      if (focusTarget !== undefined) setFocusId(focusTarget);
    };
    const commit = () => {
      setLeaving(false);
      apply(nextUnread, !nextUnread ? (nextItem?.id ?? null) : item.id);
      const undo = () => {
        apply(item.unread, item.id);
        void postAction({ action: item.unread ? "markUnread" : "markRead", ids: [item.id] }).then((u) => {
          if (!u.ok) setActionError(u.error);
        });
      };
      showToast(nextUnread ? "Marcado como não lido" : "Marcado como lido", undo);
      void postAction({ action: nextUnread ? "markUnread" : "markRead", ids: [item.id] }).then((r) => {
        if (!r.ok) {
          setToast(null);
          apply(item.unread, item.id);
          setActionError(r.error);
        }
      });
    };
    if (!nextUnread) advanceWithMotion(commit);
    else commit();
  };

  const markInformativosRead = () => {
    const ids = unreadInformativos.map((i) => i.id);
    if (ids.length === 0) return;
    setActionError(null);
    const idSet = new Set(ids);
    setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, unread: false } : x)));
    const undo = () => {
      setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, unread: true } : x)));
      void postAction({ action: "markUnread", ids }).then((r) => {
        if (!r.ok) setActionError(r.error);
      });
    };
    showToast(`${plural(ids.length, "informativo marcado", "informativos marcados")} como lidos`, undo);
    void postAction({ action: "markRead", ids }).then((r) => {
      if (!r.ok) {
        setToast(null);
        setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, unread: true } : x)));
        setActionError(r.error);
      }
    });
  };

  const followupWaiting = (w: Waiting) => {
    if (drafted[w.threadId]) return;
    setActionError(null);
    setDrafted((prev) => ({ ...prev, [w.threadId]: true }));
    void postAction<{ draftId?: string }>({
      action: "followup",
      threadId: w.threadId,
      to: w.toAddress,
      subject: w.subject,
    }).then((r) => {
      if (!r.ok) {
        setDrafted((prev) => ({ ...prev, [w.threadId]: false }));
        setActionError(r.error);
        return;
      }
      const draftId = r.data.draftId;
      showToast(`Rascunho de cobrança criado para ${w.to}`, () => {
        setDrafted((prev) => ({ ...prev, [w.threadId]: false }));
        if (draftId) {
          void postAction({ action: "unfollowup", draftId }).then((u) => {
            if (!u.ok) setActionError(u.error);
          });
        }
      });
    });
  };

  const aiDraftFocus = (item: TriItem, tone: "direto" | "formal" | "followup") => {
    if (aiDrafting) return;
    setActionError(null);
    setAiDrafting(true);
    const to = senderInfo(item.sender).email || item.sender;
    void postAction<{ draftId?: string; text?: string }>({
      action: "aiDraft",
      threadId: item.threadId,
      to,
      subject: item.subject,
      snippet: decodeEntities(item.snippet),
      tone,
    }).then((r) => {
      setAiDrafting(false);
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      if (r.data.text) setAiDraftPreview({ emailId: item.id, text: r.data.text });
      const draftId = r.data.draftId;
      showToast("Rascunho IA salvo no Gmail", () => {
        setAiDraftPreview((cur) => (cur?.emailId === item.id ? null : cur));
        if (draftId) {
          void postAction({ action: "unfollowup", draftId }).then((u) => {
            if (!u.ok) setActionError(u.error);
          });
        }
      });
    });
  };

  const templateDraftFocus = (item: TriItem, tpl: { id: string; label: string; body: string }) => {
    if (aiDrafting) return;
    setActionError(null);
    setAiDrafting(true);
    const to = senderInfo(item.sender).email || item.sender;
    void postAction<{ draftId?: string }>({
      action: "templateDraft",
      threadId: item.threadId,
      to,
      subject: item.subject,
      body: tpl.body,
    }).then((r) => {
      setAiDrafting(false);
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      setAiDraftPreview({ emailId: item.id, text: tpl.body });
      const draftId = r.data.draftId;
      showToast(`Template "${tpl.label}" salvo no Gmail`, () => {
        setAiDraftPreview((cur) => (cur?.emailId === item.id ? null : cur));
        if (draftId) {
          void postAction({ action: "unfollowup", draftId }).then((u) => {
            if (!u.ok) setActionError(u.error);
          });
        }
      });
    });
  };

  const snoozeFocus = (item: TriItem, kind: "tomorrow" | "monday") => {
    setActionError(null);
    setSched(null);
    const nextItem = queue.find((i) => i.id !== item.id) ?? null;
    const prevUntil = snoozed[item.id];
    const optimisticUntil = "9999-12-31";
    advanceWithMotion(() => {
      setLeaving(false);
      setSnoozed((prev) => ({ ...prev, [item.id]: optimisticUntil }));
      setFocusId(nextItem?.id ?? null);
      const undo = () => {
        setSnoozed((prev) => {
          const n = { ...prev };
          if (prevUntil) n[item.id] = prevUntil;
          else delete n[item.id];
          return n;
        });
        setFocusId(item.id);
        void postAction({ action: "unsnooze", emailId: item.id }).catch(() => {});
      };
      showToast(kind === "monday" ? "Adiado até segunda-feira" : "Adiado para amanhã", undo);
      void postAction<{ until?: string }>({ action: "snooze", emailId: item.id, kind }).then((r) => {
        if (!r.ok) {
          setToast(null);
          undo();
          setActionError(r.error);
          return;
        }
        if (r.data.until) {
          setSnoozed((prev) => ({ ...prev, [item.id]: r.data.until! }));
        }
      });
    });
  };

  const unsnoozeItem = (id: string) => {
    setSnoozed((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    void postAction({ action: "unsnooze", emailId: id }).catch(() => {});
  };

  const summarizeInformativos = () => {
    if (informativos.length === 0 || summarizing) return;
    setActionError(null);
    setSummarizing(true);
    void postAction<{ summary?: string }>({
      action: "summarize",
      items: informativos.slice(0, 30).map((i) => ({
        sender: senderInfo(i.sender).nome,
        subject: i.subject,
        snippet: decodeEntities(i.snippet),
      })),
    }).then((r) => {
      setSummarizing(false);
      if (!r.ok) {
        setActionError(r.error);
        return;
      }
      setAiSummary(r.data.summary ?? null);
    });
  };

  const recategorizeFocus = (item: TriItem, category: string) => {
    if (!category || category === item.category) return;
    const senderEmail = senderInfo(item.sender).email;
    const prevCat = item.category;
    const affectedIds = new Set(
      items.filter((x) => (senderEmail ? senderInfo(x.sender).email === senderEmail : x.id === item.id)).map((x) => x.id),
    );
    const prevCats = new Map(items.filter((x) => affectedIds.has(x.id)).map((x) => [x.id, x.category]));
    setActionError(null);
    setItems((prev) => prev.map((x) => (affectedIds.has(x.id) ? { ...x, category } : x)));
    void postAction<{ prevRule?: string | null }>({
      action: "recategorize",
      emailId: item.id,
      senderEmail,
      category,
    }).then((r) => {
      if (!r.ok) {
        setItems((prev) => prev.map((x) => (prevCats.has(x.id) ? { ...x, category: prevCats.get(x.id)! } : x)));
        setActionError(r.error);
        return;
      }
      const hadRule = r.data.prevRule ?? null;
      showToast(`Categoria: ${label(category)} (regra salva)`, () => {
        setItems((prev) => prev.map((x) => (prevCats.has(x.id) ? { ...x, category: prevCats.get(x.id)! } : x)));
        setFocusId(item.id);
        void postAction({
          action: "unrecategorize",
          emailId: item.id,
          senderEmail,
          previousCategory: prevCat,
          hadRule,
        }).then((u) => {
          if (!u.ok) setActionError(u.error);
        });
      });
    });
  };

  const muteSender = (email: string, nome: string) => {
    if (!email.includes("@")) return;
    const ids = items
      .filter((i) => filaOf(i.category) === "informativo" && i.inInbox !== false && senderInfo(i.sender).email === email)
      .map((i) => i.id);
    const idSet = new Set(ids);
    setActionError(null);
    setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, inInbox: false } : x)));
    void postAction<{ filterId?: string }>({ action: "mute", email, ids }).then((r) => {
      if (!r.ok) {
        setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, inInbox: true } : x)));
        setActionError(r.error);
        return;
      }
      const filterId = r.data.filterId;
      showToast(`${nome} silenciado no Gmail`, () => {
        setItems((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, inInbox: true } : x)));
        if (filterId) {
          void postAction({ action: "unmute", filterId, ids }).then((u) => {
            if (!u.ok) setActionError(u.error);
          });
        }
      });
    });
  };

  const go = (delta: number) => {
    if (queue.length === 0) return;
    setSched(null);
    setFocusId(queue[(Math.max(idx, 0) + delta + queue.length) % queue.length].id);
  };

  // Listens on the screen container, not on window, and ignores typing in fields.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" && sched) {
      setSched(null);
      return;
    }
    if (t.matches("input, textarea, select, [contenteditable]")) {
      if (e.key === "Escape") (t as HTMLElement).blur();
      return;
    }
    if (!shortcutsEnabled) return;
    const k = e.key.toLowerCase();
    if (k === "j" || k === "arrowright") go(1);
    else if (k === "k" || k === "arrowleft") go(-1);
    else if (k === "a" && focus) archiveFocus(focus);
    else if (k === "g" && focus) {
      e.preventDefault();
      openSchedule(focus);
    } else if (k === "t" && focus) taskFocus(focus);
    else if (k === "u" && toast) {
      const undo = toast.undo;
      setToast(null);
      undo();
    } else if (k === "/") {
      e.preventDefault();
      search.current?.focus();
    } else if (k === "?") setHelp((h) => !h);
    else if (k === "r" && focus) window.open(focus.url, "_blank", "noopener,noreferrer");
    else if (/^[1-7]$/.test(k)) setFiltro((f) => (f === FILAS[Number(k) - 1] ? null : FILAS[Number(k) - 1]));
    else return;
    if (k !== "r") e.stopPropagation();
  };

  // Announces which e-mail is in focus for screen readers.
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    setAnnounce(focus ? `Agora: ${senderInfo(focus.sender).nome}, ${focus.subject}` : "");
  }, [focus]);

  const card = "rounded-[28px] border border-line p-6";
  const neutral = { background: "var(--card)" };

  return (
    <div ref={root} onKeyDown={onKeyDown} className="mx-auto flex w-full max-w-[1600px] flex-col gap-[26px] p-4 md:px-8 md:pb-14 md:pt-8 xl:px-10">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {/* 1 · Cabeçalho */}
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 flex-1 basis-[320px]">
          <p className="text-sm capitalize text-mute">{dateLine}</p>
          <h1 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight md:text-[44px]">
            {title.total} <span style={{ color: "var(--k-acao)" }}>{title.destaque}</span>
          </h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-5 md:w-auto">
          <label className="min-w-0 flex-1 md:w-64 md:flex-none">
            <span className="sr-only">Buscar por remetente ou assunto</span>
            <input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar remetente ou assunto ( / )"
              className="min-h-11 w-full rounded-2xl border border-line-strong bg-card px-4 text-base text-ink"
            />
          </label>
          <div className="flex items-center gap-3">
            <div
              role="img"
              aria-label={`${resumo.importantesTriados} de ${resumo.importantesTotal} importantes triados`}
              className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--k-acao) ${done * 360}deg, var(--line) 0)` }}
            >
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-bg font-display text-sm font-bold tabular-nums">
                {resumo.importantesTriados}/{resumo.importantesTotal}
              </span>
            </div>
            <div className="text-sm leading-tight">
              <div className="font-semibold">Importantes</div>
              <div className="text-mute">{plural(resumo.importantes, "restante", "restantes")}</div>
            </div>
          </div>
        </div>
      </header>

      {actionError && (
        <div role="alert" className="chip-red flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="btn min-h-9 px-3 py-1 text-xs">Fechar</button>
        </div>
      )}

      {/* 2 · Faixa de filas */}
      <nav aria-label="Filas por categoria" className="flex gap-2.5 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible xl:grid-cols-7">
        {FILAS.map((f, n) => {
          const c = count(f);
          const isFocus = !!focus && filaOf(focus.category) === f;
          const active = filtro === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFiltro(active ? null : f)}
              className={`flex min-h-[88px] min-w-[112px] flex-col items-start justify-between rounded-[20px] px-4 py-3 text-left md:min-w-0 ${f === "aguardando" ? "border-2 border-dashed border-line-strong" : "border-2 border-transparent"} ${c === 0 ? "opacity-60" : ""}`}
              style={{
                ...fill(f),
                ...(isFocus || active ? { borderColor: "var(--ink)", borderStyle: "solid", borderWidth: 3 } : {}),
              }}
            >
              <span className="font-display text-3xl font-bold leading-none tabular-nums">{c ?? "–"}</span>
              <span className="text-[13px] font-semibold">
                {label(f)} <span className="font-medium opacity-70">· {n + 1}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* 3 · Cartão em foco + Financeiro / Trabalho */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section aria-label="E-mail em foco" className="relative min-w-0 lg:col-span-2">
          {queue.length > 1 && (
            <>
              <div aria-hidden="true" className="absolute inset-x-2 -bottom-2 top-2 rounded-[28px]" style={{ background: "var(--surface-3)" }} />
              <div aria-hidden="true" className="absolute inset-x-4 -bottom-4 top-4 rounded-[28px] border border-line" style={{ background: "var(--line)" }} />
            </>
          )}
          <div className={`${card} relative flex flex-col gap-5 transition duration-150 ${leaving ? "-translate-x-2 opacity-0" : ""}`} style={neutral}>
            {focus ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-mute">Em foco</span>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={fill(filaOf(focus.category))}>{label(filaOf(focus.category))}</span>
                    {filaOf(focus.category) !== focus.category && (
                      <span className={`chip ${CATEGORY_CHIP[focus.category] ?? "chip-slate"}`}>{label(focus.category)}</span>
                    )}
                    <select
                      aria-label="Mudar categoria"
                      value={focus.category}
                      onChange={(e) => recategorizeFocus(focus, e.target.value)}
                      className="min-h-8 rounded-full border border-line-strong bg-card px-2.5 text-xs font-medium text-mute hover:text-ink"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{label(c)}</option>
                      ))}
                    </select>
                  </span>
                  <div className="flex items-center gap-2 text-xs text-mute">
                    <span>
                      {focus.when}
                      {focus.unread ? " · não lido" : ""}
                      {queue.length > 1 && ` · ${idx + 1} de ${queue.length}`}
                    </span>
                    {queue.length > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSched(null);
                            setActionError(null);
                            setFocusId(queue[(idx - 1 + queue.length) % queue.length].id);
                          }}
                          title="E-mail anterior (K)"
                          aria-label="E-mail anterior"
                          className="btn spring-btn flex h-8 w-8 items-center justify-center p-0 text-base leading-none"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSched(null);
                            setActionError(null);
                            setFocusId(queue[(idx + 1) % queue.length].id);
                          }}
                          title="Próximo e-mail (J)"
                          aria-label="Próximo e-mail"
                          className="btn spring-btn flex h-8 w-8 items-center justify-center p-0 text-base leading-none"
                        >
                          ›
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={senderInfo(focus.sender).nome} cat={filaOf(focus.category)} size={48} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{senderInfo(focus.sender).nome}</div>
                    <div className="truncate text-sm text-mute">{senderInfo(focus.sender).dominio || senderInfo(focus.sender).email}</div>
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold leading-tight md:text-[30px]">{focus.subject}</h2>
                <div className="rounded-2xl p-4 text-[15px] text-ink" style={{ background: "var(--surface-3)" }}>
                  {focus.category === "financeiro" && (() => {
                    const fin = extractFinance(`${focus.subject} ${decodeEntities(focus.snippet)}`);
                    return (fin.valor || fin.vencimento) ? (
                      <p className="mb-2 flex flex-wrap gap-3 text-sm font-bold">
                        {fin.valor && <span>{fin.valor}</span>}
                        {fin.vencimento && <span className="text-mute">Vence: {fin.vencimento}</span>}
                      </p>
                    ) : null;
                  })()}
                  <p className="m-0">{decodeEntities(focus.snippet) || "Sem prévia disponível."}</p>
                  {focus.attachments && focus.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <span className="text-xs font-semibold text-mute">
                        📎 {focus.attachments.length} {focus.attachments.length === 1 ? "anexo" : "anexos"}:
                      </span>
                      {focus.attachments.map((att) => {
                        const kb = att.size >= 1024 * 1024 ? `${(att.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(att.size / 1024))} KB`;
                        const href = `/api/emails/attachment?messageId=${encodeURIComponent(focus.id)}&attachmentId=${encodeURIComponent(att.id)}&name=${encodeURIComponent(att.filename)}&mime=${encodeURIComponent(att.mimeType)}`;
                        return (
                          <a
                            key={att.id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spring-btn inline-flex max-w-full items-center gap-1.5 rounded-xl border border-line-strong bg-card px-2.5 py-1 text-xs font-medium text-ink no-underline hover:border-primary hover:bg-primary-soft"
                          >
                            <span className="truncate max-w-[200px]">{att.filename}</span>
                            {att.size > 0 && <span className="shrink-0 text-[11px] tabular-nums text-mute">· {kb}</span>}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => archiveFocus(focus)}
                    className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border border-line-strong bg-transparent text-center font-semibold text-ink hover:bg-primary-soft"
                  >
                    <span>Arquivar</span>
                    <span className="text-[11px] font-medium opacity-70">A</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSchedule(focus)}
                    style={{ background: "var(--k-agendamento)", color: "var(--kt-agendamento)" }}
                    className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border-0 text-center font-semibold hover:brightness-110"
                  >
                    <span>{focus.calendarEventId ? "Já agendado" : "Pôr na agenda"}</span>
                    <span className="text-[11px] font-medium opacity-70">G</span>
                  </button>
                  <button
                    type="button"
                    disabled={!!focus.clickupTaskId}
                    onClick={() => taskFocus(focus)}
                    style={{ background: "var(--k-trabalho)", color: "var(--kt-trabalho)" }}
                    className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border-0 text-center font-semibold hover:brightness-110 disabled:opacity-60"
                  >
                    <span>{focus.clickupTaskId ? "Já virou tarefa" : "Virar tarefa"}</span>
                    <span className="text-[11px] font-medium opacity-70">T</span>
                  </button>
                  <ExtLink
                    href={focus.url}
                    style={{ background: "var(--k-acao)", color: "var(--kt-acao)" }}
                    className="flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-[18px] text-center font-semibold no-underline hover:brightness-110"
                  >
                    <span>Responder</span>
                    <span className="text-[11px] font-medium opacity-70">R</span>
                  </ExtLink>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-bg px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      aria-label="Tom do rascunho"
                      value={aiDraftTone}
                      onChange={(e) => setAiDraftTone(e.target.value as "direto" | "formal" | "followup")}
                      className="min-h-8 rounded-lg border border-line-strong bg-card px-2 text-xs text-ink"
                    >
                      <option value="direto">Tom: Direto</option>
                      <option value="formal">Tom: Formal</option>
                      <option value="followup">Tom: Follow-up</option>
                    </select>
                    <button
                      type="button"
                      disabled={aiDrafting}
                      onClick={() => aiDraftFocus(focus, aiDraftTone)}
                      className="btn btn-primary spring-btn min-h-8 px-3 py-1 text-xs disabled:opacity-60"
                    >
                      {aiDrafting ? "Gerando rascunho…" : "✨ Rascunho IA"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleReadFocus(focus)}
                      className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
                    >
                      {focus.unread ? "✓ Marcar lido" : "Marcar não lido"}
                    </button>
                    <span className="text-[11px] text-mute">Soneca:</span>
                    <button
                      type="button"
                      onClick={() => snoozeFocus(focus, "tomorrow")}
                      className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
                    >
                      💤 Amanhã
                    </button>
                    <button
                      type="button"
                      onClick={() => snoozeFocus(focus, "monday")}
                      className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
                    >
                      Segunda
                    </button>
                  </div>
                </div>
                {templates.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-mute">Templates:</span>
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={aiDrafting}
                        onClick={() => templateDraftFocus(focus, tpl)}
                        className="btn spring-btn min-h-7 px-2.5 py-0.5 text-[11px] disabled:opacity-60"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
                {aiDraftPreview?.emailId === focus.id && (
                  <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 p-3.5 text-sm">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary-ink">Rascunho salvo no Gmail</span>
                      <ExtLink href={focus.url} className="text-xs font-semibold">Abrir rascunho ↗</ExtLink>
                    </div>
                    <p className="m-0 whitespace-pre-wrap text-xs text-ink">{aiDraftPreview.text}</p>
                  </div>
                )}
                {focus.clickupTaskId && focus.clickupTaskId !== "pending" && (
                  <p className="m-0 text-sm">
                    <ExtLink href={`https://app.clickup.com/t/${focus.clickupTaskId}`} className="font-semibold">Tarefa criada no ClickUp ↗</ExtLink>
                  </p>
                )}
                {sched?.id === focus.id && (
                  <form onSubmit={confirmSchedule} className="flex flex-col gap-3 rounded-2xl border border-line-strong p-4" style={{ background: "var(--surface-3)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Novo evento no Google Agenda</span>
                      <button type="button" onClick={() => setSched(null)} className="btn min-h-8 px-2.5 py-1 text-xs">Cancelar</button>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-mute">
                      Título
                      <input
                        type="text"
                        required
                        value={sched.title}
                        onChange={(e) => setSched({ ...sched, title: e.target.value })}
                        className="min-h-10 rounded-xl border border-line-strong bg-card px-3 text-sm text-ink"
                      />
                    </label>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-mute">
                        Início
                        <input
                          type="datetime-local"
                          required
                          value={sched.start}
                          onChange={(e) => setSched({ ...sched, start: e.target.value })}
                          className="min-h-10 rounded-xl border border-line-strong bg-card px-3 text-sm text-ink"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-mute">
                        Duração
                        <select
                          value={sched.minutes}
                          onChange={(e) => setSched({ ...sched, minutes: Number(e.target.value) })}
                          className="min-h-10 rounded-xl border border-line-strong bg-card px-3 text-sm text-ink"
                        >
                          <option value={30}>30 min</option>
                          <option value={60}>1 hora</option>
                          <option value={90}>1h30</option>
                        </select>
                      </label>
                      <button type="submit" className="btn btn-primary min-h-10">Criar evento</button>
                    </div>
                  </form>
                )}
                <p className="m-0 text-xs text-mute">Arquivar, Pôr na agenda e Virar tarefa já atuam direto (com Desfazer). Responder abre a conversa no Gmail.</p>
              </>
            ) : q.trim() ? (
              <div className="flex flex-col items-start gap-3">
                <h2 className="font-display text-2xl font-bold">Nada encontrado</h2>
                <p className="m-0 text-mute">Nenhum e-mail com “{q}”.</p>
                <button type="button" className="btn" onClick={() => setQ("")}>Limpar busca</button>
              </div>
            ) : filtro ? (
              <div className="flex flex-col items-start gap-3">
                <h2 className="font-display text-2xl font-bold">{filtro === "aguardando" ? "Aguardando resposta" : `Nada em ${label(filtro)}`}</h2>
                <p className="m-0 text-mute">
                  {filtro === "aguardando" ? "Essas conversas aparecem no bloco abaixo, sem cartão em foco." : "Nenhum e-mail nesta fila."}
                </p>
                <button type="button" className="btn" onClick={() => setFiltro(null)}>Limpar filtro</button>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <h2 className="font-display text-3xl font-bold">Tudo em dia</h2>
                <p className="m-0 text-mute">Você leu todos os e-mails que pedem atenção. {plural(items.filter((i) => !i.unread).length, "e-mail lido", "e-mails lidos")} na janela.</p>
                <a href="#leitura-leve" className="btn">Ir para a Leitura leve</a>
              </div>
            )}
            {snoozedItems.length > 0 && (
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-mute hover:text-ink">
                  💤 Adiados ({snoozedItems.length})
                </summary>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                  {snoozedItems.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {it.subject} <span className="text-mute">· até {snoozed[it.id]?.split("-").reverse().slice(0, 2).join("/")}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => unsnoozeItem(it.id)}
                        className="btn spring-btn min-h-7 shrink-0 px-2.5 py-0.5 text-[11px]"
                      >
                        Acordar
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Financeiro" className={`${card} flex flex-1 flex-col gap-2 border-0`} style={fill("financeiro")}>
            <span className="text-[13px] font-bold uppercase tracking-[0.06em]">Financeiro · {resumo.porCategoria.financeiro ?? 0}</span>
            {(() => {
              const f = visible
                .filter((i) => i.category === "financeiro" && i.inInbox !== false)
                .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
              if (!f.length) return <span className="text-sm">Nenhuma cobrança por aqui.</span>;
              const fin = extractFinance(`${f[0].subject} ${decodeEntities(f[0].snippet)}`);
              return (
                <>
                  <span className={`font-display font-bold leading-tight ${fin.valor ? "text-3xl tabular-nums" : "text-xl"}`}>
                    {fin.valor ?? f[0].subject}
                  </span>
                  <span className="text-sm">
                    {senderInfo(f[0].sender).nome} · {fin.vencimento ? `vence ${fin.vencimento}` : f[0].when}
                    {f.length > 1 ? ` · +${f.length - 1}` : ""}
                  </span>
                  <button type="button" onClick={() => setFiltro("financeiro")} className="mt-auto min-h-11 rounded-2xl px-4 text-sm font-bold" style={{ background: "var(--kt-financeiro)", color: "var(--k-financeiro)" }}>
                    Ver financeiro
                  </button>
                </>
              );
            })()}
          </section>

          <section aria-label="Trabalho" className={`${card} flex flex-col gap-2 border-0`} style={fill("trabalho")}>
            <span className="text-[13px] font-bold uppercase tracking-[0.06em]">Trabalho</span>
            <span className="font-display text-4xl font-bold leading-none tabular-nums">{resumo.porCategoria.trabalho ?? 0}</span>
            <span className="text-sm">{plural(new Set(visible.filter((i) => i.category === "trabalho").map((i) => senderInfo(i.sender).email)).size, "remetente", "remetentes")}</span>
            <button type="button" onClick={() => setFiltro("trabalho")} className="mt-1 min-h-11 rounded-2xl px-4 text-sm font-bold" style={{ background: "var(--kt-trabalho)", color: "var(--k-trabalho)" }}>
              Abrir mesa de trabalho
            </button>
          </section>
        </div>
      </div>

      {/* 4 · A seguir + Aguardando / Pessoal */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section aria-label="A seguir" className={`${card} min-w-0 lg:col-span-2`} style={neutral}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-bold tabular-nums" style={{ color: "var(--k-acao)" }}>{aSeguir.length}</span>
              <div>
                <h2 className="font-display text-xl font-bold">A seguir: precisa de você</h2>
                <p className="m-0 text-sm text-mute">{filtro ? `Fila: ${label(filtro)}` : "Os próximos não lidos por prioridade"}</p>
              </div>
            </div>
            <button type="button" onClick={() => go(1)} disabled={queue.length < 2} className="btn min-h-11 disabled:opacity-50">Próximo →</button>
          </div>
          {aSeguir.length === 0 && <p className="m-0 text-mute">Nada na fila.</p>}
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {aSeguir.map((m) => (
              <li key={m.id} className="flex items-stretch gap-3 rounded-2xl p-3" style={{ background: "var(--surface-3)" }}>
                <span aria-hidden="true" className="w-1.5 shrink-0 rounded-full" style={{ background: `var(--k-${filaOf(m.category)})` }} />
                <button type="button" onClick={() => setFocusId(m.id)} className="min-w-0 flex-1 bg-transparent p-0 text-left text-ink">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{senderInfo(m.sender).nome}</span>
                    <span className="shrink-0 text-xs tabular-nums text-mute">
                      {(m.attachments?.length ?? 0) > 0 && (
                        <span className="mr-1.5" title={`${m.attachments!.length} ${m.attachments!.length === 1 ? "anexo" : "anexos"}`}>
                          📎
                        </span>
                      )}
                      {m.when}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-mute">{m.subject}</span>
                  <span className="sr-only">Colocar em foco</span>
                </button>
                <button
                  type="button"
                  disabled={!!m.clickupTaskId}
                  onClick={() => taskFocus(m)}
                  className="btn hidden min-h-9 self-center px-3 py-1.5 text-[13px] disabled:opacity-50 sm:inline-flex"
                >
                  → ClickUp
                </button>
                <ExtLink href={m.url} className="btn hidden min-h-9 self-center px-3 py-1.5 text-[13px] no-underline sm:inline-flex">Responder</ExtLink>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label="Aguardando resposta" className={`${card} flex flex-col gap-2 border-2 border-dashed border-line-strong`} style={neutral}>
            <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-mute">Aguardando resposta · {waiting ? waiting.length : "–"}</span>
            {waitingError && <p className="m-0 text-sm text-mute">Não foi possível ler os enviados: {waitingError}</p>}
            {waiting && waiting.length === 0 && <p className="m-0 text-sm text-mute">Ninguém te devendo resposta (prazo de {plural(awaitingDays, "dia", "dias")}).</p>}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {waiting?.slice(0, 3).map((w) => (
                <li key={w.threadId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold">{w.to}</span>
                    <span className="block truncate text-mute">há {plural(w.dias, "dia", "dias")} · {w.subject}</span>
                  </span>
                  {drafted[w.threadId] ? (
                    <ExtLink href={w.url} className="btn min-h-9 shrink-0 px-3 py-1.5 text-[13px] no-underline">Abrir ↗</ExtLink>
                  ) : (
                    <button
                      type="button"
                      onClick={() => followupWaiting(w)}
                      className="btn min-h-9 shrink-0 px-3 py-1.5 text-[13px]"
                    >
                      Cobrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Pessoal" className={`${card} flex flex-col gap-1`} style={neutral}>
            <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-mute">Pessoal</span>
            {unreadIn("pessoal").length === 0 ? (
              <>
                <span className="font-display text-4xl font-bold leading-none" style={{ color: "var(--k-pessoal)" }}>0</span>
                <span className="text-sm text-mute">Nada pendente. Aproveite.</span>
              </>
            ) : (
              <>
                <span className="font-display text-4xl font-bold leading-none tabular-nums">{unreadIn("pessoal").length}</span>
                <span className="truncate text-sm text-mute">Mais recente: {senderInfo(unreadIn("pessoal")[0].sender).nome}</span>
              </>
            )}
          </section>
        </div>
      </div>

      {/* 5 · Leitura leve */}
      <section id="leitura-leve" aria-label="Leitura leve" className="rounded-[28px] border border-line bg-card p-6" style={{ background: "var(--card)" }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-bold">Leitura leve</h2>
            <p className="m-0 text-sm text-mute">{plural(informativos.length, "informativo", "informativos")}, sem decisão um a um</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={informativos.length === 0 || summarizing}
              onClick={summarizeInformativos}
              className="btn min-h-11 disabled:opacity-50"
            >
              {summarizing ? "Resumindo…" : "Resumir com IA"}
            </button>
            <button
              type="button"
              disabled={unreadInformativos.length === 0}
              onClick={markInformativosRead}
              className="btn btn-primary min-h-11 disabled:opacity-50"
            >
              {unreadInformativos.length === 0 ? "Tudo lido" : `Marcar ${unreadInformativos.length} como lidos`}
            </button>
          </div>
        </div>
        {aiSummary && (
          <div className="mb-5 flex flex-col gap-2 rounded-2xl p-4 text-sm" style={{ background: "var(--surface-3)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-mute">Resumo dos informativos</span>
              <button type="button" onClick={() => setAiSummary(null)} className="btn min-h-8 px-2.5 py-1 text-xs">Fechar</button>
            </div>
            <p className="m-0 whitespace-pre-line leading-relaxed text-ink">{aiSummary}</p>
          </div>
        )}
        {informativos.length === 0 ? (
          <p className="m-0 text-mute">Nenhum informativo na janela.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {barulhento && (
              <article className="flex flex-col gap-2 rounded-[20px] p-5" style={{ background: "#f2f2fa", color: "#16172e" }}>
                <span className="text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: "#4b4d78" }}>Mais barulhento · {barulhento.qtd}</span>
                <span className="font-display text-xl font-bold">{barulhento.nome}</span>
                <span className="text-sm" style={{ color: "#3a3c5c" }}>{barulhento.assuntos.join(" · ")}</span>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
                  <ExtLink href={barulhento.url} className="text-sm font-semibold" style={{ color: "#3730a3" }}>Abrir o mais recente</ExtLink>
                  {barulhento.email.includes("@") && (
                    <button
                      type="button"
                      onClick={() => muteSender(barulhento.email, barulhento.nome)}
                      className="cursor-pointer bg-transparent p-0 text-sm font-semibold"
                      style={{ color: "#4b4d78" }}
                    >
                      Silenciar
                    </button>
                  )}
                </div>
              </article>
            )}
            {outros.slice(0, barulhento ? 2 : 3).map((g) => (
              <article key={g.email} className="flex flex-col gap-2 rounded-[20px] p-5" style={{ background: "var(--surface-3)" }}>
                <span className="flex items-center gap-2.5">
                  <Avatar name={g.nome} cat="informativo" size={34} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{g.nome}</span>
                  <span className="text-xs text-mute">{g.qtd > 1 ? `${g.qtd} e-mails` : g.ultimo}</span>
                </span>
                <span className="line-clamp-2 text-sm text-mute">{g.linha}</span>
                <div className="mt-auto flex flex-wrap items-center gap-4 pt-2">
                  <ExtLink href={g.url} className="text-sm font-semibold">Abrir</ExtLink>
                  {g.email.includes("@") && (
                    <button
                      type="button"
                      onClick={() => muteSender(g.email, g.nome)}
                      className="cursor-pointer bg-transparent p-0 text-sm font-semibold text-mute hover:text-ink"
                    >
                      Silenciar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {outros.length > (barulhento ? 2 : 3) && (
          <button type="button" onClick={() => setFiltro("informativo")} className="mt-4 min-h-11 bg-transparent p-0 text-sm font-semibold" style={{ color: "var(--link)" }}>
            Ver todos os {grupos.length} remetentes
          </button>
        )}
      </section>

      {/* Atalhos */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-mute">
        {shortcutsEnabled ? (
          <>
            <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="btn min-h-9 px-3 py-1 text-[13px]">Atalhos ( ? )</button>
            {help && (
              <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><Kbd>A</Kbd> arquivar</span>
                <span><Kbd>G</Kbd> pôr na agenda</span>
                <span><Kbd>T</Kbd> virar tarefa</span>
                <span><Kbd>U</Kbd> desfazer</span>
                <span><Kbd>J</Kbd> <Kbd>→</Kbd> próximo</span>
                <span><Kbd>K</Kbd> <Kbd>←</Kbd> anterior</span>
                <span><Kbd>1</Kbd>–<Kbd>7</Kbd> fila</span>
                <span><Kbd>/</Kbd> buscar</span>
                <span><Kbd>R</Kbd> abrir no Gmail</span>
              </p>
            )}
          </>
        ) : (
          <span>Atalhos de teclado desativados (Configurações).</span>
        )}
      </div>

      <ActionToast
        toast={toast ? { ...toast, undoLabel: "Desfazer (U)" } : null}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
