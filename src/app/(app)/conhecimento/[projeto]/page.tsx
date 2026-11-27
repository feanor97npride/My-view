import Link from "next/link";
import { notFound } from "next/navigation";
import { BentoCard } from "@/components/ui";
import { carregarBase } from "@/lib/kb-store";
import AprendizadosView from "./aprendizados-view";

export const dynamic = "force-dynamic";

export default async function ProjetoConhecimentoPage({
  params,
}: {
  params: Promise<{ projeto: string }>;
}) {
  const { projeto: projetoId } = await params;
  const { base, erro } = carregarBase();

  if (erro) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
        <nav aria-label="Trilha" className="text-sm text-mute">
          <Link href="/conhecimento" className="hover:underline">Base de Conhecimento Interna</Link>
        </nav>
        <BentoCard className="flex flex-col gap-3">
          <span className="chip chip-amber w-fit">Configuração pendente</span>
          <p className="m-0 text-sm text-ink">{erro}</p>
        </BentoCard>
      </main>
    );
  }

  const projeto = base.projetos.find((p) => p.id === projetoId);
  if (!projeto) {
    notFound();
  }

  const entradas = base.entradas.filter((e) => e.projeto === projeto.id);
  const semanas = base.semanas.filter((s) => s.projeto === projeto.id);
  const top3 = base.top3[projeto.id]?.licoes ?? [];
  const subtitle = [projeto.cliente, projeto.descricao].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-1.5">
        <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1.5 text-sm text-mute">
          <Link href="/conhecimento" className="hover:underline">Base de Conhecimento Interna</Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-ink">{projeto.nome}</span>
        </nav>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Aprendizados do projeto {projeto.nome}
        </h1>
        {subtitle && <p className="m-0 text-sm text-mute">{subtitle}</p>}
      </header>

      <AprendizadosView entradas={entradas} semanas={semanas} top3={top3} />
    </main>
  );
}
