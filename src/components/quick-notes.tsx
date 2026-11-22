"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BentoCard } from "@/components/ui";
import VoiceInputButton from "@/components/voice-input-button";
import { openInObsidian } from "@/lib/obsidian";

export default function QuickNotes({ initialText, obsidianVault }: { initialText: string; obsidianVault?: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [creating, setCreating] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const save = async (next: string) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  };

  const onChange = (next: string) => {
    setText(next);
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(next), 600);
  };

  const turnIntoTask = async () => {
    const el = areaRef.current;
    const selected = el && el.selectionStart !== el.selectionEnd ? text.slice(el.selectionStart, el.selectionEnd).trim() : "";
    const line = selected || text.split("\n").map((l) => l.trim()).find(Boolean) || "";
    if (!line || creating) return;
    setCreating(true);
    setTaskMsg(null);
    try {
      const res = await fetch("/api/tasks/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: line.slice(0, 200), due: "today" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setTaskMsg(j.error ?? `Erro ${res.status}`);
        return;
      }
      setTaskMsg(`Tarefa criada para hoje: "${line.slice(0, 40)}${line.length > 40 ? "…" : ""}"`);
      router.refresh();
    } catch {
      setTaskMsg("Falha de conexão ao criar tarefa.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <BentoCard aria-label="Notas rápidas" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Notas rápidas</h2>
          <p className="m-0 text-[12px] text-mute">
            {status === "saving"
              ? "Salvando…"
              : status === "saved"
                ? "Salvo nesta conta"
                : status === "error"
                  ? "Erro ao salvar"
                  : "Rascunho privado desta conta"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <VoiceInputButton
            label="Ditar"
            title="Ditar nota por voz"
            onTranscript={(spoken) => {
              setTaskMsg(null);
              const next = text.trim() ? `${text.trimEnd()}\n${spoken}` : spoken;
              onChange(next);
            }}
            onError={(msg) => setTaskMsg(msg)}
            className="min-h-8 px-2.5 py-1 text-xs"
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() =>
              openInObsidian({
                title: `Notas ${new Date().toISOString().slice(0, 10)}`,
                content: text,
                vault: obsidianVault,
              })
            }
            title="Enviar notas para o Obsidian"
            className="btn spring-btn min-h-8 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            📓 Obsidian
          </button>
          <button
            type="button"
            onClick={turnIntoTask}
            disabled={creating || !text.trim()}
            title="Cria tarefa no ClickUp para hoje com o trecho selecionado ou a primeira linha"
            className="btn spring-btn min-h-8 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            {creating ? "Criando…" : "+ Virar tarefa"}
          </button>
        </div>
      </div>
      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Anote lembretes rápidos, links ou ideias do dia… (selecione uma linha e clique em + Virar tarefa)"
        className="w-full resize-y rounded-2xl border border-line bg-bg p-3 text-sm text-ink outline-none transition-colors placeholder:text-mute focus:border-primary"
      />
      {taskMsg && <p className="m-0 text-xs text-mute">{taskMsg}</p>}
    </BentoCard>
  );
}
