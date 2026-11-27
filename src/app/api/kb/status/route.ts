import { NextResponse } from "next/server";
import { ultimaSemana } from "@/lib/kb";
import { carregarBase } from "@/lib/kb-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { base, sha, erro } = carregarBase();
  const projetos = base.projetos.map((p) => ({
    id: p.id,
    entradas: base.entradas.filter((e) => e.projeto === p.id).length,
    ultimaSemana: ultimaSemana(base, p.id),
  }));

  return NextResponse.json(
    {
      ok: erro === null,
      erro: erro ? "configuracao" : null,
      sha,
      projetos,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
