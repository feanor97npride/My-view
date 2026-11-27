"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BentoCard, SectionHeader } from "@/components/ui";
import { decodeEntities } from "@/lib/email-view";
import type { NewsletterItem } from "@/lib/newsletter";
import { speakPtBr, stopSpeaking } from "@/lib/voice";

export default function NewsletterPlayer({
  items,
  rules = [],
  mode = "full",
}: {
  items: NewsletterItem[];
  rules?: string[];
  mode?: "compact" | "full";
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<"full" | "summary" | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingKind, setLoadingKind] = useState<"full" | "summary" | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rule management state (full mode)
  const [ruleList, setRuleList] = useState<string[]>(rules);
  const [newRule, setNewRule] = useState("");
  const [savingRules, setSavingRules] = useState(false);

  const cancelledRef = useRef(false);

  useEffect(() => {
    setRuleList(rules);
  }, [rules]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeaking();
    };
  }, []);

  const stopAll = () => {
    cancelledRef.current = true;
    stopSpeaking();
    setActiveId(null);
    setActiveKind(null);
    setLoadingId(null);
    setLoadingKind(null);
    setPlayingAll(false);
  };

  const fetchFullText = async (item: NewsletterItem): Promise<string> => {
    if (bodies[item.id]) return bodies[item.id];
    const res = await fetch("/api/emails/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "body", messageId: item.id }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
    if (!res.ok || !j.ok) throw new Error(j.error ?? `Erro ${res.status}`);
    const text = (j.text ?? "").trim() || decodeEntities(item.snippet);
    setBodies((prev) => ({ ...prev, [item.id]: text }));
    return text;
  };

  const fetchSummary = async (item: NewsletterItem): Promise<string> => {
    if (summaries[item.id]) return summaries[item.id];
    const res = await fetch("/api/emails/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "summary", messageId: item.id, subject: item.subject }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; summary?: string; text?: string; error?: string };
    if (!res.ok || !j.ok || !j.summary) throw new Error(j.error ?? `Erro ${res.status}`);
    setSummaries((prev) => ({ ...prev, [item.id]: j.summary! }));
    if (j.text) setBodies((prev) => ({ ...prev, [item.id]: j.text! }));
    return j.summary;
  };

  const playOne = async (item: NewsletterItem, kind: "full" | "summary") => {
    if (activeId === item.id && activeKind === kind) {
      stopAll();
      return;
    }
    stopAll();
    cancelledRef.current = false;
    setError(null);
    setLoadingId(item.id);
    setLoadingKind(kind);

    try {
      const content = kind === "summary" ? await fetchSummary(item) : await fetchFullText(item);
      if (cancelledRef.current) return;
      const script = kind === "summary"
        ? `Resumo rápido de ${item.subject}. ${content}`
        : `${item.subject}. ${content}`;

      setActiveId(item.id);
      setActiveKind(kind);
      speakPtBr(script, {
        onReady: () => {
          if (!cancelledRef.current) {
            setLoadingId(null);
            setLoadingKind(null);
          }
        },
        onEnd: () => {
          if (!cancelledRef.current) {
            setActiveId(null);
            setActiveKind(null);
            setLoadingId(null);
            setLoadingKind(null);
          }
        },
      });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Falha ao carregar áudio.");
        setLoadingId(null);
        setLoadingKind(null);
      }
    }
  };

  const playAllSequential = async () => {
    if (playingAll) {
      stopAll();
      return;
    }
    const visible = mode === "compact" ? items.slice(0, 4) : items;
    if (visible.length === 0) return;

    stopAll();
    cancelledRef.current = false;
    setError(null);
    setPlayingAll(true);

    const runIndex = async (idx: number) => {
      if (cancelledRef.current || idx >= visible.length) {
        if (!cancelledRef.current) {
          setPlayingAll(false);
          setActiveId(null);
          setActiveKind(null);
          setLoadingId(null);
          setLoadingKind(null);
        }
        return;
      }
      const item = visible[idx];
      setLoadingId(item.id);
      setLoadingKind("full");
      try {
        const text = await fetchFullText(item);
        if (cancelledRef.current) return;
        setActiveId(item.id);
        setActiveKind("full");
        speakPtBr(`${item.subject}. ${text}`, {
          onReady: () => {
            if (!cancelledRef.current) {
              setLoadingId(null);
              setLoadingKind(null);
            }
          },
          onEnd: () => {
            if (!cancelledRef.current) {
              void runIndex(idx + 1);
            }
          },
        });
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "Falha ao reproduzir fila.");
          setPlayingAll(false);
          setLoadingId(null);
          setLoadingKind(null);
        }
      }
    };

    void runIndex(0);
  };

  const saveRules = async (next: string[]) => {
    setSavingRules(true);
    setError(null);
    try {
      const res = await fetch("/api/emails/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rules", rules: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; rules?: string[]; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? `Erro ${res.status}`);
      setRuleList(j.rules ?? next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar filtros.");
    } finally {
      setSavingRules(false);
    }
  };

  const addRule = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newRule.trim();
    if (!val) return;
    setNewRule("");
    void saveRules([...ruleList, val]);
  };

  const removeRule = (target: string) => {
    void saveRules(ruleList.filter((r) => r !== target));
  };

  const visibleItems = mode === "compact" ? items.slice(0, 4) : items;

  return (
    <div className="flex flex-col gap-4">
      <BentoCard className="flex flex-col gap-4">
        <SectionHeader
          title={mode === "compact" ? "Newsletters em áudio" : "Resumos e Newsletters (últimos 7 dias)"}
          subtitle={
            mode === "compact"
              ? "Seus resumos diários (IA, Geopolítica e outros) prontos para ouvir."
              : "Clique em Ouvir completo para escutar o texto integral sob demanda ou gere um Resumo rápido de 30s com IA."
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {visibleItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => void playAllSequential()}
                  className={`btn spring-btn min-h-9 px-3 py-1 text-xs ${
                    playingAll ? "border-primary bg-primary-soft text-primary-ink" : "btn-primary"
                  }`}
                >
                  {playingAll ? "⏹ Parar fila" : `▶ Ouvir todos (${visibleItems.length})`}
                </button>
              )}
              {mode === "compact" && (
                <Link href="/newsletters" className="btn spring-btn min-h-9 px-3 py-1 text-xs no-underline">
                  Histórico (7d)
                </Link>
              )}
            </div>
          }
        />

        {error && (
          <div role="alert" className="chip-red flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="btn min-h-7 px-2 py-0.5 text-[11px]">
              Fechar
            </button>
          </div>
        )}

        {visibleItems.length === 0 ? (
          <p className="m-0 text-sm text-mute">
            Nenhuma newsletter encontrada nos últimos e-mails sincronizados para os termos atuais.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {visibleItems.map((item) => {
              const isPlayingFull = activeId === item.id && activeKind === "full";
              const isPlayingSummary = activeId === item.id && activeKind === "summary";
              const isLoadingFull = loadingId === item.id && loadingKind === "full";
              const isLoadingSummary = loadingId === item.id && loadingKind === "summary";
              const summaryText = summaries[item.id];
              const bodyText = bodies[item.id];

              return (
                <li
                  key={item.id}
                  className={`kpi-tile flex flex-col gap-2.5 p-3.5 ${
                    activeId === item.id ? "border-primary bg-primary-soft/35" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                        {item.unread && <span className="live-dot" title="Não lido" aria-label="Não lido" />}
                        <span className="font-medium text-ink">{item.sender}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] tabular-nums">{item.when}</span>
                      </div>
                      <h3 className="m-0 mt-1 font-display text-sm font-semibold text-ink sm:text-base">
                        {item.subject}
                      </h3>
                      {mode === "full" && item.snippet && (
                        <p className="m-0 mt-1 line-clamp-2 text-xs text-mute">{decodeEntities(item.snippet)}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void playOne(item, "full")}
                        disabled={isLoadingFull}
                        className={`btn spring-btn min-h-9 px-3 py-1 text-xs ${
                          isPlayingFull ? "border-primary bg-primary-soft text-primary-ink" : "btn-primary"
                        }`}
                      >
                        {isLoadingFull ? "⏳ Carregando…" : isPlayingFull ? "⏹ Parar" : "🔊 Ouvir completo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void playOne(item, "summary")}
                        disabled={isLoadingSummary}
                        className={`btn spring-btn min-h-9 px-3 py-1 text-xs ${
                          isPlayingSummary ? "border-primary bg-primary-soft text-primary-ink" : ""
                        }`}
                      >
                        {isLoadingSummary ? "⏳ Resumindo…" : isPlayingSummary ? "⏹ Parar" : "✨ Resumo 30s"}
                      </button>
                      {bodyText && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="btn spring-btn min-h-9 px-2.5 py-1 text-xs"
                        >
                          {expandedId === item.id ? "Ocultar texto" : "Ler texto"}
                        </button>
                      )}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn spring-btn min-h-9 px-2.5 py-1 text-xs no-underline"
                      >
                        Gmail
                      </a>
                    </div>
                  </div>

                  {summaryText && (
                    <div className="rounded-xl border border-line bg-card px-3 py-2.5 text-xs leading-relaxed text-ink">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                        [ Resumo rápido IA ]
                      </span>
                      <p className="m-0 mt-1">{summaryText}</p>
                    </div>
                  )}

                  {expandedId === item.id && bodyText && (
                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-card px-3 py-2.5 text-xs leading-relaxed text-mute">
                      {bodyText}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </BentoCard>

      {mode === "full" && (
        <BentoCard className="flex flex-col gap-3">
          <SectionHeader
            title="E-mails monitorados como Newsletter"
            subtitle="Qualquer e-mail cujo assunto ou remetente contenha um destes termos aparece aqui e na Home."
          />
          <div className="flex flex-wrap gap-2">
            {ruleList.map((rule) => (
              <span key={rule} className="chip chip-blue inline-flex items-center gap-1.5">
                <span>{rule}</span>
                <button
                  type="button"
                  disabled={savingRules}
                  onClick={() => removeRule(rule)}
                  aria-label={`Remover ${rule}`}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-current opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={addRule} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Ex.: resumo diario de noticias de ia, morning brew, newsletter@..."
              className="min-h-10 min-w-[240px] flex-1 rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink"
            />
            <button type="submit" disabled={savingRules || !newRule.trim()} className="btn btn-primary spring-btn min-h-10 text-sm disabled:opacity-60">
              {savingRules ? "Salvando…" : "+ Adicionar"}
            </button>
          </form>
        </BentoCard>
      )}
    </div>
  );
}
