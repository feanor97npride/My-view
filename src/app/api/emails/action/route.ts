import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { archiveEmail, markEmailsRead, markEmailsUnread, unarchiveEmail } from "@/lib/gmail";

type Payload =
  | { action: "archive" | "unarchive"; id: string }
  | { action: "markRead" | "markUnread"; ids: string[] };

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no portal." }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    if (body.action === "archive" && typeof body.id === "string" && body.id) {
      await archiveEmail(token, body.id);
    } else if (body.action === "unarchive" && typeof body.id === "string" && body.id) {
      await unarchiveEmail(token, body.id);
    } else if (body.action === "markRead" && Array.isArray(body.ids)) {
      await markEmailsRead(token, body.ids.filter((x) => typeof x === "string" && x));
    } else if (body.action === "markUnread" && Array.isArray(body.ids)) {
      await markEmailsUnread(token, body.ids.filter((x) => typeof x === "string" && x));
    } else {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar Gmail";
    if (msg.includes("Gmail 403") || msg.includes("insufficient") || msg.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      return NextResponse.json(
        { error: "Sem permissão de escrita no Gmail. Clique em Sair e entre novamente com o Google." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
