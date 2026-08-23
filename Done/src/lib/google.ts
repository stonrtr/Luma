/* Клиентская интеграция с Google Calendar через Google Identity Services (GIS).
   Без сервера: токен доступа получаем прямо в браузере, события создаём через REST API.
   Client ID — публичный (не секрет), origin авторизуется в Google Cloud Console. */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google?: any }
}

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

let gisReady: Promise<void> | null = null;
let tokenClient: any = null;
let accessToken = "";
let tokenExp = 0;

export function isConnected(): boolean {
  return !!accessToken && Date.now() < tokenExp;
}

function loadGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Не удалось загрузить Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisReady;
}

/** Запрос токена. interactive=true — показать окно согласия; false — тихо, если уже разрешено. */
export async function connectGoogle(clientId: string, interactive: boolean): Promise<boolean> {
  await loadGis();
  return new Promise((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: any) => {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          tokenExp = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          resolve(true);
        } else {
          resolve(false);
        }
      },
      error_callback: () => resolve(false),
    });
    try {
      tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch {
      resolve(false);
    }
  });
}

export function disconnectGoogle() {
  const t = accessToken;
  accessToken = "";
  tokenExp = 0;
  if (t && window.google?.accounts?.oauth2?.revoke) {
    try { window.google.accounts.oauth2.revoke(t, () => {}); } catch { /* ignore */ }
  }
}

async function api(path: string, method: string, body?: any): Promise<any> {
  const r = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { accessToken = ""; tokenExp = 0; throw new Error("token expired"); }
  if (method === "DELETE") return r.ok || r.status === 410;
  return r.json();
}

export interface CalTask {
  title: string;
  date: string;            // YYYY-MM-DD
  timeStart?: string | null;
  timeEnd?: string | null;
  notes?: string;
}

function eventBody(t: CalTask) {
  if (t.timeStart) {
    const end = t.timeEnd || addMin(t.timeStart, 60);
    return {
      summary: t.title,
      description: t.notes || undefined,
      start: { dateTime: `${t.date}T${t.timeStart}:00`, timeZone: TZ },
      end: { dateTime: `${t.date}T${end}:00`, timeZone: TZ },
    };
  }
  return {
    summary: t.title,
    description: t.notes || undefined,
    start: { date: t.date },
    end: { date: nextDay(t.date) },
  };
}

export async function createEvent(t: CalTask): Promise<string | null> {
  const res = await api("/calendars/primary/events", "POST", eventBody(t));
  return res?.id ?? null;
}
export async function updateEvent(eventId: string, t: CalTask): Promise<boolean> {
  const res = await api(`/calendars/primary/events/${encodeURIComponent(eventId)}`, "PATCH", eventBody(t));
  return !!res?.id;
}
export async function deleteEvent(eventId: string): Promise<boolean> {
  try { return await api(`/calendars/primary/events/${encodeURIComponent(eventId)}`, "DELETE"); }
  catch { return false; }
}

/** Хэш синхронизируемых полей — чтобы обновлять событие только при реальном изменении. */
export function taskHash(t: CalTask): string {
  return [t.title, t.date, t.timeStart || "", t.timeEnd || "", t.notes || ""].join("|");
}

function nextDay(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function addMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + min);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
}
