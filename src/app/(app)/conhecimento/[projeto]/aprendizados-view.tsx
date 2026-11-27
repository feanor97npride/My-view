"use client";

import { useEffect, useMemo, useState } from "react";
import { BentoCard, SectionHeader } from "@/components/ui";
import {
  FASES_SUGERIDAS,
  IMPACTOS,
  TEMAS_SUGERIDOS,
  TIPOS,
  type Entrada,
  type Impacto,
  type Licao,
  type Semana,
  type Tipo,
} from "@/lib/kb-model";

const TIPO_CHIP: Record<Tipo, string> = {
  decisao: "chip-blue",
  "mudanca-rota": "chip-violet",
  retrabalho: "chip-amber",
  erro: "chip-red",
  risco: "chip-pink",
  "boa-pratica": "chip-green",
};

const IMPACTO_CHIP: Record<Impacto, string> = {
  alto: "chip-red",
  medio: "chip-amber",
  baixo: "chip-green",
};

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatBrDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export default function AprendizadosView({
  entradas,
  semanas,
  top3,
}: {
  entradas: Entrada[];
  semanas: Semana[];
  top3: Licao[];
}) {
  const [q, setQ] = useState("");
  const [tema, setTema] = useState("");
  const [fase, setFase] = useState("");
  const [impacto, setImpacto] = useState("");
  const [tipo, setTipo] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Read initial filters from URL query string on mount.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp.get("q") ?? "");
    setTema(sp.get("tema") ?? "");
    setFase(sp.get("fase") ?? "");
    setImpacto(sp.get("impacto") ?? "");
    setTipo(sp.get("tipo") ?? "");
    setHydrated(true);
  }, []);

  // Keep URL query parameters synchronized without triggering navigation.
  useEffect(() => {
    if (!hydrated) return;
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (tema) sp.set("tema", tema);
    if (fase) sp.set("fase", fase);
    if (impacto) sp.set("impacto", impacto);
    if (tipo) sp.set("tipo", tipo);
    const qs = sp.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [hydrated, q, tema, fase, impacto, tipo]);

  const titleById = useMemo(() => new Map(entradas.map((e) => [e.id, e.titulo])), [entradas]);

  const temasDisponiveis = useMemo(() => {
    const set = new Set<string>([...TEMAS_SUGERIDOS, ...entradas.map((e) => e.tema)]);
    return [...set];
  }, [entradas]);

  const fasesDisponiveis = useMemo(() => {
    const set = new Set<string>([...FASES_SUGERIDAS, ...entradas.map((e) => e.fase)]);
    return [...set];
  }, [entradas]);

  const hasFilter = Boolean(q.trim() || tema || fase || impacto || tipo);

  const filtradas = useMemo(() => {
    const qNorm = normText(q.trim());
    return entradas.filter((e) => {
      if (tema && e.tema !== tema) return false;
      if (fase && e.fase !== fase) return false;
      if (impacto && e.impacto !== impacto) return false;
      if (tipo && e.tipo !== tipo) return false;
      if (qNorm) {
        const hay = normText(
          [
            e.titulo,
            e.acontecimento,
            e.contexto,
            e.acao,
            e.antecipacao,
            e.aprendizado,
            e.contorno,
            e.tema,
            e.fase,
            TIPOS[e.tipo],
            IMPACTOS[e.impacto],
            e.fonte ?? "",
          ].join(" "),
        );
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });
  }, [entradas, q, tema, fase, impacto, tipo]);

  const filtradasById = useMemo(() => new Map(filtradas.map((e) => [e.id, e])), [filtradas]);

  const semanasOrdenadas = useMemo(
    () => [...semanas].sort((a, b) => b.semana.localeCompare(a.semana)),
    [semanas],
  );

  const impactoAlto = useMemo(() => entradas.filter((e) => e.impacto === "alto").length, [entradas]);
  const impactoMedio = useMemo(() => entradas.filter((e) => e.impacto === "medio").length, [entradas]);

  const limparFiltros = () => {
    setQ("");
    setTema("");
    setFase("");
    setImpacto("");
    setTipo("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 4 indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoCard as="div" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-mute">Registros</span>
          <span className="font-display text-3xl font-bold tabular-nums text-ink">{entradas.length}</span>
        </BentoCard>
        <BentoCard as="div" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-mute">Impacto alto</span>
          <span className="font-display text-3xl font-bold tabular-nums" style={{ color: "var(--red-fg)" }}>
            {impactoAlto}
          </span>
        </BentoCard>
        <BentoCard as="div" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-mute">Impacto médio</span>
          <span className="font-display text-3xl font-bold tabular-nums" style={{ color: "var(--amber-fg)" }}>
            {impactoMedio}
          </span>
        </BentoCard>
        <BentoCard as="div" className="flex flex-col gap-1">
          <span className="text-xs font-medium text-mute">Semanas consolidadas</span>
          <span className="font-display text-3xl font-bold tabular-nums text-ink">{semanas.length}</span>
        </BentoCard>
      </section>

      {/* Top 3 lições */}
      {top3.length > 0 && (
        <BentoCard className="flex flex-col gap-4">
          <SectionHeader
            title="Top 3 lições para os próximos projetos"
            subtitle="Síntese priorizada a partir de todos os registros consolidados."
          />
          <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
            {top3.slice(0, 3).map((item, idx) => {
              const origens = item.baseadoEm
                .map((id) => titleById.get(id))
                .filter((t): t is string => Boolean(t));
              return (
                <li
                  key={`${idx}-${item.licao}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-bg p-4"
                >
                  <div className="flex flex-col gap-2">
                    <span className="chip chip-violet w-fit tabular-nums">#{idx + 1}</span>
                    <p className="m-0 text-sm font-medium leading-relaxed text-ink">{item.licao}</p>
                  </div>
                  {origens.length > 0 && (
                    <p className="m-0 border-t border-line pt-2 text-xs text-mute">
                      <strong className="font-semibold text-ink">Base:</strong> {origens.join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </BentoCard>
      )}

      {/* Filtros */}
      <BentoCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink tabular-nums">
            {filtradas.length} de {entradas.length} registros
          </span>
          {hasFilter && (
            <button type="button" onClick={limparFiltros} className="btn spring-btn min-h-9 px-3 py-1 text-xs">
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs text-mute lg:col-span-2">
            Busca
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar em título, aprendizado, ação, contorno..."
              className="min-h-10 rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-mute">
            Tema
            <select
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              className="min-h-10 rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink"
            >
              <option value="">Todos os temas</option>
              {temasDisponiveis.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-mute">
            Fase
            <select
              value={fase}
              onChange={(e) => setFase(e.target.value)}
              className="min-h-10 rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink"
            >
              <option value="">Todas as fases</option>
              {fasesDisponiveis.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-mute">
              Impacto
              <select
                value={impacto}
                onChange={(e) => setImpacto(e.target.value)}
                className="min-h-10 rounded-xl border border-line-strong bg-bg px-2.5 text-sm text-ink"
              >
                <option value="">Todos</option>
                {(Object.keys(IMPACTOS) as Impacto[]).map((k) => (
                  <option key={k} value={k}>{IMPACTOS[k]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-mute">
              Tipo
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="min-h-10 rounded-xl border border-line-strong bg-bg px-2.5 text-sm text-ink"
              >
                <option value="">Todos</option>
                {(Object.keys(TIPOS) as Tipo[]).map((k) => (
                  <option key={k} value={k}>{TIPOS[k]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </BentoCard>

      {/* Semanas */}
      <div className="flex flex-col gap-5">
        {semanasOrdenadas.map((sem) => {
          const itensSemana = sem.entradas
            .map((id) => filtradasById.get(id))
            .filter((e): e is Entrada => Boolean(e));

          if (hasFilter && itensSemana.length === 0) {
            return null;
          }

          return (
            <BentoCard key={`${sem.projeto}-${sem.semana}`} className="flex flex-col gap-4">
              <SectionHeader
                title={`Semana de ${formatBrDate(sem.semana)}`}
                subtitle={sem.resumo || "Sem eventos relevantes"}
                action={
                  <span className="chip chip-slate tabular-nums">
                    {itensSemana.length} {itensSemana.length === 1 ? "registro" : "registros"}
                  </span>
                }
              />

              {itensSemana.length === 0 ? (
                <p className="m-0 text-sm text-mute">Sem eventos relevantes nesta semana.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {itensSemana.map((e) => (
                    <details
                      key={e.id}
                      className="group rounded-2xl border border-line bg-bg p-4 transition-colors open:border-line-strong"
                    >
                      <summary className="flex cursor-pointer list-none flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`chip ${TIPO_CHIP[e.tipo]}`}>{TIPOS[e.tipo]}</span>
                          <span className={`chip ${IMPACTO_CHIP[e.impacto]}`}>{IMPACTOS[e.impacto]}</span>
                          <span className="chip chip-slate">{e.tema}</span>
                          <span className="chip chip-slate">{e.fase}</span>
                          <span className="ml-auto text-xs tabular-nums text-mute">~{formatBrDate(e.data)}</span>
                        </div>
                        <h3 className="m-0 font-display text-base font-semibold text-ink">{e.titulo}</h3>
                        <p className="m-0 text-sm text-mute">
                          <strong className="font-semibold text-ink">Aprendizado:</strong> {e.aprendizado}
                        </p>
                      </summary>

                      <div className="mt-4 grid gap-3 border-t border-line pt-4 text-sm md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">Acontecimento</div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.acontecimento}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">Contexto / causa</div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.contexto}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">Ação tomada</div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.acao}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">
                            O que poderia ter sido feito antes
                          </div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.antecipacao}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">Aprendizado</div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.aprendizado}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-mute">
                            Como contornar no futuro
                          </div>
                          <p className="m-0 mt-1 leading-relaxed text-ink">{e.contorno}</p>
                        </div>
                        {e.fonte && (
                          <div className="md:col-span-2">
                            <span className="text-xs text-mute">
                              <strong className="font-semibold text-ink">Fonte:</strong> {e.fonte}
                            </span>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </BentoCard>
          );
        })}

        {hasFilter && filtradas.length === 0 && (
          <BentoCard className="flex flex-col items-start gap-3">
            <p className="m-0 text-sm text-mute">Nenhum registro encontrado com os filtros atuais.</p>
            <button type="button" onClick={limparFiltros} className="btn spring-btn text-xs">
              Limpar filtros
            </button>
          </BentoCard>
        )}
      </div>
    </div>
  );
}
