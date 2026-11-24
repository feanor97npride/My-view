import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuickNotes, setQuickNotes } from "@/lib/prefs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || session?.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  let body: { text?: unknown; append?: unknown };
  try {
    body = (await req.json()) as { text?: unknown; append?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (typeof body.text !== "string") {
    return NextResponse.json({ error: "Texto inválido." }, { status: 400 });
  }
  if (body.append === true) {
    const clean = body.text.trim().slice(0, 2000);
    if (clean) {
      const current = await getQuickNotes().catch(() => "");
      const next = current.trim() ? `${current.trimEnd()}\n- ${clean}` : `- ${clean}`;
      await setQuickNotes(next);
    }
    return NextResponse.json({ ok: true });
  }
  await setQuickNotes(body.text);
  return NextResponse.json({ ok: true });
}
