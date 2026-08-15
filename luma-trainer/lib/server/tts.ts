// Server-side TTS (§19). Каскад провайдеров:
//   1) Deepgram Aura-2 (если задан DEEPGRAM_API_KEY) — mp3;
//   2) Gemini TTS (GEMINI_API_KEY уже есть) — PCM → WAV;
//   3) нет ключей → клиент падает на браузерный Speech Synthesis.
// Ключи живут только на сервере; аудио кэшируется на диск, чтобы беречь квоту.
import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
// На проде указываем TTS_CACHE_DIR на persistent-диск, иначе кэш гибнет при деплое.
const CACHE_DIR = process.env.TTS_CACHE_DIR || path.join(process.cwd(), ".tts-cache");

export function hasDeepgram(): boolean {
  return DEEPGRAM_KEY.length > 0;
}
export function hasGeminiTts(): boolean {
  return GEMINI_KEY.length > 0;
}
export function hasAnyTts(): boolean {
  return hasDeepgram() || hasGeminiTts();
}

export const AURA_VOICES = [
  { id: "aura-2-thalia-en", label: "Thalia (жен.)" },
  { id: "aura-2-andromeda-en", label: "Andromeda (жен.)" },
  { id: "aura-2-helena-en", label: "Helena (жен.)" },
  { id: "aura-2-apollo-en", label: "Apollo (муж.)" },
  { id: "aura-2-arcas-en", label: "Arcas (муж.)" },
  { id: "aura-2-orion-en", label: "Orion (муж.)" },
];

export const GEMINI_VOICES = [
  { id: "Kore", label: "Kore (жен.)" },
  { id: "Aoede", label: "Aoede (жен.)" },
  { id: "Leda", label: "Leda (жен.)" },
  { id: "Puck", label: "Puck (муж.)" },
  { id: "Charon", label: "Charon (муж.)" },
  { id: "Fenrir", label: "Fenrir (муж.)" },
];

export function availableVoices() {
  if (hasDeepgram()) return AURA_VOICES;
  if (hasGeminiTts()) return GEMINI_VOICES;
  return [];
}

export type TtsResult = { audio: Buffer; contentType: string };

async function cacheGet(key: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(CACHE_DIR, key));
  } catch {
    return null;
  }
}

async function cachePut(key: string, data: Buffer): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, key), data);
  } catch {
    /* кэш — best effort */
  }
}

function hashKey(provider: string, voice: string, text: string, ext: string): string {
  const h = createHash("sha1").update(`${provider}|${voice}|${text}`).digest("hex");
  return `${h}.${ext}`;
}

/** PCM 16-bit LE mono → WAV (RIFF-заголовок). */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesizeDeepgram(text: string, voice: string): Promise<TtsResult | null> {
  const model = AURA_VOICES.some((v) => v.id === voice) ? voice : "aura-2-thalia-en";
  const key = hashKey("dg", model, text, "mp3");
  const cached = await cacheGet(key);
  if (cached) return { audio: cached, contentType: "audio/mpeg" };
  try {
    const res = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`,
      {
        method: "POST",
        headers: { Authorization: `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) return null;
    const audio = Buffer.from(await res.arrayBuffer());
    await cachePut(key, audio);
    return { audio, contentType: "audio/mpeg" };
  } catch {
    return null;
  }
}

async function synthesizeGemini(text: string, voice: string): Promise<TtsResult | null> {
  const voiceName = GEMINI_VOICES.some((v) => v.id === voice) ? voice : "Kore";
  const key = hashKey("gm", voiceName, text, "wav");
  const cached = await cacheGet(key);
  if (cached) return { audio: cached, contentType: "audio/wav" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    };
    const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline?.data) return null;
    const pcm = Buffer.from(inline.data, "base64");
    const rateMatch = /rate=(\d+)/.exec(inline.mimeType || "");
    const wav = pcmToWav(pcm, rateMatch ? parseInt(rateMatch[1], 10) : 24000);
    await cachePut(key, wav);
    return { audio: wav, contentType: "audio/wav" };
  } catch {
    return null;
  }
}

/**
 * Прогреть дисковый кэш для набора фраз (последовательно, чтобы уважать RPM-лимиты).
 * Останавливается после двух подряд неудач (обычно это исчерпанная квота).
 */
export async function warmPhrases(texts: string[], voice: string): Promise<void> {
  if (!hasAnyTts()) return;
  let failures = 0;
  for (const t of texts) {
    const clean = (t || "").trim();
    if (!clean) continue;
    const ok = await synthesize(clean, voice);
    if (ok) failures = 0;
    else if (++failures >= 2) break;
  }
}

/** Синтез английской фразы через доступный провайдер. null → пусть клиент озвучит браузером. */
export async function synthesize(text: string, voice: string): Promise<TtsResult | null> {
  if (hasDeepgram()) {
    const dg = await synthesizeDeepgram(text, voice);
    if (dg) return dg;
  }
  if (hasGeminiTts()) {
    const gm = await synthesizeGemini(text, voice);
    if (gm) return gm;
  }
  return null;
}
