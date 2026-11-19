"use client";

import { useState } from "react";
import RetryNotice from "@/components/retry-notice";

export type StatusRow = { name: string; value: number };
export type ListRow = { name: string; total: number; overdue: number; today: number };
export type TrendRow = { day: string; n: number };
export type MailRow = { key: string; label: string; value: number };

type Tab = "geral" | "tarefas" | "emails";

type Props = {
  tasksError: string | null;
  doneError: string | null;
  mailError: string | null;
  totalOpen: number;
  overdue: number;
  dueToday: number;
  doneCount: number;
  byStatus: StatusRow[];
  byList: ListRow[];
  trend: TrendRow[];
  mailRows: MailRow[];
};

const LIST_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)"];

export default function IndicadoresView({
  tasksError,
  doneError,
  mailError,
  totalOpen,
  overdue,
  dueToday,
  doneCount,
  byStatus,
  byList,
  trend,
  mailRows,
}: Props) {
  const [tab, setTab] = useState<Tab>("geral");
  const [range, setRange] = useState<7 | 14>(14);

  const onTime = Math.max(0, totalOpen - overdue);
  const onTimePct = totalOpen > 0 ? Math.round((onTime / totalOpen) * 100) : 100;
  const ringDeg = Math.round((onTimePct / 100) * 360);

  const totalMail = mailRows.reduce((s, r) => s + r.value, 0);
  const acaoMail = mailRows.find((r) => r.key === "acao")?.value ?? 0;

  const slice = trend.slice(-range);
  const maxTrend = Math.max(1, ...slice.map((d) => d.n));
  const sliceTotal = slice.reduce((s, d) => s + d.n, 0);
  const sliceAvg = slice.length ? (sliceTotal / slice.length).toFixed(1).replace(".", ",") : "0,0";
  const peak = slice.reduce<TrendRow | null>((best, cur) => (!best || cur.n > best.n ? cur : best), null);
  const peakLabel = peak && peak.n > 0 ? `${peak.n} (${peak.day.slice(8)}/${peak.day.slice(5, 7)})` : "0";

  const maxList = Math.max(1, ...byList.map((l) => l.total));
  const sortedMail = [...mailRows].sort((a, b) => b.value - a.value);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:px-8 md:py-8 xl:px-10">
      {/* Cabeçalho + abas de foco */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-mute">ClickUp · Gmail · últimos 14 dias</p>
          <h1 className="mt-0.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Indicadores</h1>
        </div>
        <div role="tablist" aria-label="Filtrar domínio" className="inline-flex rounded-xl border border-line bg-card p-1 text-xs font-medium">
          {(
            [
              ["geral", "Visão Geral"],
              ["tarefas", "Tarefas"],
              ["emails", "E-mails"],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`spring-btn cursor-pointer rounded-lg px-3.5 py-1.5 transition-colors ${
                  active ? "bg-primary text-[var(--on-primary)] font-semibold" : "text-mute hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Bento Top: Anel de Saúde + 4 KPIs compactos */}
      <section aria-label="Resumo" className="spring-card spring-d1 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="card bento-card flex items-center gap-5 lg:col-span-5">
          {tasksError ? (
              <RetryNotice message={`ClickUp indisponível: ${tasksError}`} />
          ) : (
            <>
              <div
                role="img"
                aria-label={`${onTimePct}% das tarefas dentro do prazo`}
                className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--primary) ${ringDeg}deg, var(--line) 0)` }}
              >
                <div className="flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full bg-card">
                  <span className="font-display text-xl font-bold tabular-nums">{onTimePct}%</span>
                  <span className="text-[11px] text-mute">no prazo</span>
                </div>
              </div>
              <div className="min-w-0 space-y-1.5">
                <span className={`chip ${overdue === 0 ? "chip-green" : overdue <= 3 ? "chip-amber" : "chip-red"}`}>
                  {overdue === 0 ? "Tudo em dia" : overdue <= 3 ? "Equilíbrio saudável" : "Atenção ao prazo"}
                </span>
                <h2 className="font-display text-lg font-semibold leading-snug">
                  {totalOpen === 0 ? "Nenhuma tarefa aberta" : `${onTime} de ${totalOpen} tarefas dentro do prazo`}
                </h2>
                <p className="text-xs text-mute">
                  {overdue} {overdue === 1 ? "atrasada" : "atrasadas"} · {dueToday} {dueToday === 1 ? "vence hoje" : "vencem hoje"}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">
          <div className="card bento-card flex flex-col justify-between p-4">
            <span className="text-xs text-mute">Abertas</span>
            <span className="my-2 font-display text-3xl font-bold tabular-nums">{tasksError ? "–" : totalOpen}</span>
            <span className="text-xs text-mute">ClickUp ativo</span>
          </div>
          <div className="card bento-card flex flex-col justify-between p-4">
            <span className="text-xs text-mute">Atrasadas</span>
            <span
              className="my-2 font-display text-3xl font-bold tabular-nums"
              style={!tasksError && overdue > 0 ? { color: "var(--red-fg)" } : undefined}
            >
              {tasksError ? "–" : overdue}
            </span>
            <span className="text-xs" style={!tasksError && overdue > 0 ? { color: "var(--red-fg)" } : { color: "var(--mute)" }}>
              {overdue > 0 ? "Prioridade alta" : "Nenhuma atrasada"}
            </span>
          </div>
          <div className="card bento-card flex flex-col justify-between p-4">
            <span className="text-xs text-mute">Concluídas (14d)</span>
            <span className="my-2 font-display text-3xl font-bold tabular-nums" style={{ color: "var(--trend)" }}>
              {doneError ? "–" : doneCount}
            </span>
            <span className="text-xs text-mute">
              {doneError ? "Indisponível" : `${(doneCount / 14).toFixed(1).replace(".", ",")} por dia`}
            </span>
          </div>
          <div className="card bento-card flex flex-col justify-between p-4">
            <span className="text-xs text-mute">E-mails ação</span>
            <span className="my-2 font-display text-3xl font-bold tabular-nums text-primary">
              {mailError ? "–" : acaoMail}
            </span>
            <span className="text-xs text-mute">{mailError ? "Indisponível" : `de ${totalMail} (7 dias)`}</span>
          </div>
        </div>
      </section>

      {/* Bloco Tarefas: Entregas diárias (7d/14d) + Onde estão as tarefas */}
      {tab !== "emails" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="card bento-card flex flex-col gap-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Entregas diárias</h2>
                <p className="text-xs text-mute">Volume concluído no ClickUp nos últimos {range} dias</p>
              </div>
              <div className="inline-flex rounded-lg border border-line p-0.5 text-xs">
                {([7, 14] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 ${
                      range === r ? "bg-primary-soft font-semibold text-primary-ink" : "text-mute hover:text-ink"
                    }`}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>

            {doneError ? (
              <RetryNotice message={`ClickUp indisponível: ${doneError}`} />
            ) : (
              <>
                <div
                  className="flex h-44 items-end gap-1.5 border-b border-line pb-2 pt-4 sm:gap-2"
                  role="img"
                  aria-label={`Tarefas concluídas por dia nos últimos ${range} dias`}
                >
                  {slice.map((d) => {
                    const pct = d.n === 0 ? 4 : Math.max(10, Math.round((d.n / maxTrend) * 100));
                    const isPeak = peak && d.n > 0 && d.n === peak.n;
                    const bg = isPeak ? "var(--trend)" : d.n > 0 ? "var(--primary)" : "var(--line)";
                    const short = `${d.day.slice(8)}/${d.day.slice(5, 7)}`;
                    return (
                      <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <span className={`text-[11px] font-semibold tabular-nums ${d.n === 0 ? "text-mute" : "text-ink"}`}>
                          {d.n}
                        </span>
                        <div className="flex w-full flex-1 items-end justify-center">
                          <div
                            className="w-full max-w-[30px] rounded-t-lg transition-all"
                            style={{ height: `${pct}%`, background: bg }}
                            title={`${short}: ${d.n} concluída(s)`}
                          />
                        </div>
                        <span className="text-[11px] text-mute">{short}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                  <div className="rounded-xl bg-[var(--surface-3)] px-3 py-2">
                    <div className="text-xs text-mute">Total no período</div>
                    <div className="font-display text-base font-bold tabular-nums">{sliceTotal}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-3)] px-3 py-2">
                    <div className="text-xs text-mute">Média diária</div>
                    <div className="font-display text-base font-bold tabular-nums">{sliceAvg}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-3)] px-3 py-2">
                    <div className="text-xs text-mute">Pico</div>
                    <div className="font-display text-base font-bold tabular-nums">{peakLabel}</div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="card bento-card flex flex-col gap-4 lg:col-span-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Onde estão as tarefas</h2>
              <p className="text-xs text-mute">Por listas e status do ClickUp</p>
            </div>

            {tasksError ? (
                <RetryNotice message={`ClickUp indisponível: ${tasksError}`} />
            ) : byList.length === 0 ? (
              <p className="text-sm text-mute">Nenhuma tarefa aberta no momento.</p>
            ) : (
              <>
                <div className="space-y-3 text-sm">
                  {byList.map((l, i) => {
                    const w = Math.max(6, Math.round((l.total / maxList) * 100));
                    return (
                      <div key={l.name}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium">{l.name}</span>
                          <span className="shrink-0 tabular-nums text-mute">
                            {l.total} {l.total === 1 ? "aberta" : "abertas"}
                            {l.overdue > 0 ? ` · ${l.overdue} atr.` : ""}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${w}%`, background: LIST_COLORS[i % LIST_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line pt-3 text-xs">
                  {byStatus.map((s) => (
                    <span key={s.name} className="rounded-full bg-[var(--surface-3)] px-2.5 py-1">
                      {s.name}: <strong>{s.value}</strong>
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Bloco E-mails: Barra proporcional única + grade por categoria */}
      {tab !== "tarefas" && (
        <section className="card bento-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold">Mapa de E-mails (últimos 7 dias)</h2>
              <p className="text-xs text-mute">Classificação por regras e IA · proporção entre ação e leitura leve</p>
            </div>
            {!mailError && (
              <span className="text-xs text-mute">
                Total: <strong className="text-ink">{totalMail} e-mails</strong>
              </span>
            )}
          </div>

          {mailError ? (
            <RetryNotice message={`Banco indisponível: ${mailError}`} />
          ) : totalMail === 0 ? (
            <p className="text-sm text-mute">Nenhum e-mail classificado nos últimos 7 dias.</p>
          ) : (
            <>
              <div className="flex h-10 w-full gap-1 overflow-hidden rounded-xl" role="img" aria-label="Proporção de e-mails por categoria">
                {sortedMail
                  .filter((r) => r.value > 0)
                  .map((r) => {
                    const pct = (r.value / totalMail) * 100;
                    return (
                      <div
                        key={r.key}
                        className="flex items-center justify-center truncate px-1.5 text-xs font-semibold text-white"
                        style={{ width: `${pct}%`, background: `var(--cat-${r.key}, var(--cat-informativo))` }}
                        title={`${r.label}: ${r.value} (${Math.round(pct)}%)`}
                      >
                        {pct >= 14 ? `${r.label} · ${r.value}` : pct >= 6 ? r.value : ""}
                      </div>
                    );
                  })}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3 lg:grid-cols-6">
                {mailRows.map((r) => {
                  const pct = totalMail > 0 ? Math.round((r.value / totalMail) * 100) : 0;
                  return (
                    <div key={r.key} className="rounded-xl border border-line p-3">
                      <div className="flex items-center gap-1.5 text-mute">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: `var(--cat-${r.key}, var(--cat-informativo))` }}
                        />
                        <span className="truncate">{r.label}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-display text-lg font-bold tabular-nums">{r.value}</span>
                        <span className="text-[11px] text-mute tabular-nums">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
