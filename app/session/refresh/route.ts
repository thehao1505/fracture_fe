import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

/**
 * Fallback for REAUTH_PATH. Proxy normally answers this path itself (see
 * `forcedRefresh()` in proxy.ts) and this handler never runs; it exists so a
 * Proxy that is disabled or errored degrades into a hard logout instead of a
 * 404.
 *
 * It deliberately does NOT refresh: Proxy owns the only `/auth/refresh` call
 * site (refresh guideline §6), and a second one could race it into reuse
 * detection — which would revoke the entire session (§0.2).
 */
export async function GET(request: Request) {
  await clearSession();

  const url = new URL("/login", request.url);
  url.searchParams.set("reason", "expired");
  return NextResponse.redirect(url);
}
