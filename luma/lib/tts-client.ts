// Client TTS: prefer server Deepgram audio; fall back to the browser Speech
// Synthesis API. Never speaks Russian text with an English voice (§19).

let serverAvailable: boolean | null = null;
const cache = new Map<string, string>(); // text|voice -> objectURL
let current: HTMLAudioElement | null = null;

export async function checkServerTts(): Promise<boolean> {
  if (serverAvailable !== null) return serverAvailable;
  try {
    const res = await fetch("/api/tts");
    const j = await res.json();
    serverAvailable = !!j.available;
  } catch {
    serverAvailable = false;
  }
  return serverAvailable;
}

let voicesReady = false;

function loadVoices(): SpeechSynthesisVoice[] {
  const list = window.speechSynthesis.getVoices();
  if (list.length > 0) voicesReady = true;
  return list;
}

/** Лучший доступный английский голос: премиальные/нейросетевые выше системных по умолчанию. */
function pickBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = loadVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (voices.length === 0) return null;
  const score = (v: SpeechSynthesisVoice): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|premium|enhanced/.test(n)) s += 40; // Edge/macOS enhanced
    if (n.includes("google")) s += 30; // Chrome: Google US English — заметно лучше системного
    if (/samantha|ava|allison|zoe|karen|daniel|serena/.test(n)) s += 15; // приличные голоса macOS
    if (v.lang.toLowerCase() === "en-us" || v.lang.toLowerCase() === "en-gb") s += 8;
    if (v.localService === false) s += 5; // облачные обычно качественнее
    if (/compact|albert|bad news|bells|boing|bubbles|cellos|fred|jester|organ|trinoids|whisper|wobble|zarvox/.test(n)) s -= 50; // новелти-голоса macOS
    return s;
  };
  return voices.sort((a, b) => score(b) - score(a))[0];
}

function speakBrowser(text: string, rate: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const speak = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = Math.max(0.5, Math.min(2, rate));
    const v = pickBrowserVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };
  // Список голосов подгружается асинхронно — при первом вызове дождёмся его.
  if (!voicesReady && loadVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", () => speak(), { once: true });
    setTimeout(speak, 400); // страховка, если событие не придёт
    return;
  }
  speak();
}

const inflight = new Map<string, Promise<string | null>>();

/** Скачать и закэшировать аудио фразы (objectURL). Дедупликация параллельных запросов. */
async function ensureAudio(text: string, voice: string): Promise<string | null> {
  const key = `${text}|${voice}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * Прогреть озвучку заранее (не проигрывая) — чтобы 🔊 срабатывал мгновенно.
 * Тихо выходит, если серверный TTS недоступен или аудио уже в кэше.
 */
export async function prefetchEnglish(text: string, voice: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  if (!(await checkServerTts())) return;
  await ensureAudio(clean, voice);
}

/** Speak English text. `voice`/`rate` come from settings. */
export async function speakEnglish(text: string, voice: string, rate = 1): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  if (current) {
    current.pause();
    current = null;
  }

  const useServer = await checkServerTts();
  if (useServer) {
    const url = await ensureAudio(clean, voice);
    if (url) {
      try {
        const audio = new Audio(url);
        audio.playbackRate = Math.max(0.5, Math.min(2, rate));
        current = audio;
        await audio.play();
        return;
      } catch {
        // fall through to browser voice
      }
    }
  }
  speakBrowser(clean, rate);
}

/**
 * Проиграть произвольный текст (любой язык) и дождаться конца — для режима
 * «Слушать» (последовательное воспроизведение). Возвращает функцию остановки
 * через ссылку на текущий Audio. Тихо резолвится при ошибке/отсутствии TTS.
 */
export async function speakAndWait(text: string, voice: string, rate = 1, signal?: AbortSignal): Promise<void> {
  const clean = text.trim();
  if (!clean || signal?.aborted) return;
  if (current) {
    current.pause();
    current = null;
  }
  const useServer = await checkServerTts();
  if (signal?.aborted) return;
  if (useServer) {
    const url = await ensureAudio(clean, voice);
    if (signal?.aborted) return;
    if (url) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        const onAbort = () => {
          try {
            audio.pause();
          } catch {}
          finish();
        };
        let audio: HTMLAudioElement;
        try {
          audio = new Audio(url);
          audio.playbackRate = Math.max(0.5, Math.min(2, rate));
          current = audio;
          audio.onended = finish;
          audio.onerror = finish;
          signal?.addEventListener("abort", onAbort, { once: true });
          audio.play().catch(finish);
        } catch {
          finish();
        }
      });
      return;
    }
  }
  // Браузерный фолбэк: язык по наличию кириллицы.
  await new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = Math.max(0.5, Math.min(2, rate));
    u.lang = /[а-яё]/i.test(clean) ? "ru-RU" : "en-US";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    signal?.addEventListener("abort", () => { window.speechSynthesis.cancel(); finish(); }, { once: true });
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

/** Прогреть аудио произвольного текста (для предзагрузки следующей карточки). */
export async function prefetchText(text: string, voice: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  if (!(await checkServerTts())) return;
  await ensureAudio(clean, voice);
}

/** Остановить текущее серверное аудио (для паузы/остановки режима «Слушать»). */
export function stopAudio(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
