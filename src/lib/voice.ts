export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
}

export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`~>•]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPtBrVoice(): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const ptBr = voices.filter((v) => v.lang.toLowerCase().startsWith("pt-br"));
  return (
    ptBr.find((v) => /google|natural|neural|francisca|maria|antonio|luciana/i.test(v.name)) ??
    ptBr[0] ??
    voices.find((v) => v.lang.toLowerCase().startsWith("pt")) ??
    null
  );
}

export function speakPtBr(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): boolean {
  if (!canSpeak()) return false;
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "pt-BR";
  utter.rate = 1.03;
  utter.pitch = 1;
  const voice = pickPtBrVoice();
  if (voice) utter.voice = voice;
  utter.onstart = () => opts?.onStart?.();
  utter.onend = () => opts?.onEnd?.();
  utter.onerror = () => opts?.onEnd?.();
  window.speechSynthesis.speak(utter);
  return true;
}
