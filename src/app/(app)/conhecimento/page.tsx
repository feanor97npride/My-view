import Link from "next/link";
import { BentoCard, SectionHeader } from "@/components/ui";
import { ultimaSemana } from "@/lib/kb";
import { carregarBase } from "@/lib/kb-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Base de Conhecimento Interna" };

function formatBrDate(isoDate: string | null): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export default function ConhecimentoPage() {
  const { base, erro } = carregarBase();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-mute">Área privada</span>
        <h1 className="font-display text-3xl font-bold tracking-tight">Base de Conhecimento Interna</h1>
        <p className="m-0 text-sm text-mute">
          Registros semanais de decisões, aprendizados e contornos práticos consolidados por projeto.
        </p>
      </header>

      {erro && (
        <BentoCard className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-amber">Configuração pendente</span>
          </div>
          <p className="m-0 text-sm text-ink">{erro}</p>
        </BentoCard>
      )}

      {!erro && base.projetos.length === 0 && (
        <BentoCard className="flex flex-col gap-2">
          <SectionHeader
            title="Nenhum projeto publicado ainda"
            subtitle="Execute a carga inicial (scripts/kb.ts append) para publicar o primeiro lote cifrado."
          />
        </BentoCard>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {base.projetos.map((projeto) => {
          const entradas = base.entradas.filter((e) => e.projeto === projeto.id);
          const alto = entradas.filter((e) => e.impacto === "alto").length;
          const ult = ultimaSemana(base, projeto.id);
          const subtitle = [projeto.cliente, projeto.descricao].filter(Boolean).join(" · ");

          return (
            <BentoCard key={projeto.id} className="spring-card flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-3">
                <SectionHeader
                  title={`Aprendizados do projeto ${projeto.nome}`}
                  subtitle={subtitle || undefined}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip chip-slate tabular-nums">
                    {entradas.length} {entradas.length === 1 ? "registro" : "registros"}
                  </span>
                  <span className="chip chip-red tabular-nums">
                    {alto} de impacto alto
                  </span>
                  <span className="chip chip-blue tabular-nums">
                    Última consolidação {formatBrDate(ult)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Link href={`/conhecimento/${projeto.id}`} className="btn btn-primary spring-btn no-underline">
                  Abrir
                </Link>
              </div>
            </BentoCard>
          );
        })}
      </div>
    </main>
  );
}
