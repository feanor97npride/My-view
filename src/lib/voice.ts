let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let speechSeq = 0;

const audioCache = new Map<string, Blob>();
const inflightCache = new Map<string, Promise<Blob | null>>();
const MAX_CACHE_ITEMS = 30;

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

// Splits text so the first chunk is short (fast start) and subsequent chunks are grouped for smooth playback.
function splitSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?;:])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [text.slice(0, 2500)];

  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const targetMax = chunks.length === 0 ? 150 : 340;
    if (!current) {
      current = s;
    } else if (current.length + 1 + s.length <= targetMax) {
      current = `${current} ${s}`;
    } else {
      chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function rememberAudio(key: string, blob: Blob) {
  if (audioCache.size >= MAX_CACHE_ITEMS) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
  audioCache.set(key, blob);
}

function fetchTtsBlob(chunk: string): Promise<Blob | null> {
  const cached = audioCache.get(chunk);
  if (cached) return Promise.resolve(cached);
  const inflight = inflightCache.get(chunk);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
      });
      if (res.status === 200 && res.headers.get("content-type")?.includes("audio")) {
        const blob = await res.blob();
        if (blob.size > 0) {
          rememberAudio(chunk, blob);
          return blob;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      inflightCache.delete(chunk);
    }
  })();

  inflightCache.set(chunk, p);
  return p;
}

export function prefetchSpeech(text: string): void {
  if (!canSpeak()) return;
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;
  const first = splitSpeechChunks(cleaned)[0];
  if (first && !audioCache.has(first)) {
    void fetchTtsBlob(first);
  }
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

function speakBrowser(
  cleaned: string,
  seq: number,
  opts?: { onStart?: () => void; onReady?: () => void; onEnd?: () => void },
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts?.onEnd?.();
    return false;
  }
  if (seq !== speechSeq) return false;
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "pt-BR";
  utter.rate = 1.05;
  utter.pitch = 1;
  const voice = pickPtBrVoice();
  if (voice) utter.voice = voice;
  utter.onstart = () => {
    if (seq === speechSeq) {
      opts?.onReady?.();
      opts?.onStart?.();
    }
  };
  utter.onend = () => {
    if (seq === speechSeq) opts?.onEnd?.();
  };
  utter.onerror = () => {
    if (seq === speechSeq) opts?.onEnd?.();
  };
  window.speechSynthesis.speak(utter);
  return true;
}

function playBlob(blob: Blob, seq: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (seq !== speechSeq) {
      resolve(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    currentUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;
    const cleanup = (ok: boolean) => {
      if (currentUrl === url) {
        URL.revokeObjectURL(url);
        currentUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      resolve(ok);
    };
    audio.onended = () => cleanup(true);
    audio.onerror = () => cleanup(false);
    audio.play().catch(() => cleanup(false));
  });
}

export function speakPtBr(
  text: string,
  opts?: { onStart?: () => void; onReady?: () => void; onEnd?: () => void },
): boolean {
  if (!canSpeak()) return false;
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return false;
  stopSpeaking();
  const seq = speechSeq;
  opts?.onStart?.();

  const chunks = splitSpeechChunks(cleaned);

  void (async () => {
    let nextPromise = fetchTtsBlob(chunks[0]);
    for (let i = 0; i < chunks.length; i++) {
      if (seq !== speechSeq) return;
      const blob = await nextPromise;
      if (seq !== speechSeq) return;

      // Prefetch next chunk in parallel while current chunk plays
      if (i + 1 < chunks.length) {
        nextPromise = fetchTtsBlob(chunks[i + 1]);
      }

      if (!blob) {
        const remaining = chunks.slice(i).join(" ");
        speakBrowser(remaining, seq, opts);
        return;
      }

      if (i === 0) opts?.onReady?.();
      const played = await playBlob(blob, seq);
      if (seq !== speechSeq) return;
      if (!played) {
        const remaining = chunks.slice(i).join(" ");
        speakBrowser(remaining, seq, opts);
        return;
      }
    }
    if (seq === speechSeq) opts?.onEnd?.();
  })();

  return true;
}
