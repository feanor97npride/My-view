"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { speakPtBr, stopSpeaking } from "@/lib/voice";

type Phase = "idle" | "listening" | "thinking" | "speaking";

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

const QUICK_PROMPTS = [
  "Quais são minhas tarefas de hoje?",
  "O que tenho na agenda agora?",
  "Tenho algum e-mail urgente?",
];

function getRecognitionCtor(): (new () => SpeechRecLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapMicError(code?: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o acesso nas configurações do navegador.";
    case "audio-capture":
      return "Nenhum microfone detectado neste aparelho.";
    case "no-speech":
      return "Não ouvi nada. Toque no microfone para tentar novamente.";
    case "network":
      return "Falha de rede no reconhecimento de voz.";
    default:
      return "Não foi possível capturar o áudio.";
  }
}

export function VoiceModeTrigger({ compact = false }: { compact?: boolean }) {
  const openVoice = () => window.dispatchEvent(new CustomEvent("myview:open-voice-mode"));

  if (compact) {
    return (
      <button
        type="button"
        onClick={openVoice}
        aria-label="Conversa por voz"
        title="Modo Conversa por Voz (⌘⇧J)"
        className="btn spring-btn min-h-9 px-2.5 text-xs md:min-h-10"
      >
        🎙️
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openVoice}
      className="spring-btn flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-primary/50 hover:bg-primary-soft/50"
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true">🎙️</span>
        Conversa por voz
      </span>
      <kbd className="rounded border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-semibold text-mute">⌘⇧J</kbd>
    </button>
  );
}

