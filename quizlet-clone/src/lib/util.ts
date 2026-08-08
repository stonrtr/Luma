export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: T[], n: number, exclude?: T): T[] {
  return shuffle(arr.filter((x) => x !== exclude)).slice(0, n);
}

export function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const dec = Math.floor((ms % 1000) / 100);
  return `${m > 0 ? m + ":" : ""}${m > 0 ? String(rem).padStart(2, "0") : rem}.${dec}`;
}

export function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

// Normalize an answer for lenient comparison in Learn/Test/Spell
export function normalizeAnswer(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(a |an |the |to )/, "");
}

export function isCorrect(input: string, answer: string) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(answer);
  if (!a) return false;
  // accept any of the "/"-separated alternatives
  return answer
    .split("/")
    .map((x) => normalizeAnswer(x))
    .some((alt) => alt === a) || a === b;
}
