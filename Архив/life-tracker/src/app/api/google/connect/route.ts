import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/dal";
import { buildAuthUrl, isGoogleConfigured, APP_URL } from "@/server/google/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(`${APP_URL}/login`, 302);
  if (!isGoogleConfigured()) return Response.redirect(`${APP_URL}/settings?google=unconfigured`, 302);

  const state = crypto.randomUUID();
  const c = await cookies();
  c.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: APP_URL.startsWith("https"), maxAge: 600, path: "/" });

  return Response.redirect(buildAuthUrl(state), 302);
}
