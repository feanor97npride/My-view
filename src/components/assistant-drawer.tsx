"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import VoiceInputButton from "@/components/voice-input-button";
import { openInObsidian } from "@/lib/obsidian";
import { canSpeak, speakPtBr, stopSpeaking } from "@/lib/voice";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

const SUGGESTIONS = [
  "Quais são minhas tarefas do dia?",
  "O que tenho hoje e onde encaixo 1h de foco?",
  "Cria uma tarefa para amanhã: revisar pendências",
  "Lembre que prefiro foco de manhã sem reuniões",
];

export function AssistantTrigger({ compact = false }: { compact?: boolean }) {
  const openDrawer = () => window.dispatchEvent(new CustomEvent("myview:open-assistant"));

  if (compact) {
    return (
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Abrir Assistente Pessoal"
        title="Assistente Pessoal (⌘J)"
        className="btn btn-primary spring-btn min-h-10 px-2.5 text-xs"
      >
        ✨
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="spring-btn flex w-full cursor-pointer items-center justify-between rounded-xl border border-primary/30 bg-primary-soft/70 px-3 py-2 text-xs font-semibold text-primary-ink transition-colors hover:border-primary hover:bg-primary-soft"
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true">✨</span>
        Assistente
      </span>
      <kbd className="rounded border border-primary/30 bg-card px-1.5 py-0.5 text-[10px] font-semibold">⌘J</kbd>
    </button>
  );
}

export default function AssistantDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<string[]>([]);
  const [showMem, setShowMem] = useState(false);
  const [voiceAuto, setVoiceAuto] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("myview:assistant-voice") === "0") setVoiceAuto(false);
    } catch {
      // ignore
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("myview:open-assistant", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("myview:open-assistant", onOpen);
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 20);
    fetch("/api/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { memory?: string[]; history?: Msg[] } | null) => {
        if (d?.memory) setMemory(d.memory);
        if (d?.history && messages.length === 0) setMessages(d.history);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (!open) return null;

  const toggleVoiceAuto = () => {
    setVoiceAuto((v) => {
      const next = !v;
      if (!next) {
        stopSpeaking();
        setSpeakingIdx(null);
      }
      try {
        localStorage.setItem("myview:assistant-voice", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const speakMessage = (idx: number, content: string) => {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    speakPtBr(content, {
      onStart: () => setSpeakingIdx(idx),
      onEnd: () => setSpeakingIdx((cur) => (cur === idx ? null : cur)),
    });
  };

  const clearHistory = async () => {
    stopSpeaking();
    setSpeakingIdx(null);
    setMessages([]);
    await fetch("/api/assistant?clear=history", { method: "DELETE" }).catch(() => {});
  };

  const send = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || sending) return;
    setError(null);
    const nextHistory: Msg[] = [...messages, { role: "user", content }];
    setMessages(nextHistory);
    if (!textOverride) setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        reply?: string;
        actions?: string[];
        memory?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      if (j.memory) setMemory(j.memory);
      const replyText = j.reply ?? "Pronto!";
      const replyIdx = nextHistory.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText, actions: j.actions },
      ]);
      if (voiceAuto && canSpeak()) {
        speakPtBr(replyText, {
          onStart: () => setSpeakingIdx(replyIdx),
          onEnd: () => setSpeakingIdx((cur) => (cur === replyIdx ? null : cur)),
        });
      }
      if (j.actions && j.actions.length > 0) {
        router.refresh();
      }
    } catch {
      setError("Falha de conexão com o assistente.");
    } finally {
      setSending(false);
    }
  };

  const removeMemory = async (index: number) => {
    const res = await fetch(`/api/assistant?index=${index}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      const j = (await res.json().catch(() => ({}))) as { memory?: string[] };
      if (j.memory) setMemory(j.memory);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Assistente Pessoal"
    >
      <aside
        className="toast-enter flex h-dvh w-full max-w-md flex-col border-l border-line-strong bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-sm sm:h-9 sm:w-9 sm:text-base">✨</span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-bold text-ink sm:text-base">Assistente</h2>
              <p className="m-0 hidden truncate text-[11px] text-mute sm:block">Agenda · ClickUp · Gmail · Notas</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {canSpeak() && (
              <button
                type="button"
                onClick={toggleVoiceAuto}
                title={voiceAuto ? "Desativar voz automática" : "Ativar voz automática"}
                className={`btn spring-btn min-h-8 px-2 py-1 text-xs ${voiceAuto ? "border-primary bg-primary-soft text-primary-ink" : "text-mute"}`}
              >
                {voiceAuto ? "🔊 Voz" : "🔇"}
              </button>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => void clearHistory()}
                title="Limpar conversa"
                className="btn spring-btn min-h-8 px-2.5 py-1 text-xs text-mute"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMem((v) => !v)}
              className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
            >
              Memória ({memory.length})
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="btn spring-btn min-h-8 w-8 p-0 text-sm"
            >
              ×
            </button>
          </div>
        </header>

        {showMem && (
          <div className="border-b border-line bg-bg px-5 py-3">
            <p className="mt-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-mute">
              Memória desta conta
            </p>
            {memory.length === 0 ? (
              <p className="m-0 text-xs text-mute">Nenhuma preferência salva ainda. Diga algo como &ldquo;Lembre que...&rdquo;.</p>
            ) : (
              <ul className="m-0 flex max-h-36 list-none flex-col gap-1 overflow-y-auto p-0">
                {memory.map((fact, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 text-xs text-ink">
                    <span className="min-w-0 flex-1">{fact}</span>
                    <button
                      type="button"
                      onClick={() => void removeMemory(idx)}
                      aria-label="Remover memória"
                      className="cursor-pointer border-0 bg-transparent px-1 text-xs text-mute hover:text-ink"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-sm text-mute">
                Peça por texto ou voz para consultar suas tarefas do dia, agendar blocos de foco, responder e-mails ou salvar lembretes.
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="spring-btn cursor-pointer rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-[var(--on-primary)]"
                      : "border border-line bg-bg text-ink"
                  }`}
                >
                  {m.content}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.actions.map((a, idx) => (
                      <span key={idx} className="chip chip-green px-2 py-0.5 text-[11px]">
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2">
                    {canSpeak() && (
                      <button
                        type="button"
                        onClick={() => speakMessage(i, m.content)}
                        className="cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[11px] font-medium text-mute hover:text-ink"
                      >
                        {speakingIdx === i ? "⏹ Parar" : "🔊 Ouvir"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openInObsidian({
                          title: `Assistente ${new Date().toISOString().slice(0, 10)}`,
                          content: m.content,
                        })
                      }
                      className="cursor-pointer border-0 bg-transparent px-1 py-0.5 text-[11px] font-medium text-mute hover:text-ink"
                    >
                      📓 Salvar no Obsidian
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-line bg-bg px-3.5 py-2 text-xs text-mute">
              Pensando e verificando suas ferramentas…
            </div>
          )}
          {error && (
            <p role="alert" className="chip chip-red m-0 rounded-xl px-3 py-2 text-xs">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 border-t border-line px-3.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
        >
          <VoiceInputButton
            title="Falar com o assistente"
            disabled={sending}
            onInterim={(interim) => setInput(interim)}
            onTranscript={(spoken) => {
              setError(null);
              setInput("");
              void send(spoken);
            }}
            onError={(msg) => setError(msg)}
            className="min-h-11 shrink-0 px-3 text-sm"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Peça algo ao seu assistente…"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3.5 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="btn btn-primary spring-btn min-h-11 shrink-0 px-4 text-sm disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </aside>
    </div>
  );
}
