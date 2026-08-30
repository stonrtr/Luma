// Client TTS: prefer server Deepgram audio; fall back to the browser Speech
// Synthesis API. Never speaks Russian text with an English voice (§19).

import { getAudioContext, resumeAudioContext } from "./sfx";

let serverAvailable: boolean | null = null;
const cache = new Map<string, string>(); // text|voice -> objectURL
let current: HTMLAudioElement | null = null;

// --- Web Audio путь (надёжен на iOS PWA для последовательного проигрывания) ---
const bufferCache = new Map<string, AudioBuffer>(); // text|voice -> decoded
const bufferInflight = new Map<string, Promise<AudioBuffer | null>>();
let currentSource: AudioBufferSourceNode | null = null;

/** Скачать + декодировать аудио фразы в AudioBuffer (с кэшем и дедупликацией). */
async function ensureBuffer(text: string, voice: string): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  const key = `${text}|${voice}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const pending = bufferInflight.get(key);
  if (pending) return pending;
  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      bufferCache.set(key, buf);
      return buf;
    } catch {
      return null;
    } finally {
      bufferInflight.delete(key);
    }
  })();
  bufferInflight.set(key, p);
  return p;
}

/** Проиграть декодированный буфер через Web Audio и дождаться конца/отмены. */
async function playBufferAndWait(buf: AudioBuffer, rate: number, signal?: AbortSignal): Promise<void> {
  const ctx0 = getAudioContext();
  if (!ctx0) return;
  // Контекст мог «уснуть» после круга/простоя — будим и ЖДЁМ, иначе буфер
  // «проигрывается» на спящем контексте: шаги идут, звука нет.
  if (ctx0.state !== "running") {
    try { await ctx0.resume(); } catch {}
  }
  return new Promise<void>((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) return resolve();
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const src = ctx.createBufferSource();
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      try { src.stop(); } catch {}
      try { src.disconnect(); } catch {}
      if (currentSource === src) currentSource = null;
      resolve();
    };
    const onAbort = () => finish();
    try {
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.5, Math.min(2, rate));
      src.connect(ctx.destination);
      src.onended = finish;
      signal?.addEventListener("abort", onAbort, { once: true });
      currentSource = src;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      src.start(0);
      // Страховка: длительность буфера с запасом.
      timer = setTimeout(finish, Math.min(30000, buf.duration * 1000 / Math.max(0.5, rate) + 2000));
    } catch {
      finish();
    }
  });
}

// Один переиспользуемый аудио-элемент для последовательного воспроизведения
// («Слушать»). Разблокируется первым жестом (клик «Слушать») и дальше играет
// клипы подряд БЕЗ новых жестов — new Audio() на каждый клип браузер блокирует.
let listenAudio: HTMLAudioElement | null = null;
function getListenAudio(): HTMLAudioElement {
  if (!listenAudio) {
    listenAudio = new Audio();
    listenAudio.preload = "auto";
  }
  return listenAudio;
}

// Крошечный тихий WAV — для «разблокировки» аудио-элемента жестом.
function silentWavUri(): string {
  const sr = 8000;
  const n = 256; // ~0.03с тишины
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, n * 2, true);
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

/**
 * Разблокировать аудио-элемент «Слушать» ПРЯМО в обработчике клика (до любых
 * await). iOS даёт проигрывать медиа только рядом с жестом; после первой такой
 * проигровки один и тот же элемент можно запускать дальше без новых жестов.
 */
export function primeListenAudio(): void {
  if (typeof window === "undefined") return;
  // Главное: возобновить общий Web Audio контекст прямо в жесте — дальше
  // «Слушать» играет буферы через него без ограничений автозапуска iOS.
  resumeAudioContext();
  try {
    // Канонический iOS-анлок: проиграть пустой буфер через сам контекст в жесте.
    // Это надёжно «будит» контекст перед НОВЫМ кругом (после done он засыпает).
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state !== "running") void ctx.resume().catch(() => {});
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, 22050);
      b.connect(ctx.destination);
      b.start(0);
    }
  } catch {}
  try {
    // Фолбэк-путь на <audio>: тоже разблокируем звучащим тихим клипом.
    const a = getListenAudio();
    a.muted = false;
    a.volume = 1;
    a.src = silentWavUri();
    a.play().catch(() => {});
  } catch {}
}

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

  // Останавливаем предыдущее (и Web Audio, и <audio>).
  if (currentSource) {
    try { currentSource.stop(); } catch {}
    currentSource = null;
  }
  if (current) {
    current.pause();
    current = null;
  }

  const useServer = await checkServerTts();
  if (useServer) {
    // 1) Web Audio через разблокированный контекст — играет ВЫБРАННЫМ голосом
    //    даже при автоозвучке карточки (iOS блокирует new Audio() без жеста,
    //    из-за чего раньше карточку читал системный голос, а не Azure).
    const buf = await ensureBuffer(clean, voice);
    if (buf && getAudioContext()) {
      await playBufferAndWait(buf, rate);
      return;
    }
    // 2) Фолбэк на переиспользуемый <audio>.
    const url = await ensureAudio(clean, voice);
    if (url) {
      try {
        const audio = getListenAudio();
        audio.muted = false;
        audio.src = url;
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
    // 1) Web Audio — надёжно на iOS PWA: играем декодированный буфер через
    //    общий разблокированный контекст (без ограничений автозапуска).
    const buf = await ensureBuffer(clean, voice);
    if (signal?.aborted) return;
    if (buf && getAudioContext()) {
      await playBufferAndWait(buf, rate, signal);
      return;
    }
    // 2) Фолбэк на <audio> (если Web Audio недоступен/не декодировал).
    const url = await ensureAudio(clean, voice);
    if (signal?.aborted) return;
    if (url) {
      await new Promise<void>((resolve) => {
        const audio = getListenAudio();
        let done = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const cleanup = () => {
          if (timer) clearTimeout(timer);
          audio.removeEventListener("ended", finish);
          audio.removeEventListener("error", finish);
          signal?.removeEventListener("abort", onAbort);
        };
        const finish = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve();
        };
        const onAbort = () => {
          try {
            audio.pause();
          } catch {}
          finish();
        };
        try {
          audio.pause();
          audio.muted = false;
          audio.src = url;
          audio.playbackRate = Math.max(0.5, Math.min(2, rate));
          current = audio;
          audio.addEventListener("ended", finish, { once: true });
          audio.addEventListener("error", finish, { once: true });
          signal?.addEventListener("abort", onAbort, { once: true });
          // Защитный таймаут: если событие окончания/ошибки не пришло —
          // не подвисаем на этой карточке, идём дальше по очереди.
          timer = setTimeout(finish, 30000);
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
    // Оценка длительности речи + запас: некоторые браузеры (iOS Safari)
    // не всегда шлют onend — без таймаута цикл «Слушать» повиснет навсегда.
    const estimate = Math.min(30000, 1500 + clean.length * 90);
    const timer = setTimeout(() => finish(), estimate);
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
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
  // Греем именно Web Audio буфер (основной путь); падаем на objectURL.
  if (getAudioContext()) {
    const buf = await ensureBuffer(clean, voice);
    if (buf) return;
  }
  await ensureAudio(clean, voice);
}

/** Остановить текущее серверное аудио (для паузы/остановки режима «Слушать»). */
export function stopAudio(): void {
  if (currentSource) {
    try { currentSource.stop(); } catch {}
    try { currentSource.disconnect(); } catch {}
    currentSource = null;
  }
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
