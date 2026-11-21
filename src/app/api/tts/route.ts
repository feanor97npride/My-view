import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserGoogleTtsKey } from "@/lib/prefs";

async function synthesizeEdgeTts(text: string, voiceName: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 6000, synthesisTimeoutMs: 12000 });
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: "+4%" });
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } finally {
    tts.close();
  }
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
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

  const googleKey = await getUserGoogleTtsKey().catch(() => null);
  if (googleKey) {
    try {
      const gVoice =
        typeof body.voice === "string" && /^pt-BR-(Neural2|Wavenet|Standard)-[A-D]$/i.test(body.voice)
          ? body.voice
          : "pt-BR-Neural2-C";
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(googleKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: "pt-BR", name: gVoice },
            audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 },
          }),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { audioContent?: string };
        if (json.audioContent) {
          return new NextResponse(Buffer.from(json.audioContent, "base64"), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        }
      }
    } catch {
      // fall through to Edge Neural TTS
    }
  }

  try {
    const edgeVoice =
      body.voice === "pt-BR-AntonioNeural" ? "pt-BR-AntonioNeural" : "pt-BR-FranciscaNeural";
    const buf = await synthesizeEdgeTts(text, edgeVoice);
    if (buf.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // 204 triggers automatic browser speechSynthesis fallback
    return new NextResponse(null, { status: 204 });
  }
}
