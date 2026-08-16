import "server-only";
import { db } from "@/server/db";

// --- Конфигурация из окружения ---
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
export const GOOGLE_REDIRECT_URI = `${APP_URL}/api/google/callback`;

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// URL согласия Google (OAuth consent)
export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",       // чтобы получить refresh_token
    prompt: "consent",            // всегда выдавать refresh_token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

// Обмен кода на токены
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return res.json();
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email ?? null;
  } catch {
    return null;
  }
}

// Действительный access-token пользователя (с авто-обновлением). null — не подключён.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!isGoogleConfigured()) return null;
  const acc = await db.googleAccount.findUnique({ where: { userId } });
  if (!acc) return null;

  // ещё жив (с запасом в минуту)
  if (acc.expiresAt.getTime() > Date.now() + 60_000) return acc.accessToken;

  try {
    const t = await refreshAccessToken(acc.refreshToken);
    const expiresAt = new Date(Date.now() + t.expires_in * 1000);
    await db.googleAccount.update({
      where: { userId },
      data: { accessToken: t.access_token, expiresAt, ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}) },
    });
    return t.access_token;
  } catch {
    return null;
  }
}
