import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserGoogleTtsKey } from "@/lib/prefs";

async function createEdgeTtsStream(text: string, voiceName: string): Promise<ReadableStream<Uint8Array> | null> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 3500, synthesisTimeoutMs: 9000 });
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: "+6%" });
  const iterator = audioStream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    tts.close();
    return null;
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const firstBuf = Buffer.isBuffer(first.value) ? first.value : Buffer.from(first.value);
        controller.enqueue(new Uint8Array(firstBuf));
        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;
          const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        tts.close();
      }
    },
    cancel() {
      tts.close();
    },
  });
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
            audioConfig: { audioEncoding: "MP3", speakingRate: 1.08 },
          }),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { audioContent?: string };
        if (json.audioContent) {
          return new NextResponse(Buffer.from(json.audioContent, "base64"), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" },
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
    const stream = await createEdgeTtsStream(text, edgeVoice);
    if (!stream) {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    // 204 triggers automatic browser speechSynthesis fallback
    return new NextResponse(null, { status: 204 });
  }
}
