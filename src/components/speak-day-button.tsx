"use client";

import { useEffect, useState } from "react";
import { canSpeak, speakPtBr, stopSpeaking } from "@/lib/voice";

export default function SpeakDayButton({ script }: { script: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(canSpeak());
    return () => stopSpeaking();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = speakPtBr(script, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
    if (ok) setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={`btn spring-btn min-h-8 px-3 py-1 text-xs font-semibold ${
        speaking ? "border-primary bg-primary-soft text-primary-ink" : ""
      }`}
    >
      {speaking ? "⏹ Parar voz" : "🔊 Ouvir meu dia"}
    </button>
  );
}
