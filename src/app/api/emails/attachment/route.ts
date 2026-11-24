import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAttachment } from "@/lib/gmail";

const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const INLINE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
]);

export async function GET(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || session?.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId") ?? "";
  const attachmentId = searchParams.get("attachmentId") ?? "";
  const rawName = (searchParams.get("name") ?? "anexo").replace(/[\r\n"\\/]/g, "_").slice(0, 120) || "anexo";
  const rawMime = (searchParams.get("mime") ?? "application/octet-stream").toLowerCase().split(";")[0].trim();

  if (!SAFE_ID.test(messageId) || !SAFE_ID.test(attachmentId)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  try {
    const buf = await getAttachment(token, messageId, attachmentId);
    if (buf.byteLength > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Anexo excede o limite de 15 MB para visualização." }, { status: 413 });
    }
    const canInline = INLINE_MIME.has(rawMime);
    const contentType = canInline ? rawMime : "application/octet-stream";
    const disposition = canInline ? "inline" : "attachment";
    const encoded = encodeURIComponent(rawName);

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${rawName}"; filename*=UTF-8''${encoded}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar anexo";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
