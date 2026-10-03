// Server-side TTS (§19). Каскад провайдеров:
//   1) Deepgram Aura-2 (если задан DEEPGRAM_API_KEY) — mp3;
//   2) Gemini TTS (GEMINI_API_KEY уже есть) — PCM → WAV;
//   3) нет ключей → клиент падает на браузерный Speech Synthesis.
// Ключи живут только на сервере. Аудио кэшируется в БД (таблица TtsCache):
// на Render Free файловая система эфемерна, а квота Gemini TTS маленькая —
// кэш обязан переживать рестарты.
import "server-only";
import { createHash } from "node:crypto";
import { db } from "../db";

const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const AZURE_KEY = process.env.AZURE_SPEECH_KEY || "";
const AZURE_REGION = process.env.AZURE_SPEECH_REGION || ""; // напр. "westeurope", "eastus"

export function hasAzure(): boolean {
  return AZURE_KEY.length > 0 && AZURE_REGION.length > 0;
}
export function hasDeepgram(): boolean {
  return DEEPGRAM_KEY.length > 0;
}
export function hasGeminiTts(): boolean {
  return GEMINI_KEY.length > 0;
}
export function hasAnyTts(): boolean {
  return hasAzure() || hasDeepgram() || hasGeminiTts();
}

export const AURA_VOICES = [
  { id: "aura-2-thalia-en", label: "Thalia (жен.)" },
  { id: "aura-2-andromeda-en", label: "Andromeda (жен.)" },
  { id: "aura-2-helena-en", label: "Helena (жен.)" },
  { id: "aura-2-apollo-en", label: "Apollo (муж.)" },
  { id: "aura-2-arcas-en", label: "Arcas (муж.)" },
  { id: "aura-2-orion-en", label: "Orion (муж.)" },
];

// Azure Neural — мультиязычные голоса (говорят и по-английски, и по-русски),
// качество близко к ElevenLabs. Один голос покрывает обе стороны в «Слушать».
export const AZURE_VOICES = [
  { id: "en-US-AvaMultilingualNeural", label: "Ava (жен., естественный)" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma (жен., тёплый)" },
  { id: "en-US-JennyMultilingualNeural", label: "Jenny (жен., дружелюбный)" },
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew (муж., спокойный)" },
  { id: "en-US-BrianMultilingualNeural", label: "Brian (муж., мягкий)" },
  { id: "en-US-RyanMultilingualNeural", label: "Ryan (муж., деловой)" },
];

export const GEMINI_VOICES = [
  // Женские
  { id: "Kore", label: "Kore (жен., уверенный)" },
  { id: "Aoede", label: "Aoede (жен., лёгкий)" },
  { id: "Leda", label: "Leda (жен., молодой)" },
  { id: "Callirrhoe", label: "Callirrhoe (жен., спокойный)" },
  { id: "Autonoe", label: "Autonoe (жен., яркий)" },
  { id: "Despina", label: "Despina (жен., мягкий)" },
  { id: "Sulafat", label: "Sulafat (жен., тёплый)" },
  // Мужские
  { id: "Puck", label: "Puck (муж., бодрый)" },
  { id: "Charon", label: "Charon (муж., деловой)" },
  { id: "Fenrir", label: "Fenrir (муж., живой)" },
  { id: "Orus", label: "Orus (муж., твёрдый)" },
  { id: "Iapetus", label: "Iapetus (муж., чёткий)" },
  { id: "Algieba", label: "Algieba (муж., мягкий)" },
  { id: "Enceladus", label: "Enceladus (муж., низкий)" },
];

export function availableVoices() {
  if (hasAzure()) return AZURE_VOICES;
  if (hasDeepgram()) return AURA_VOICES;
  if (hasGeminiTts()) return GEMINI_VOICES;
  return [];
}

export type TtsResult = { audio: Buffer; contentType: string };

async function cacheGet(key: string): Promise<TtsResult | null> {
  try {
    const row = await db.ttsCache.findUnique({ where: { key } });
    if (!row) return null;
    return { audio: Buffer.from(row.audio), contentType: row.contentType };
  } catch {
    return null;
  }
}

async function cachePut(key: string, audio: Buffer, contentType: string): Promise<void> {
  try {
    // Prisma 7 Bytes ждёт Uint8Array<ArrayBuffer> — приводим Buffer явно.
    const bytes = new Uint8Array(audio.byteLength);
    bytes.set(audio);
    await db.ttsCache.upsert({
      where: { key },
      update: { audio: bytes, contentType },
      create: { key, audio: bytes, contentType },
    });
  } catch {
    /* кэш — best effort */
  }
}

function hashKey(provider: string, voice: string, text: string): string {
  return createHash("sha1").update(`${provider}|${voice}|${text}`).digest("hex");
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
  const key = hashKey("dg", model, text);
  const cached = await cacheGet(key);
  if (cached) return cached;
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
    await cachePut(key, audio, "audio/mpeg");
    return { audio, contentType: "audio/mpeg" };
  } catch {
    return null;
  }
}

async function synthesizeGemini(text: string, voice: string): Promise<TtsResult | null> {
  const voiceName = GEMINI_VOICES.some((v) => v.id === voice) ? voice : "Kore";
  const key = hashKey("gm", voiceName, text);
  const cached = await cacheGet(key);
  if (cached) return cached;
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
    await cachePut(key, wav, "audio/wav");
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
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function synthesizeAzure(text: string, voice: string): Promise<TtsResult | null> {
  const voiceName = AZURE_VOICES.some((v) => v.id === voice) ? voice : "en-US-AvaMultilingualNeural";
  // Язык по наличию кириллицы — мультиязычные голоса произносят и рус., и англ.
  const lang = /[а-яё]/i.test(text) ? "ru-RU" : "en-US";
  const key = hashKey("az", `${voiceName}|${lang}`, text);
  const cached = await cacheGet(key);
  if (cached) return cached;
  try {
    const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${voiceName}'>${xmlEscape(text)}</voice></speak>`;
    const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "luma",
      },
      body: ssml,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    await cachePut(key, buf, "audio/mpeg");
    return { audio: buf, contentType: "audio/mpeg" };
  } catch {
    return null;
  }
}

// Вопросительная интонация: нейросетевые голоса дают её по знаку «?». Если фраза
// явно вопрос, а «?» нет — подставляем его ТОЛЬКО для озвучки (текст карточки не
// меняется). Императивы («Сделай это») не трогаем.
function questionfy(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const last = t[t.length - 1];
  if (last === "?" || last === "." || last === "!" || last === "…") return t;
  const enWh = /^(who|what|where|when|why|how|which|whose|whom)\b/i;
  const enAux = /^(do|does|did|is|are|am|was|were|can|could|will|would|should|shall|may|might|have|has|had)\b/i;
  const enPron = /\b(you|we|they|he|she|it|i)\b/i;
  const ruWh = /^(кто|что|где|когда|почему|зачем|как|какой|какая|какое|какие|сколько|чей|чья|чьё|чьи|куда|откуда|разве|неужели)\b/i;
  const ruLi = /\bли\b/i;
  const isQ = enWh.test(t) || (enAux.test(t) && enPron.test(t)) || ruWh.test(t) || ruLi.test(t);
  return isQ ? t + "?" : t;
}

export async function synthesize(text: string, voice: string): Promise<TtsResult | null> {
  text = questionfy(text);
  if (hasAzure()) {
    const az = await synthesizeAzure(text, voice);
    if (az) return az;
  }
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
