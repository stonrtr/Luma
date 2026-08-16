// Звуковые эффекты сессии. Воспроизводятся по жесту пользователя
// (клик/клавиша), поэтому autoplay-политики браузера не мешают.

export type Sfx = "flip" | "success" | "so-so" | "mistake";

const FILES: Record<Sfx, string> = {
  flip: "/sounds/flip.mp3",
  success: "/sounds/success.mp3", // «Легко»
  "so-so": "/sounds/so-so.mp3", // «С трудом»
  mistake: "/sounds/mistake.mp3", // «Не вспомнил»
};

const VOLUME = 0.55;
const cache = new Map<Sfx, HTMLAudioElement>();

function get(name: Sfx): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let a = cache.get(name);
  if (!a) {
    a = new Audio(FILES[name]);
    a.volume = VOLUME;
    a.preload = "auto";
    cache.set(name, a);
  }
  return a;
}

/** Проиграть эффект (перезапуская, если уже играет). Тихо гасит любые ошибки. */
export function playSfx(name: Sfx): void {
  try {
    const a = get(name);
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* звук — best effort */
  }
}
