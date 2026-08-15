import { synthesize, hasAnyTts, availableVoices } from "@/lib/server/tts";
import { json, readJson, str } from "@/lib/server/http";

// GET → доступен ли серверный TTS и список голосов текущего провайдера.
export async function GET() {
  return json({ available: hasAnyTts(), voices: availableVoices() });
}

// POST → аудио английской фразы (mp3/wav). Ключи не покидают сервер (§19, §28).
export async function POST(req: Request) {
  const body = await readJson(req);
  const text = str(body.text, 500).trim();
  const voice = str(body.voice, 100);
  if (!text) return json({ error: "empty" }, { status: 400 });

  if (!hasAnyTts()) return json({ error: "unavailable" }, { status: 503 });

  const result = await synthesize(text, voice);
  if (!result) return json({ error: "tts-failed" }, { status: 502 });

  return new Response(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
