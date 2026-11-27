"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import VoiceInputButton from "@/components/voice-input-button";
import { startFocusTimer } from "@/lib/focus-timer";

type Command = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  run: () => void;
};

export function CommandTrigger({ compact = false }: { compact?: boolean }) {
  const openPalette = () => window.dispatchEvent(new CustomEvent("myview:open-command-palette"));

  if (compact) {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="Abrir busca rápida"
        className="btn spring-btn min-h-10 px-2.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      className="spring-btn flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-bg px-3 py-2 text-xs text-mute transition-colors hover:border-primary/50 hover:text-ink"
    >
      <span className="inline-flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        Busca rápida
      </span>
      <kbd className="rounded border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
    </button>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "new-task">("search");
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState<"today" | "tomorrow" | "none">("today");
  const [saving, setSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "assistant",
        label: "✨ Abrir Assistente Pessoal",
        group: "Produtividade",
        keywords: "ia chat copiloto assistente lembrar",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("myview:open-assistant"));
        },
      },
      {
        id: "voice-mode",
        label: "🎙️ Modo Conversa por Voz (Hands-free)",
        group: "Produtividade",
        keywords: "voz audio jarvis falar microfone handsfree",
        run: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("myview:open-voice-mode"));
        },
      },
      {
        id: "new-task",
        label: "+ Nova tarefa rápida (ClickUp)",
        group: "Produtividade",
        keywords: "criar adicionar tarefa clickup rapida",
        run: () => {
          setTaskTitle(query.startsWith("+") ? query.slice(1).trim() : "");
          setTaskError(null);
          setMode("new-task");
          setTimeout(() => taskInputRef.current?.focus(), 10);
        },
      },
      {
        id: "focus-25",
        label: "▶ Iniciar foco de 25 min",
        group: "Produtividade",
        keywords: "pomodoro timer foco concentracao",
        run: () => {
          setOpen(false);
          startFocusTimer({ title: query.trim() || "Sessão de foco", minutes: 25 });
        },
      },
      { id: "hoje", label: "Ir para Hoje", group: "Navegação", keywords: "inicio cockpit agenda tarefas", run: () => { setOpen(false); router.push("/"); } },
      { id: "semana", label: "Ir para Semana", group: "Navegação", keywords: "calendario carga dias", run: () => { setOpen(false); router.push("/semana"); } },
      { id: "clickup", label: "Ir para ClickUp", group: "Navegação", keywords: "tarefas sprint listas kanban", run: () => { setOpen(false); router.push("/clickup"); } },
      { id: "emails", label: "Ir para E-mails", group: "Navegação", keywords: "triagem inbox gmail", run: () => { setOpen(false); router.push("/emails"); } },
      { id: "newsletters", label: "Ir para Newsletters em Áudio", group: "Navegação", keywords: "newsletter audio ia geopolitica resumo ouvir", run: () => { setOpen(false); router.push("/newsletters"); } },
      { id: "drive", label: "Ir para Google Drive", group: "Navegação", keywords: "drive arquivos docs planilhas pdf", run: () => { setOpen(false); router.push("/drive"); } },
      { id: "emails-acao", label: "E-mails: Fila Ação", group: "E-mails", keywords: "urgente responder", run: () => { setOpen(false); router.push("/emails?categoria=acao"); } },
      { id: "emails-fin", label: "E-mails: Fila Financeiro", group: "E-mails", keywords: "boletos contas pagar", run: () => { setOpen(false); router.push("/emails?categoria=financeiro"); } },
      { id: "github", label: "Ir para GitHub Live", group: "Navegação", keywords: "repositorios commits actions ci", run: () => { setOpen(false); router.push("/github"); } },
      { id: "conhecimento", label: "Ir para Base de Conhecimento", group: "Navegação", keywords: "aprendizados licoes kes projeto", run: () => { setOpen(false); router.push("/conhecimento"); } },
      { id: "indicadores", label: "Ir para Indicadores", group: "Navegação", keywords: "metricas grafico saude", run: () => { setOpen(false); router.push("/indicadores"); } },
      { id: "config", label: "Ir para Configurações", group: "Navegação", keywords: "preferencias regras clickup", run: () => { setOpen(false); router.push("/configuracoes"); } },
      {
        id: "tema",
        label: "Alternar tema Claro / Escuro",
        group: "Interface",
        keywords: "dark light mode aparencia",
        run: () => {
          setOpen(false);
          const root = document.documentElement;
          const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
          if (next === "dark") root.setAttribute("data-theme", "dark");
          else root.removeAttribute("data-theme");
          try {
            localStorage.setItem("theme", next);
          } catch {
            // ignore storage errors
          }
        },
      },
    ],
    [query, router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    if (q.startsWith("+")) return commands.filter((c) => c.id === "new-task");
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q) || (c.keywords?.includes(q) ?? false),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("myview:open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("myview:open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setMode("search");
      setQuery("");
      setIdx(0);
      setTaskError(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || saving) return;
    setSaving(true);
    setTaskError(null);
    try {
      const res = await fetch("/api/tasks/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: taskTitle.trim(), due: taskDue }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setTaskError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setTaskError("Falha de conexão ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[max(1.5rem,6vh)] backdrop-blur-[2px] md:px-4 md:pt-[14vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="toast-enter w-full max-w-lg overflow-hidden rounded-[22px] border border-line-strong bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "new-task" ? (
          <form onSubmit={createTask} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-ink">Nova tarefa rápida (ClickUp)</span>
              <button
                type="button"
                onClick={() => {
                  setMode("search");
                  setTimeout(() => inputRef.current?.focus(), 10);
                }}
                className="btn min-h-7 px-2 py-0.5 text-xs"
              >
                Voltar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                ref={taskInputRef}
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Ex: Revisar proposta comercial…"
                required
                className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
              <VoiceInputButton
                title="Ditar tarefa por voz"
                disabled={saving}
                onTranscript={(spoken) => setTaskTitle((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))}
                onError={(msg) => setTaskError(msg)}
                className="min-h-10 shrink-0 px-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    ["today", "Hoje"],
                    ["tomorrow", "Amanhã"],
                    ["none", "Sem prazo"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTaskDue(val)}
                    className={`chip cursor-pointer border text-xs ${
                      taskDue === val ? "chip-primary border-primary" : "border-line bg-bg text-mute"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={saving || !taskTitle.trim()} className="btn btn-primary spring-btn min-h-9 px-4 py-1.5 text-xs disabled:opacity-50">
                {saving ? "Criando…" : "Criar tarefa"}
              </button>
            </div>
            {taskError && <p className="m-0 text-xs" style={{ color: "var(--red-fg)" }}>{taskError}</p>}
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-mute" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((i) => (filtered.length ? (i + 1) % filtered.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
                  } else if (e.key === "Enter" && filtered[idx]) {
                    e.preventDefault();
                    filtered[idx].run();
                  }
                }}
                placeholder="Buscar tela, ação ou digite + para criar tarefa…"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-mute"
              />
              <VoiceInputButton
                title="Buscar por voz"
                onTranscript={(spoken) => {
                  setQuery(spoken);
                  setIdx(0);
                }}
                className="min-h-8 shrink-0 px-2 py-1 text-xs"
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] text-mute sm:inline-block">ESC</kbd>
            </div>

            <ul className="m-0 max-h-72 list-none overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-mute">Nenhum comando encontrado.</li>
              ) : (
                filtered.map((cmd, i) => (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onClick={() => cmd.run()}
                      onMouseEnter={() => setIdx(i)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        i === idx ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink hover:bg-primary-soft/50"
                      }`}
                    >
                      <span>{cmd.label}</span>
                      <span className="text-[11px] font-normal text-mute">{cmd.group}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
