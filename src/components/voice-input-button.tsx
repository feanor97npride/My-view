"use client";

import { useEffect, useRef, useState } from "react";
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

function getSpeechRecognitionCtor(): (new () => SpeechRecLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechInputSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

function mapSpeechError(code?: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão do microfone negada. Libere o microfone no navegador.";
    case "audio-capture":
      return "Nenhum microfone encontrado neste dispositivo.";
    case "no-speech":
      return "Nenhuma fala detectada. Tente falar mais perto do microfone.";
    case "network":
      return "Erro de rede ao transcrever o áudio.";
    default:
      return "Não foi possível capturar o áudio.";
  }
}

export default function VoiceInputButton({
  onTranscript,
  onInterim,
  onError,
  disabled = false,
  label,
  title = "Ditar por voz (pt-BR)",
  className = "",
}: {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecLike | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort?.();
        recRef.current?.stop();
      } catch {
        // ignore cleanup errors
      }
      recRef.current = null;
    };
  }, []);

  const toggle = () => {
    if (disabled) return;
    if (listening && recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.("Entrada por voz não suportada neste navegador. Use Chrome, Edge ou Safari.");
      return;
    }

    stopSpeaking();

    try {
      const rec = new Ctor();
      rec.lang = "pt-BR";
      rec.interimResults = Boolean(onInterim);
      rec.maxAlternatives = 1;

      rec.onresult = (ev) => {
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < ev.results.length; i++) {
          const item = ev.results[i];
          const chunk = item?.[0]?.transcript ?? "";
          if (!chunk) continue;
          if (item.isFinal !== false) {
            finalText += (finalText ? " " : "") + chunk.trim();
          } else {
            interimText += (interimText ? " " : "") + chunk.trim();
          }
        }
        if (interimText && onInterim) {
          onInterim(interimText);
        }
        if (finalText) {
          onTranscript(finalText);
        }
      };

      rec.onerror = (ev) => {
        setListening(false);
        if (ev?.error && ev.error !== "aborted") {
          onError?.(mapSpeechError(ev.error));
        }
      };

      rec.onend = () => {
        setListening(false);
        recRef.current = null;
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      onError?.("Não foi possível iniciar o microfone.");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Parar gravação" : title}
      aria-label={listening ? "Parar gravação de voz" : title}
      aria-pressed={listening}
      className={`btn spring-btn ${
        listening ? "animate-pulse border-red-500 bg-red-500/10 text-red-600" : ""
      } ${className}`}
    >
      <span aria-hidden="true">{listening ? "⏹" : "🎤"}</span>
      {(listening || label) && <span>{listening ? "Ouvindo…" : label}</span>}
    </button>
  );
}
