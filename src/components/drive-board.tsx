"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionToast, BentoCard, type ToastAction } from "@/components/ui";
import VoiceInputButton from "@/components/voice-input-button";
import { driveTypeLabel, type DriveFile, type DriveTypeFilter } from "@/lib/drive";

const TYPE_OPTIONS: { id: DriveTypeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "doc", label: "Docs" },
  { id: "sheet", label: "Planilhas" },
  { id: "slide", label: "Slides" },
  { id: "pdf", label: "PDFs" },
  { id: "folder", label: "Pastas" },
];

export default function DriveBoard({
  initialFiles,
  initialScopeMissing,
  initialError,
  reconnectAction,
}: {
  initialFiles: DriveFile[];
  initialScopeMissing: boolean;
  initialError: string | null;
  reconnectAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<DriveFile[]>(initialFiles);
  const [scopeMissing, setScopeMissing] = useState(initialScopeMissing);
  const [error, setError] = useState<string | null>(initialError);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DriveTypeFilter>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newDocTitle, setNewDocTitle] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastAction | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (label: string, undo?: () => void | Promise<void>, undoLabel = "Fechar") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ label, undo: undo ?? (() => {}), undoLabel });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const fetchFiles = async (nextQ: string, nextType: DriveTypeFilter, nextStarred: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextType !== "all") params.set("type", nextType);
      if (nextStarred) params.set("starred", "1");
      const res = await fetch(`/api/drive?${params}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { files?: DriveFile[]; error?: string; scopeMissing?: boolean };
      if (j.scopeMissing || j.error === "DRIVE_SCOPE_MISSING") {
        setScopeMissing(true);
        return;
      }
      if (!res.ok) {
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setScopeMissing(false);
      setFiles(j.files ?? []);
    } catch {
      setError("Falha de conexão ao consultar o Google Drive.");
    } finally {
      setLoading(false);
    }
  };

  const createDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newDocTitle.trim();
    if (!title || creatingDoc) return;
    setCreatingDoc(true);
    setError(null);
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: `Documento criado pelo My View em ${new Date().toLocaleDateString("pt-BR")}.\n` }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string; webViewLink?: string; error?: string; scopeMissing?: boolean };
      if (j.scopeMissing) {
        setScopeMissing(true);
        return;
      }
      if (!res.ok) {
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      setNewDocTitle("");
      showToast("Documento criado no Google Drive");
      await fetchFiles(query, type, starredOnly);
      if (j.webViewLink) {
        window.open(j.webViewLink, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Falha ao criar documento no Google Drive.");
    } finally {
      setCreatingDoc(false);
    }
  };

  const createTaskFromFile = async (f: DriveFile) => {
    if (busyTaskIds.has(f.id)) return;
    setBusyTaskIds((s) => new Set(s).add(f.id));
    try {
      const res = await fetch("/api/tasks/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: `Revisar: ${f.name.slice(0, 150)}`,
          due: "today",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Erro ${res.status}`);
        return;
      }
      showToast("Tarefa criada no ClickUp para hoje");
      router.refresh();
    } catch {
      setError("Falha ao criar tarefa.");
    } finally {
      setBusyTaskIds((s) => {
        const n = new Set(s);
        n.delete(f.id);
        return n;
      });
    }
  };

  if (scopeMissing) {
    return (
      <BentoCard className="flex flex-col items-start gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Autorize o acesso ao Google Drive</h2>
        <p className="m-0 text-sm text-mute">
          Sua sessão Google atual ainda não tem permissão para listar e criar arquivos no Google Drive. Clique abaixo para reconectar sua conta com os novos escopos do Drive.
        </p>
        <form action={reconnectAction}>
          <button type="submit" className="btn btn-primary spring-btn">
            Reconectar Google para liberar o Drive →
          </button>
        </form>
      </BentoCard>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Criar Google Doc + Busca/Filtros */}
      <BentoCard className="flex flex-col gap-3 !py-4">
        <form onSubmit={createDoc} className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-1.5 sm:w-auto sm:min-w-[240px] sm:flex-1">
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="+ Criar novo Google Doc no Drive…"
              required
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3.5 text-sm text-ink outline-none focus:border-primary"
            />
            <VoiceInputButton
              title="Ditar título do documento"
              disabled={creatingDoc}
              onTranscript={(spoken) => setNewDocTitle((p) => (p.trim() ? `${p.trim()} ${spoken}` : spoken))}
              onError={(msg) => setError(msg)}
              className="min-h-10 shrink-0 px-3 text-sm"
            />
          </div>
          <button type="submit" disabled={creatingDoc || !newDocTitle.trim()} className="btn btn-primary spring-btn min-h-10 w-full px-4 text-xs disabled:opacity-50 sm:w-auto">
            {creatingDoc ? "Criando…" : "+ Novo Google Doc"}
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchFiles(query, type, starredOnly);
          }}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"
        >
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
            <div className="flex w-full items-center gap-1.5 sm:w-72">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar no Google Drive…"
                className="min-h-9 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-3 text-xs text-ink outline-none focus:border-primary"
              />
              <VoiceInputButton
                title="Buscar no Drive por voz"
                onTranscript={(spoken) => {
                  setQuery(spoken);
                  void fetchFiles(spoken, type, starredOnly);
                }}
                className="min-h-9 shrink-0 px-2.5 text-xs"
              />
            </div>
            <button type="submit" disabled={loading} className="btn spring-btn min-h-9 px-3 text-xs">
              {loading ? "Buscando…" : "Buscar"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !starredOnly;
                setStarredOnly(next);
                void fetchFiles(query, type, next);
              }}
              aria-pressed={starredOnly}
              className={`btn spring-btn min-h-9 px-3 text-xs ${starredOnly ? "border-primary bg-primary-soft text-primary-ink" : ""}`}
            >
              ⭐ Favoritos
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setType(opt.id);
                  void fetchFiles(query, opt.id, starredOnly);
                }}
                className={`chip cursor-pointer border text-xs ${
                  type === opt.id ? "chip-primary border-primary" : "border-line bg-bg text-mute"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </form>
      </BentoCard>

      {error && (
        <p role="alert" className="chip chip-red m-0 w-fit whitespace-normal rounded-xl px-4 py-2.5 text-sm">
          {error}
        </p>
      )}

      {files.length === 0 ? (
        <BentoCard>
          <p className="m-0 text-sm text-mute">
            {loading ? "Carregando arquivos do Drive…" : "Nenhum arquivo encontrado para os filtros atuais."}
          </p>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => {
            const badge = driveTypeLabel(f.mimeType);
            const dateStr = f.modifiedTime
              ? new Date(f.modifiedTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
              : "";
            return (
              <article key={f.id} className="card flex flex-col justify-between gap-3 transition-colors hover:border-line-strong">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 break-words font-semibold text-ink no-underline hover:text-primary hover:underline"
                    >
                      {f.starred ? "⭐ " : ""}
                      {f.name}
                    </a>
                    <span className={`chip ${badge.chip} shrink-0 px-2 py-0.5 text-[10px]`}>{badge.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                    <span className="truncate">{f.owner}</span>
                    {dateStr && (
                      <>
                        <span>·</span>
                        <span>{dateStr}</span>
                      </>
                    )}
                    {f.sizeLabel && (
                      <>
                        <span>·</span>
                        <span>{f.sizeLabel}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={f.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary spring-btn min-h-8 px-3 py-1 text-xs no-underline"
                  >
                    Abrir no Drive
                  </a>
                  <button
                    type="button"
                    disabled={busyTaskIds.has(f.id)}
                    onClick={() => void createTaskFromFile(f)}
                    className="btn spring-btn min-h-8 px-2.5 py-1 text-xs disabled:opacity-50"
                  >
                    + Tarefa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(f.webViewLink).then(() => showToast("Link copiado!"));
                    }}
                    className="btn spring-btn min-h-8 px-2.5 py-1 text-xs"
                  >
                    Copiar link
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ActionToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
