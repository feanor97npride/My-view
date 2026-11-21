import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserGoogleTtsKey } from "@/lib/prefs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const apiKey = await getUserGoogleTtsKey().catch(() => null);
  if (!apiKey) {
    return new NextResponse(null, { status: 204 });
  }

  let body: { text?: unknown; voice?: unknown };
  try {
    body = (await req.json()) as { text?: unknown; voice?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2500) : "";
  if (!text) {
    return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
  }

  const voiceName =
    typeof body.voice === "string" && /^pt-BR-(Neural2|Wavenet|Standard)-[A-D]$/i.test(body.voice)
      ? body.voice
      : "pt-BR-Neural2-C";

  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "pt-BR", name: voiceName },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 },
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const msg = (await res.text()).slice(0, 200);
      return NextResponse.json({ error: `Google TTS ${res.status}: ${msg}` }, { status: 502 });
    }
    const json = (await res.json()) as { audioContent?: string };
    if (!json.audioContent) {
      return NextResponse.json({ error: "Áudio vazio retornado pelo Google TTS." }, { status: 502 });
    }
    const buf = Buffer.from(json.audioContent, "base64");
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao sintetizar áudio." },
      { status: 502 },
    );
  }
}
