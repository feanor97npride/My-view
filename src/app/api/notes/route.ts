import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setQuickNotes } from "@/lib/prefs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "Texto inválido." }, { status: 400 });
  }
  await setQuickNotes(body.text);
  return NextResponse.json({ ok: true });
}
