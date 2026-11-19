import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateDailyBriefingWithAI } from "@/lib/gmail";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  let body: {
    events?: { time: string; title: string }[];
    tasks?: { bucket: string; title: string }[];
    emails?: { sender: string; subject: string }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  try {
    const text = await generateDailyBriefingWithAI({
      events: Array.isArray(body.events) ? body.events : [],
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      emails: Array.isArray(body.emails) ? body.emails : [],
    });
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar briefing." },
      { status: 502 },
    );
  }
}
