"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BentoCard } from "@/components/ui";
import type { GithubRepoView } from "@/lib/github";

function relTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return "agora";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function runBadge(run: GithubRepoView["lastRun"]): { label: string; tone: string } {
  if (!run) return { label: "Sem CI", tone: "chip-slate" };
  if (run.status === "in_progress" || run.status === "queued") {
    return { label: "● Rodando", tone: "chip-amber" };
  }
  if (run.conclusion === "success") return { label: "✓ CI OK", tone: "chip-green" };
  if (run.conclusion === "failure" || run.conclusion === "timed_out") {
    return { label: "✕ Falhou", tone: "chip-red" };
  }
  return { label: run.conclusion ?? run.status, tone: "chip-slate" };
}

export default function GithubLiveBoard({
  initialConfigured,
  initialRepos,
  initialFetchedAt,
  initialError,
}: {
  initialConfigured: boolean;
  initialRepos: GithubRepoView[];
  initialFetchedAt: string;
  initialError?: string;
}) {
  const [configured, setConfigured] = useState(initialConfigured);
  const [repos, setRepos] = useState<GithubRepoView[]>(initialRepos);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [error, setError] = useState<string | undefined>(initialError);
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [visFilter, setVisFilter] = useState<"all" | "private" | "public">("all");

  const refresh = useCallback(async (fresh = true) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/github/repos${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as {
        configured: boolean;
        repos: GithubRepoView[];
        fetchedAt: string;
        error?: string;
      };
      setConfigured(d.configured);
      setRepos(d.repos ?? []);
      setFetchedAt(d.fetchedAt);
      setError(d.error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!configured || !live) return;
    const id = setInterval(() => {
      void refresh(true);
    }, 30_000);
    return () => clearInterval(id);
  }, [configured, live, refresh]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return repos.filter((r) => {
      if (visFilter === "private" && !r.private) return false;
      if (visFilter === "public" && r.private) return false;
      if (!query) return true;
      return (
        r.fullName.toLowerCase().includes(query) ||
        (r.description?.toLowerCase().includes(query) ?? false) ||
        (r.language?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [repos, q, visFilter]);

  if (!configured) {
    return (
      <BentoCard className="flex flex-col items-start gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Conecte seu GitHub</h2>
        <p className="m-0 text-sm text-mute">
          Adicione seu token pessoal do GitHub (<code className="text-xs">ghp_...</code> ou fine-grained PAT) para acompanhar seus repositórios, últimos commits e status de CI/Actions ao vivo.
        </p>
        <Link href="/configuracoes?aba=clickup" className="btn btn-primary spring-btn no-underline">
          Configurar token em Configurações →
        </Link>
      </BentoCard>
    );
  }

  const runningCount = repos.filter((r) => r.lastRun && (r.lastRun.status === "in_progress" || r.lastRun.status === "queued")).length;
  const failedCount = repos.filter((r) => r.lastRun?.conclusion === "failure").length;
  const prsCount = repos.reduce((s, r) => s + (r.openPrs?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de controles + KPIs ao vivo */}
      <BentoCard className="flex flex-wrap items-center justify-between gap-4 !py-4">
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
          <div className="rounded-xl border border-line bg-bg px-3.5 py-2">
            <div className="text-[11px] text-mute">Repositórios</div>
            <div className="font-display text-xl font-bold tabular-nums">{repos.length}</div>
          </div>
          <div className="rounded-xl border border-line bg-bg px-3.5 py-2">
            <div className="text-[11px] text-mute">CI rodando</div>
            <div className="font-display text-xl font-bold tabular-nums" style={runningCount > 0 ? { color: "var(--amber-fg)" } : undefined}>
              {runningCount}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-bg px-3.5 py-2">
            <div className="text-[11px] text-mute">CI com falha</div>
            <div className="font-display text-xl font-bold tabular-nums" style={failedCount > 0 ? { color: "var(--red-fg)" } : undefined}>
              {failedCount}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-bg px-3.5 py-2">
            <div className="text-[11px] text-mute">PRs abertos</div>
            <div className="font-display text-xl font-bold tabular-nums text-primary">{prsCount}</div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar repo ou linguagem…"
            className="min-h-9 w-full rounded-xl border border-line-strong bg-bg px-3 text-xs text-ink outline-none focus:border-primary sm:w-52"
          />
          <select
            aria-label="Visibilidade"
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value as "all" | "private" | "public")}
            className="min-h-9 rounded-xl border border-line-strong bg-bg px-2.5 text-xs text-ink"
          >
            <option value="all">Todos</option>
            <option value="private">Privados</option>
            <option value="public">Públicos</option>
          </select>
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={`btn spring-btn min-h-9 px-3 py-1 text-xs ${live ? "border-primary bg-primary-soft text-primary-ink" : ""}`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
            {live ? "Live 30s" : "Pausado"}
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh(true)}
            className="btn btn-primary spring-btn min-h-9 px-3 py-1 text-xs disabled:opacity-60"
          >
            {refreshing ? "Atualizando…" : "↻ Atualizar"}
          </button>
        </div>
      </BentoCard>

      {error && (
        <div role="alert" className="chip chip-red rounded-2xl px-4 py-3 text-sm">
          Erro ao consultar GitHub: {error}
        </div>
      )}

      <p className="m-0 text-xs text-mute">
        Última atualização: {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>

      {/* Grade de repositórios */}
      {filtered.length === 0 ? (
        <BentoCard>
          <p className="m-0 text-sm text-mute">Nenhum repositório encontrado.</p>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const ci = runBadge(r.lastRun);
            return (
              <BentoCard key={r.id} as="article" className="flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-display text-lg font-bold text-ink no-underline hover:text-primary hover:underline"
                      >
                        {r.name}
                      </a>
                      <span className="text-[11px] text-mute">{r.fullName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`chip ${ci.tone} px-2 py-0.5 text-[11px]`}>{ci.label}</span>
                      <span className={`chip ${r.private ? "chip-slate" : "chip-blue"} px-2 py-0.5 text-[10px]`}>
                        {r.private ? "Privado" : "Público"}
                      </span>
                    </div>
                  </div>

                  {r.description && (
                    <p className="m-0 line-clamp-2 text-xs text-mute">{r.description}</p>
                  )}

                  {r.lastCommit && (
                    <a
                      href={r.lastCommit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-line bg-bg px-3 py-2 text-xs text-ink no-underline transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-mute">
                        <span className="font-mono font-semibold text-primary">{r.lastCommit.sha}</span>
                        <span>{relTime(r.lastCommit.date)}</span>
                      </div>
                      <div className="mt-0.5 truncate font-medium">{r.lastCommit.message}</div>
                    </a>
                  )}

                  {r.openPrs && r.openPrs.length > 0 && (
                    <div className="flex flex-col gap-1 pt-0.5">
                      {r.openPrs.map((pr) => (
                        <a
                          key={pr.number}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg bg-primary-soft/60 px-2.5 py-1.5 text-xs text-ink no-underline hover:bg-primary-soft"
                        >
                          <span className="chip chip-primary shrink-0 px-1.5 py-0 text-[10px]">
                            PR #{pr.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{pr.title}</span>
                          {pr.draft && <span className="text-[10px] text-mute">Draft</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-mute">
                  <div className="flex items-center gap-2.5">
                    {r.language && <span className="font-semibold text-ink">{r.language}</span>}
                    <span>⎇ {r.defaultBranch}</span>
                    {r.openIssues > 0 && <span>• {r.openIssues} abertos</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {r.deployUrl && (
                      <a href={r.deployUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                        🚀 Deploy ↗
                      </a>
                    )}
                    {r.lastRun && (
                      <a href={r.lastRun.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                        Actions ↗
                      </a>
                    )}
                    <a href={`${r.url}/commits`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                      Commits ↗
                    </a>
                  </div>
                </div>
              </BentoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
