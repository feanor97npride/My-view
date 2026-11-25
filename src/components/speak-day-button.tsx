"use client";

import { useEffect, useState } from "react";
import { canSpeak, prefetchSpeech, speakPtBr, stopSpeaking } from "@/lib/voice";

export default function SpeakDayButton({ script }: { script: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    setSupported(canSpeak());
    return () => stopSpeaking();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (speaking || preparing) {
      stopSpeaking();
      setPreparing(false);
      setSpeaking(false);
      return;
    }
    setPreparing(true);
    const ok = speakPtBr(script, {
      onStart: () => setSpeaking(true),
      onReady: () => setPreparing(false),
      onEnd: () => {
        setPreparing(false);
        setSpeaking(false);
      },
    });
    if (!ok) setPreparing(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => prefetchSpeech(script)}
      onFocus={() => prefetchSpeech(script)}
      aria-pressed={speaking}
      className={`btn spring-btn min-h-8 px-3 py-1 text-xs font-semibold ${
        speaking ? "border-primary bg-primary-soft text-primary-ink" : ""
      }`}
    >
      {preparing ? "⏳ Preparando…" : speaking ? "⏹ Parar voz" : "🔊 Ouvir meu dia"}
    </button>
  );
}
