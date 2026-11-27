import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEmailPlainText, summarizeNewsletterWithAI } from "@/lib/gmail";
import { setNewsletterRules } from "@/lib/prefs";

const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;

type Payload =
  | { action: "body"; messageId: string }
  | { action: "summary"; messageId: string; subject?: string }
  | { action: "rules"; rules: string[] };

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || session?.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no portal." }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    if (body.action === "body") {
      if (typeof body.messageId !== "string" || !SAFE_ID.test(body.messageId)) {
        return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
      }
      const text = await getEmailPlainText(token, body.messageId);
      return NextResponse.json({ ok: true, text });
    }

    if (body.action === "summary") {
      if (typeof body.messageId !== "string" || !SAFE_ID.test(body.messageId)) {
        return NextResponse.json({ error: "messageId inválido." }, { status: 400 });
      }
      const text = await getEmailPlainText(token, body.messageId);
      const summary = await summarizeNewsletterWithAI(String(body.subject ?? "Newsletter").slice(0, 200), text);
      return NextResponse.json({ ok: true, summary, text });
    }

    if (body.action === "rules" && Array.isArray(body.rules)) {
      const saved = await setNewsletterRules(body.rules);
      return NextResponse.json({ ok: true, rules: saved });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar newsletter.";
    if (/cota|quota|429/i.test(msg)) {
      return NextResponse.json(
        { error: "Cota temporária do Gmail atingida. Aguarde cerca de 1 minuto e tente novamente." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
