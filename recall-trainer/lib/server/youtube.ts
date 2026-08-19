// YouTube: метаданные (oEmbed + best-effort watch-page) и транскрипт (§5).
// Никаких платных API. Если субтитров нет — пользователь вставляет текст вручную.
import "server-only";
import { YoutubeTranscript } from "youtube-transcript";

export type TranscriptSegment = { start: number; end: number; text: string };

export type YoutubeMeta = {
  videoId: string;
  title: string;
  author: string | null;
  thumbnail: string | null;
  duration: number | null; // секунды
  publishedAt: Date | null;
};

/** Достаёт videoId из любой известной формы ссылки YouTube. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  // Уже голый id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function isYoutubeUrl(input: string): boolean {
  return parseYoutubeId(input) !== null;
}

export function youtubeWatchUrl(videoId: string, seconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return seconds && seconds > 0 ? `${base}&t=${Math.floor(seconds)}s` : base;
}

/** oEmbed → title/author/thumbnail; watch-page (best-effort) → duration/publishedAt. */
export async function fetchYoutubeMeta(videoId: string): Promise<YoutubeMeta> {
  const meta: YoutubeMeta = {
    videoId,
    title: `YouTube video ${videoId}`,
    author: null,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: null,
    publishedAt: null,
  };

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { "user-agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const j = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (j.title) meta.title = j.title;
      if (j.author_name) meta.author = j.author_name;
      if (j.thumbnail_url) meta.thumbnail = j.thumbnail_url;
    }
  } catch {
    /* oEmbed недоступен — оставляем дефолты */
  }

  // Длительность и дату публикации пытаемся вытащить из HTML страницы.
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" },
    });
    if (res.ok) {
      const html = await res.text();
      const len = html.match(/"lengthSeconds":"(\d+)"/);
      if (len) meta.duration = parseInt(len[1], 10);
      const pub = html.match(/"publishDate":"([^"]+)"/) || html.match(/"uploadDate":"([^"]+)"/);
      if (pub) {
        const d = new Date(pub[1]);
        if (!isNaN(d.getTime())) meta.publishedAt = d;
      }
    }
  } catch {
    /* best-effort */
  }

  return meta;
}

/**
 * Транскрипт с таймкодами. Нормализует единицы: youtube-transcript отдаёт
 * srv3 в миллисекундах, а классический формат — в секундах. Медианная длина
 * реплики субтитров ~2–6 c, поэтому median(duration) > 100 ⇒ значения в мс.
 * Возвращает [] если субтитров нет (пользователь вставит текст вручную).
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  let raw: { text: string; duration: number; offset: number }[];
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId);
  } catch {
    return [];
  }
  if (!raw?.length) return [];

  const durations = raw.map((r) => r.duration).filter((d) => d > 0).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  const scale = median > 100 ? 1000 : 1; // мс → с

  const segs: TranscriptSegment[] = [];
  for (const r of raw) {
    const text = r.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = r.offset / scale;
    const end = (r.offset + r.duration) / scale;
    segs.push({ start: Math.max(0, Math.round(start)), end: Math.max(0, Math.round(end)), text });
  }
  return segs;
}

/** Собирает сплошной текст транскрипта с таймкодами вида [mm:ss] для передачи в LLM. */
export function segmentsToTimedText(segs: TranscriptSegment[]): string {
  return segs.map((s) => `[${formatTimecode(s.start)}] ${s.text}`).join("\n");
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Парсит таймкод "mm:ss" | "h:mm:ss" | секунды в число секунд. */
export function parseTimecode(tc: string | number | null | undefined): number | null {
  if (tc == null) return null;
  if (typeof tc === "number") return Math.max(0, Math.floor(tc));
  const t = tc.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const parts = t.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec;
}
