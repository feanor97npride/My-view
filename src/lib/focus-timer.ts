export type FocusSession = {
  title: string;
  taskId?: string;
  durationSec: number;
  endAtMs: number; // when running, timestamp in ms when timer hits 0
  remainingSec: number; // used when paused
  paused: boolean;
};

const KEY = "myview:focus-timer";
export const FOCUS_EVENT = "myview:focus-changed";

export function readFocusSession(): FocusSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FocusSession;
    if (!parsed || typeof parsed.title !== "string" || typeof parsed.durationSec !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFocusSession(session: FocusSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT));
}

export function startFocusTimer(input: { title: string; minutes?: number; taskId?: string }): void {
  const durationSec = Math.max(60, Math.round((input.minutes ?? 25) * 60));
  writeFocusSession({
    title: input.title,
    taskId: input.taskId,
    durationSec,
    endAtMs: Date.now() + durationSec * 1000,
    remainingSec: durationSec,
    paused: false,
  });
}

export function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
