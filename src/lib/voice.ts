let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let speechSeq = 0;

export function canSpeak(): boolean {
  return typeof window !== "undefined";
}

export function stopSpeaking(): void {
  speechSeq++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
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
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
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

function speakBrowser(cleaned: string, seq: number, opts?: { onStart?: () => void; onEnd?: () => void }): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts?.onEnd?.();
    return false;
  }
  if (seq !== speechSeq) return false;
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "pt-BR";
  utter.rate = 1.03;
  utter.pitch = 1;
  const voice = pickPtBrVoice();
  if (voice) utter.voice = voice;
  utter.onstart = () => { if (seq === speechSeq) opts?.onStart?.(); };
  utter.onend = () => { if (seq === speechSeq) opts?.onEnd?.(); };
  utter.onerror = () => { if (seq === speechSeq) opts?.onEnd?.(); };
  window.speechSynthesis.speak(utter);
  return true;
}

export function speakPtBr(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): boolean {
  if (!canSpeak()) return false;
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;
  stopSpeaking();
  const seq = speechSeq;
  opts?.onStart?.();

  void (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
      });
      if (seq !== speechSeq) return;
      if (res.status === 200 && res.headers.get("content-type")?.includes("audio")) {
        const blob = await res.blob();
        if (seq !== speechSeq) return;
        const url = URL.createObjectURL(blob);
        currentUrl = url;
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          if (seq === speechSeq) {
            stopSpeaking();
            opts?.onEnd?.();
          }
        };
        audio.onerror = () => {
          if (seq === speechSeq) {
            stopSpeaking();
            speakBrowser(cleaned, seq, opts);
          }
        };
        await audio.play();
        return;
      }
    } catch {
      // fallback to browser speechSynthesis
    }
    speakBrowser(cleaned, seq, opts);
  })();

  return true;
}
