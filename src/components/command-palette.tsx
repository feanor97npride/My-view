"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Command = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  run: () => void;
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      { id: "hoje", label: "Ir para Hoje", group: "Navegação", keywords: "inicio cockpit agenda tarefas", run: () => router.push("/") },
      { id: "semana", label: "Ir para Semana", group: "Navegação", keywords: "calendario carga dias", run: () => router.push("/semana") },
      { id: "emails", label: "Ir para E-mails", group: "Navegação", keywords: "triagem inbox gmail", run: () => router.push("/emails") },
      { id: "emails-acao", label: "E-mails: Fila Ação", group: "E-mails", keywords: "urgente responder", run: () => router.push("/emails?categoria=acao") },
      { id: "emails-fin", label: "E-mails: Fila Financeiro", group: "E-mails", keywords: "boletos contas pagar", run: () => router.push("/emails?categoria=financeiro") },
      { id: "indicadores", label: "Ir para Indicadores", group: "Navegação", keywords: "metricas grafico saude", run: () => router.push("/indicadores") },
      { id: "config", label: "Ir para Configurações", group: "Navegação", keywords: "preferencias regras clickup", run: () => router.push("/configuracoes") },
      {
        id: "tema",
        label: "Alternar tema Claro / Escuro",
        group: "Interface",
        keywords: "dark light mode aparencia",
        run: () => {
          const root = document.documentElement;
          const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
          if (next === "dark") root.setAttribute("data-theme", "dark");
          else root.removeAttribute("data-theme");
          try {
            localStorage.setItem("theme", next);
          } catch {
            // ignore storage errors
          }
        },
      },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q) || (c.keywords?.includes(q) ?? false),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const pick = (cmd: Command) => {
    setOpen(false);
    cmd.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="toast-enter w-full max-w-lg overflow-hidden rounded-[22px] border border-line-strong bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-mute" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => (filtered.length ? (i + 1) % filtered.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
              } else if (e.key === "Enter" && filtered[idx]) {
                e.preventDefault();
                pick(filtered[idx]);
              }
            }}
            placeholder="Ir para tela, fila de e-mail ou ação…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-mute"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-mute">ESC</kbd>
        </div>

        <ul className="m-0 max-h-72 list-none overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-mute">Nenhum comando encontrado.</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  onClick={() => pick(cmd)}
                  onMouseEnter={() => setIdx(i)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    i === idx ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink hover:bg-primary-soft/50"
                  }`}
                >
                  <span>{cmd.label}</span>
                  <span className="text-[11px] font-normal text-mute">{cmd.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
