import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/dal";
import { db } from "@/server/db";
import { exchangeCodeForTokens, fetchGoogleEmail, isGoogleConfigured, APP_URL } from "@/server/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(`${APP_URL}/login`, 302);
  if (!isGoogleConfigured()) return Response.redirect(`${APP_URL}/settings?google=unconfigured`, 302);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const c = await cookies();
  const savedState = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");

  if (error || !code || !state || state !== savedState) {
    return Response.redirect(`${APP_URL}/settings?google=error`, 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const email = await fetchGoogleEmail(tokens.access_token);

    await db.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
      },
      update: {
        googleEmail: email,
        accessToken: tokens.access_token,
        expiresAt,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      },
    });

    return Response.redirect(`${APP_URL}/settings?google=connected`, 302);
  } catch {
    return Response.redirect(`${APP_URL}/settings?google=error`, 302);
  }
}
