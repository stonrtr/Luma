// Звуковые эффекты сессии на Web Audio API.
//
// Почему не <audio>: HTMLAudioElement на мобильных/PWA часто «резолвит» play(),
// но остаётся на паузе (нет активного аудио-контекста), из-за чего звука нет.
// Web Audio надёжнее: один AudioContext, разблокировка на первом жесте
// пользователя, заранее декодированные буферы, мгновенное проигрывание.

export type Sfx = "flip" | "success" | "so-so" | "mistake";

const FILES: Record<Sfx, string> = {
  flip: "/sounds/flip.mp3",
  success: "/sounds/success.mp3", // «Легко»
  "so-so": "/sounds/so-so.mp3", // «С трудом»
  mistake: "/sounds/mistake.mp3", // «Не вспомнил»
};

const VOLUME = 0.55;
// Индивидуальная громкость: flip.mp3 записан очень тихо (пик ~0.08),
// поэтому усиливаем его, чтобы перелистывание было слышно.
const GAIN: Record<Sfx, number> = {
  flip: 3.2,
  success: 1,
  "so-so": 1,
  mistake: 1,
};

let ctx: AudioContext | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
const loading = new Map<Sfx, Promise<AudioBuffer | null>>();
let unlockBound = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

function loadBuffer(name: Sfx): Promise<AudioBuffer | null> {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name)!);
  const existing = loading.get(name);
  if (existing) return existing;
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  const p = fetch(FILES[name])
    .then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => {
      buffers.set(name, buf);
      loading.delete(name);
      return buf;
    })
    .catch(() => {
      loading.delete(name);
      return null;
    });
  loading.set(name, p);
  return p;
}

function playBuffer(name: Sfx, buf: AudioBuffer): void {
  const c = getCtx();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = VOLUME * (GAIN[name] ?? 1);
  src.connect(gain).connect(c.destination);
  src.start(0);
}

/** Разблокировать аудио на первом жесте пользователя и заранее прогреть буферы. */
export function primeSfx(): void {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    // Прогреваем буферы, чтобы первый звук проиграл без задержки.
    (Object.keys(FILES) as Sfx[]).forEach((n) => void loadBuffer(n));
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: false });
  window.addEventListener("keydown", unlock, { once: false });
  window.addEventListener("touchstart", unlock, { once: false });
}

/** Проиграть эффект. Best-effort: тихо гасит любые ошибки. */
export function playSfx(name: Sfx): void {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    const buf = buffers.get(name);
    if (buf) {
      playBuffer(name, buf);
      return;
    }
    // Буфер ещё не готов — загрузим и проиграем, как только декодируется.
    void loadBuffer(name).then((b) => {
      if (b) playBuffer(name, b);
    });
  } catch {
    /* звук — best effort */
  }
}
