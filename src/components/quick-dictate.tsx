"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { stopSpeaking } from "@/lib/voice";

type SpeechRecognitionResultLike = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;

type SpeechRecLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: SpeechRecognitionResultLike }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecLike;
  webkitSpeechRecognition?: new () => SpeechRecLike;
};

function getCtor(): (new () => SpeechRecLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictateTrigger({ collapsed = false }: { collapsed?: boolean }) {
  const openDictate = () => window.dispatchEvent(new CustomEvent("myview:open-dictate"));

  return (
    <button
      type="button"
      onClick={openDictate}
      title="Ditar rápido (Alt+D)"
      aria-label="Ditar rápido"
      className={`spring-btn flex w-full cursor-pointer items-center rounded-xl border border-primary/30 bg-primary-soft/70 py-2 text-xs font-semibold text-primary-ink transition-colors hover:border-primary hover:bg-primary-soft ${
        collapsed ? "justify-center px-2" : "justify-between px-3"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true">🎤</span>
        {!collapsed && <span>Ditar rápido</span>}
      </span>
      {!collapsed && (
        <kbd className="rounded border border-primary/30 bg-card px-1.5 py-0.5 text-[10px] font-semibold">Alt+D</kbd>
      )}
    </button>
  );
}

export default function QuickDictate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState<"task" | "note" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecLike | null>(null);

  const stopMic = useCallback(() => {
    try {
      recRef.current?.abort?.();
      recRef.current?.stop();
    } catch {
      // ignore
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const startMic = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Reconhecimento de voz não suportado neste navegador. Use Chrome, Edge ou Safari, ou digite abaixo.");
      return;
    }

    stopSpeaking();
    stopMic();
    setError(null);
    setStatus(null);

    try {
      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (ev) => {
        let finalPart = "";
        let interimPart = "";
        for (let i = 0; i < ev.results.length; i++) {
          const item = ev.results[i];
          const chunk = item?.[0]?.transcript ?? "";
          if (!chunk) continue;
          if (item.isFinal) {
            finalPart += (finalPart ? " " : "") + chunk.trim();
          } else {
            interimPart += (interimPart ? " " : "") + chunk.trim();
          }
        }
        setInterim(interimPart);
        if (finalPart) {
          setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${finalPart}` : finalPart));
          setInterim("");
        }
      };

      rec.onerror = (ev) => {
        setListening(false);
        setInterim("");
        if (ev?.error && ev.error !== "aborted") {
          setError(
            ev.error === "not-allowed" || ev.error === "service-not-allowed"
              ? "Permissão do microfone negada."
              : ev.error === "no-speech"
                ? "Nenhuma fala detectada. Toque no microfone para tentar de novo."
                : "Falha ao capturar áudio.",
          );
        }
      };

      rec.onend = () => {
        setListening(false);
        setInterim("");
        recRef.current = null;
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setError("Não foi possível iniciar o microfone.");
    }
  }, [stopMic]);

  const openAndStart = useCallback(() => {
    setOpen(true);
    setStatus(null);
    setError(null);
    setTimeout(() => startMic(), 30);
  }, [startMic]);

  const close = useCallback(() => {
    stopMic();
    setOpen(false);
    setInterim("");
    setStatus(null);
    setError(null);
  }, [stopMic]);

  useEffect(() => {
    const onOpen = () => openAndStart();
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (open) close();
        else openAndStart();
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("myview:open-dictate", onOpen);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("myview:open-dictate", onOpen);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, openAndStart, close]);

  useEffect(() => () => stopMic(), [stopMic]);

  const displayedText = interim ? (text.trim() ? `${text.trimEnd()} ${interim}` : interim) : text;

  const saveAsTask = async () => {
    const clean = displayedText.trim();
    if (!clean || busy) return;
    stopMic();
    setBusy("task");
    setError(null);
    try {
      const res = await fetch("/api/tasks/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: clean.slice(0, 200), due: "today" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setText("");
      setStatus("✓ Tarefa criada no ClickUp para hoje!");
      router.refresh();
    } catch {
      setError("Falha de conexão ao criar tarefa.");
    } finally {
      setBusy(null);
    }
  };

  const saveAsNote = async () => {
    const clean = displayedText.trim();
    if (!clean || busy) return;
    stopMic();
    setBusy("note");
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, append: true }),
      });
      if (!res.ok) {
        setError(`Erro ${res.status} ao salvar nota.`);
        return;
      }
      setText("");
      setStatus("✓ Salvo nas Notas rápidas!");
      router.refresh();
    } catch {
      setError("Falha de conexão ao salvar nota.");
    } finally {
      setBusy(null);
    }
  };

  const copyText = async () => {
    const clean = displayedText.trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      setStatus("✓ Texto copiado!");
    } catch {
      setError("Não foi possível copiar automaticamente.");
    }
  };

  return (
    <>
      {/* Botão flutuante de fácil acesso em todas as telas no mobile */}
      {!open && (
        <button
          type="button"
          onClick={openAndStart}
          aria-label="Ditar rápido"
          title="Ditar rápido (Alt+D)"
          className="toast-enter spring-btn fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-card px-3.5 py-2 text-xs font-semibold text-ink shadow-xl hover:border-primary md:hidden"
        >
          <span aria-hidden="true">🎤</span>
          <span>Ditar</span>
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label="Ditar rápido"
          className="toast-enter fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-3 rounded-[22px] border border-line-strong bg-card p-4 shadow-2xl md:inset-x-auto md:bottom-6 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={listening ? stopMic : startMic}
                className={`btn spring-btn min-h-9 px-3 py-1 text-xs font-semibold ${
                  listening ? "animate-pulse border-red-500 bg-red-500/10 text-red-600" : "btn-primary"
                }`}
              >
                {listening ? "⏹ Ouvindo…" : "🎤 Ditar"}
              </button>
              <span className="text-xs text-mute">
                {listening ? "Fale agora (pt-BR)" : "Toque para continuar ditando"}
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar ditado"
              className="btn spring-btn min-h-8 w-8 p-0 text-sm"
            >
              ×
            </button>
          </div>

          <textarea
            value={displayedText}
            onChange={(e) => {
              setInterim("");
              setText(e.target.value);
            }}
            rows={3}
            placeholder="O que você ditar aparecerá aqui… Depois escolha onde salvar ou copie."
            className="w-full resize-none rounded-2xl border border-line-strong bg-bg p-3 text-sm text-ink outline-none focus:border-primary"
          />

          {status && <p className="m-0 text-xs font-medium" style={{ color: "var(--green-fg)" }}>{status}</p>}
          {error && <p role="alert" className="m-0 text-xs" style={{ color: "var(--red-fg)" }}>{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!displayedText.trim() || busy !== null}
                onClick={() => void saveAsTask()}
                className="btn btn-primary spring-btn min-h-9 px-3 py-1 text-xs disabled:opacity-50"
              >
                {busy === "task" ? "Criando…" : "+ Tarefa ClickUp"}
              </button>
              <button
                type="button"
                disabled={!displayedText.trim() || busy !== null}
                onClick={() => void saveAsNote()}
                className="btn spring-btn min-h-9 px-3 py-1 text-xs disabled:opacity-50"
              >
                {busy === "note" ? "Salvando…" : "📝 Nota rápida"}
              </button>
              <button
                type="button"
                disabled={!displayedText.trim()}
                onClick={() => void copyText()}
                className="btn spring-btn min-h-9 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                📋 Copiar
              </button>
            </div>
            {text && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setInterim("");
                  setStatus(null);
                }}
                className="cursor-pointer border-0 bg-transparent px-1 text-xs text-mute hover:text-ink"
              >
                Limpar
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
