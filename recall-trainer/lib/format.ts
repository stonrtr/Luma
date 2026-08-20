// Чистые форматтеры — безопасны и на сервере, и на клиенте.

export function fmtTimecode(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`;
}

export function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return new Date(iso).toLocaleDateString("ru");
  if (d >= 1) return `${d} дн назад`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h} ч назад`;
  const m = Math.floor(diff / 60000);
  if (m >= 1) return `${m} мин назад`;
  return "только что";
}
