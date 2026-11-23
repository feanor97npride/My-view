export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  starred: boolean;
  shared: boolean;
  owner: string;
  sizeLabel: string | null;
};

export type DriveTypeFilter = "all" | "doc" | "sheet" | "slide" | "pdf" | "folder";

const MIME_FILTER: Record<Exclude<DriveTypeFilter, "all">, string> = {
  doc: "mimeType = 'application/vnd.google-apps.document'",
  sheet: "mimeType = 'application/vnd.google-apps.spreadsheet'",
  slide: "mimeType = 'application/vnd.google-apps.presentation'",
  pdf: "mimeType = 'application/pdf'",
  folder: "mimeType = 'application/vnd.google-apps.folder'",
};

export function driveTypeLabel(mimeType: string): { label: string; chip: string } {
  if (mimeType === "application/vnd.google-apps.document") return { label: "Doc", chip: "chip-blue" };
  if (mimeType === "application/vnd.google-apps.spreadsheet") return { label: "Planilha", chip: "chip-green" };
  if (mimeType === "application/vnd.google-apps.presentation") return { label: "Slide", chip: "chip-amber" };
  if (mimeType === "application/vnd.google-apps.folder") return { label: "Pasta", chip: "chip-slate" };
  if (mimeType === "application/pdf") return { label: "PDF", chip: "chip-red" };
  if (mimeType.startsWith("image/")) return { label: "Imagem", chip: "chip-pink" };
  return { label: "Arquivo", chip: "chip-violet" };
}

function formatBytes(bytesRaw?: string): string | null {
  const n = Number(bytesRaw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeDriveQuery(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listDriveFiles(
  token: string,
  opts?: { query?: string; type?: DriveTypeFilter; pageSize?: number; starredOnly?: boolean },
): Promise<DriveFile[]> {
  const clauses: string[] = ["trashed = false"];
  const q = opts?.query?.trim();
  if (q) {
    const safe = escapeDriveQuery(q);
    clauses.push(`(name contains '${safe}' or fullText contains '${safe}')`);
  }
  if (opts?.type && opts.type !== "all" && MIME_FILTER[opts.type]) {
    clauses.push(MIME_FILTER[opts.type]);
  }
  if (opts?.starredOnly) {
    clauses.push("starred = true");
  }

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(Math.min(50, Math.max(1, opts?.pageSize ?? 30))),
    orderBy: "viewedByMeTime desc,modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,starred,shared,size,owners(displayName,emailAddress))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    const txt = await res.text().catch(() => "");
    if (txt.includes("insufficient") || txt.includes("scope") || res.status === 403) {
      throw new Error("DRIVE_SCOPE_MISSING");
    }
    throw new Error(`Drive ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`Drive ${res.status}`);
  }

  const j = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      webViewLink?: string;
      starred?: boolean;
      shared?: boolean;
      size?: string;
      owners?: { displayName?: string; emailAddress?: string }[];
    }[];
  };

  return (j.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime ?? "",
    webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
    starred: Boolean(f.starred),
    shared: Boolean(f.shared),
    owner: f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || "Você",
    sizeLabel: formatBytes(f.size),
  }));
}

export async function readDriveFileText(token: string, fileId: string, mimeType?: string): Promise<string> {
  const isGoogleDoc = mimeType === "application/vnd.google-apps.document";
  const isGoogleSheet = mimeType === "application/vnd.google-apps.spreadsheet";
  const isGoogleSlide = mimeType === "application/vnd.google-apps.presentation";

  const url =
    isGoogleDoc || isGoogleSlide
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
      : isGoogleSheet
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 403) throw new Error("DRIVE_SCOPE_MISSING");
  if (!res.ok) throw new Error(`Não foi possível ler o arquivo (Drive ${res.status}).`);

  const text = await res.text();
  return text.slice(0, 12_000);
}

export async function createDriveDoc(
  token: string,
  input: { title: string; content: string },
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `myview_${Date.now()}`;
  const metadata = JSON.stringify({
    name: input.title.slice(0, 160),
    mimeType: "application/vnd.google-apps.document",
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${input.content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (res.status === 403) throw new Error("DRIVE_SCOPE_MISSING");
  if (!res.ok) throw new Error(`Erro ao criar documento no Drive (${res.status}).`);

  const j = (await res.json()) as { id: string; webViewLink?: string };
  return {
    id: j.id,
    webViewLink: j.webViewLink ?? `https://docs.google.com/document/d/${j.id}/edit`,
  };
}
