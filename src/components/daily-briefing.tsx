"use client";

import { useEffect, useState } from "react";
import { openInObsidian } from "@/lib/obsidian";

type BriefingPayload = {
  events: { time: string; title: string }[];
  tasks: { bucket: string; title: string }[];
  emails: { sender: string; subject: string }[];
};

export default function DailyBriefing({
  account,
  todayKey,
  payload,
  obsidianVault,
}: {
  account: string;
  todayKey: string;
  payload: BriefingPayload;
  obsidianVault?: string;
}) {
  const storageKey = `myview:briefing:${account}:${todayKey}`;
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) setText(cached);
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCollapsed(false);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !j.text) {
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setText(j.text);
      try {
        sessionStorage.setItem(storageKey, j.text);
      } catch {
        // ignore storage errors
      }
    } catch {
      setError("Falha de conexão ao gerar briefing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="btn spring-btn min-h-8 px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Gerando briefing…" : text ? "↻ Atualizar briefing IA" : "✨ Briefing IA do dia"}
        </button>
        {text && (
          <>
            <button
              type="button"
              onClick={() =>
                openInObsidian({
                  title: `Briefing ${todayKey}`,
                  content: `# Briefing ${todayKey}\n\n${text}`,
                  vault: obsidianVault,
                })
              }
              title="Salvar briefing no Obsidian"
              className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
            >
              📓 Obsidian
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="btn spring-btn min-h-8 px-2.5 py-1 text-xs text-mute"
            >
              {collapsed ? "Mostrar" : "Ocultar"}
            </button>
          </>
        )}
      </div>
      {error && <p className="m-0 text-xs" style={{ color: "var(--red-fg)" }}>{error}</p>}
      {text && !collapsed && (
        <div className="rounded-2xl border border-primary/25 bg-primary-soft/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
          <p className="m-0 whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </div>
  );
}