export default function VoiceAssistantMode() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [continuous, setContinuous] = useState(true);
  const [liveText, setLiveText] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fallbackInput, setFallbackInput] = useState("");
  const [supported, setSupported] = useState(true);

  const openRef = useRef(false);
  const continuousRef = useRef(true);
  const recRef = useRef<SpeechRecLike | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  const stopAllAudioAndMic = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recRef.current?.abort?.();
      recRef.current?.stop();
    } catch {
      // ignore
    }
    recRef.current = null;
    stopSpeaking();
  }, []);

  const startListening = useCallback(() => {
    if (!openRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setPhase("idle");
      setError("Reconhecimento de voz não suportado neste navegador. Use Chrome, Edge ou Safari, ou digite abaixo.");
      return;
    }

    stopAllAudioAndMic();
    setError(null);
    setLiveText("");

    try {
      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let finalCaptured = "";

      rec.onresult = (ev) => {
        let interim = "";
        let finalChunk = "";
        for (let i = 0; i < ev.results.length; i++) {
          const item = ev.results[i];
          const text = item?.[0]?.transcript ?? "";
          if (!text) continue;
          if (item.isFinal) {
            finalChunk += (finalChunk ? " " : "") + text.trim();
          } else {
            interim += (interim ? " " : "") + text.trim();
          }
        }
        if (interim) setLiveText(interim);
        if (finalChunk) {
          finalCaptured = finalChunk;
          setLiveText(finalChunk);
          try {
            rec.stop();
          } catch {
            // ignore
          }
        }
      };

      rec.onerror = (ev) => {
        recRef.current = null;
        if (!openRef.current) return;
        setPhase("idle");
        if (ev?.error && ev.error !== "aborted") {
          setError(mapMicError(ev.error));
        }
      };

      rec.onend = () => {
        recRef.current = null;
        if (!openRef.current) return;
        const text = finalCaptured.trim();
        if (text) {
          submitRef.current(text);
        } else {
          setPhase((cur) => (cur === "listening" ? "idle" : cur));
        }
      };

      recRef.current = rec;
      setPhase("listening");
      rec.start();
    } catch {
      setPhase("idle");
      setError("Não foi possível iniciar o microfone.");
    }
  }, [stopAllAudioAndMic]);

  const askAssistant = useCallback(
    async (spokenText: string) => {
      const clean = spokenText.trim();
      if (!clean || !openRef.current) return;

      setPhase("thinking");
      setUserPrompt(clean);
      setLiveText("");
      setError(null);
      setActions([]);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: clean, history: [] }),
        });
        const j = (await res.json().catch(() => ({}))) as { reply?: string; actions?: string[]; error?: string };
        if (!openRef.current) return;

        if (!res.ok || !j.reply) {
          setPhase("idle");
          setError(j.error ?? `Erro ${res.status} ao consultar o assistente.`);
          return;
        }

        const answer = j.reply;
        setReply(answer);
        setActions(j.actions ?? []);
        if (j.actions && j.actions.length > 0) {
          router.refresh();
        }

        setPhase("speaking");
        speakPtBr(answer, {
          onStart: () => {
            if (openRef.current) setPhase("speaking");
          },
          onEnd: () => {
            if (!openRef.current) return;
            if (continuousRef.current && getRecognitionCtor()) {
              setPhase("idle");
              restartTimerRef.current = setTimeout(() => {
                if (openRef.current && continuousRef.current) {
                  startListening();
                }
              }, 450);
            } else {
              setPhase("idle");
            }
          },
        });
      } catch {
        if (!openRef.current) return;
        setPhase("idle");
        setError("Falha de conexão com o assistente.");
      }
    },
    [router, startListening],
  );

  useEffect(() => {
    submitRef.current = (text: string) => {
      void askAssistant(text);
    };
  }, [askAssistant]);

  const close = useCallback(() => {
    setOpen(false);
    setPhase("idle");
    setLiveText("");
    stopAllAudioAndMic();
  }, [stopAllAudioAndMic]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);

    const onOpen = () => {
      setOpen(true);
      setError(null);
      setTimeout(() => {
        if (getRecognitionCtor()) {
          startListening();
        }
      }, 60);
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (openRef.current) close();
        else onOpen();
      } else if (e.key === "Escape" && openRef.current) {
        close();
      }
    };

    window.addEventListener("myview:open-voice-mode", onOpen);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("myview:open-voice-mode", onOpen);
      document.removeEventListener("keydown", onKey, true);
      stopAllAudioAndMic();
    };
  }, [close, startListening, stopAllAudioAndMic]);

  if (!open) return null;

  const orbStyle =
    phase === "listening"
      ? "border-red-500 bg-red-500/15 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.28)] scale-105 animate-pulse"
      : phase === "thinking"
        ? "border-amber-500 bg-amber-500/15 text-amber-500 shadow-[0_0_45px_rgba(245,158,11,0.22)] animate-pulse"
        : phase === "speaking"
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.26)] scale-105"
          : "border-primary/50 bg-primary-soft text-primary hover:border-primary hover:scale-105";

  const statusLabel =
    phase === "listening"
      ? "Ouvindo você…"
      : phase === "thinking"
        ? "Consultando agenda, tarefas e e-mails…"
        : phase === "speaking"
          ? "Respondendo em voz…"
          : "Toque no microfone para falar";

  const handleMainOrbClick = () => {
    if (phase === "listening") {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      return;
    }
    if (phase === "speaking") {
      stopSpeaking();
      startListening();
      return;
    }
    if (phase === "idle") {
      startListening();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Conversa por Voz"
      className="fixed inset-0 z-50 flex h-dvh flex-col justify-between bg-bg/95 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
    >
      {/* Topo */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-base">🎙️</span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">Modo Conversa por Voz</h2>
            <p className="m-0 text-[11px] text-mute">Hands-free · pt-BR Neural</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setContinuous((v) => !v)}
            aria-pressed={continuous}
            className={`btn spring-btn min-h-9 px-3 text-xs ${
              continuous ? "border-primary bg-primary-soft text-primary-ink" : "text-mute"
            }`}
          >
            {continuous ? "∞ Contínuo" : "1x"}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar modo voz"
            className="btn spring-btn min-h-9 w-9 p-0 text-base"
          >
            ×
          </button>
        </div>
      </header>

      {/* Centro: Orbe + Transcrição + Resposta */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-4 text-center">
        <button
          type="button"
          onClick={handleMainOrbClick}
          disabled={phase === "thinking"}
          aria-label={statusLabel}
          className={`flex h-36 w-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-full border-2 transition-all duration-300 disabled:cursor-wait sm:h-40 sm:w-40 ${orbStyle}`}
        >
          <span className="text-4xl" aria-hidden="true">
            {phase === "listening" ? "🎙️" : phase === "thinking" ? "✨" : phase === "speaking" ? "🔊" : "🎤"}
          </span>
          <span className="text-xs font-semibold">
            {phase === "listening"
              ? "Ouvindo"
              : phase === "thinking"
                ? "Pensando"
                : phase === "speaking"
                  ? "Interromper"
                  : "Falar"}
          </span>
        </button>

        <p className="m-0 text-sm font-medium text-mute">{statusLabel}</p>

        {(liveText || userPrompt) && (
          <div className="w-full rounded-2xl border border-line bg-card/70 px-4 py-3 text-left">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-mute">Você</div>
            <p className="m-0 text-sm text-ink">{liveText || userPrompt}</p>
          </div>
        )}

        {reply && (
          <div className="w-full max-h-56 overflow-y-auto rounded-2xl border border-primary/25 bg-card px-4 py-3.5 text-left shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Assistente</span>
              {actions.length > 0 && (
                <span className="chip chip-green px-2 py-0.5 text-[10px]">{actions.join(" · ")}</span>
              )}
            </div>
            <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-ink">{reply}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="chip chip-red m-0 max-w-full whitespace-normal rounded-xl px-3.5 py-2 text-xs">
            {error}
          </p>
        )}

        {!reply && !liveText && phase === "idle" && (
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void askAssistant(q)}
                className="btn spring-btn min-h-9 rounded-full px-3.5 py-1.5 text-xs"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Rodapé: Controles rápidos / Fallback texto */}
      <footer className="mx-auto flex w-full max-w-xl flex-col gap-2">
        {!supported && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!fallbackInput.trim() || phase === "thinking") return;
              const txt = fallbackInput.trim();
              setFallbackInput("");
              void askAssistant(txt);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={fallbackInput}
              onChange={(e) => setFallbackInput(e.target.value)}
              placeholder="Digite sua pergunta para ouvir a resposta…"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-card px-3.5 text-sm text-ink outline-none focus:border-primary"
            />
            <button type="submit" disabled={!fallbackInput.trim() || phase === "thinking"} className="btn btn-primary spring-btn min-h-11 px-4 text-sm">
              Enviar
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-2">
          {phase === "speaking" && (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setPhase("idle");
              }}
              className="btn spring-btn min-h-10 px-4 text-xs"
            >
              ⏹ Parar fala
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              close();
              window.dispatchEvent(new CustomEvent("myview:open-assistant"));
            }}
            className="btn spring-btn min-h-10 px-4 text-xs text-mute"
          >
            Abrir chat em texto
          </button>
        </div>
      </footer>
    </div>
  );
}
