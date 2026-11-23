import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDriveDoc, listDriveFiles, type DriveTypeFilter } from "@/lib/drive";

const VALID_TYPES = new Set<DriveTypeFilter>(["all", "doc", "sheet", "slide", "pdf", "folder"]);

export async function GET(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const rawType = (url.searchParams.get("type") ?? "all") as DriveTypeFilter;
  const type = VALID_TYPES.has(rawType) ? rawType : "all";
  const starredOnly = url.searchParams.get("starred") === "1";

  try {
    const files = await listDriveFiles(token, { query, type, starredOnly, pageSize: 40 });
    return NextResponse.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar Google Drive.";
    if (msg === "DRIVE_SCOPE_MISSING") {
      return NextResponse.json({ error: "DRIVE_SCOPE_MISSING", scopeMissing: true }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  let body: { title?: unknown; content?: unknown };
  try {
    body = (await req.json()) as { title?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!title) {
    return NextResponse.json({ error: "Informe o título do documento." }, { status: 400 });
  }

  try {
    const doc = await createDriveDoc(token, { title, content });
    return NextResponse.json({ ok: true, ...doc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar documento no Drive.";
    if (msg === "DRIVE_SCOPE_MISSING") {
      return NextResponse.json({ error: "DRIVE_SCOPE_MISSING", scopeMissing: true }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
