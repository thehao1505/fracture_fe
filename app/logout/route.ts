import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/api/auth";
import { clearSession, getSessionTokens } from "@/lib/auth/session";

/**
 * Revokes the session server-side, clears both cookies and lands on /login.
 * Server Components can't mutate cookies mid-render, so pages that need to log
 * the user out redirect here.
 *
 * Refresh guideline §3.4: the cookies go regardless of what `/auth/logout`
 * answers — the backend fails open when Redis is down (§2d), so a client that
 * keeps its tokens after a failed logout call is still logged in.
 */
export async function GET(request: Request) {
  const { access } = await getSessionTokens();

  try {
    if (access) await revokeSession(access);
  } catch {
    // Network error or 5xx: the refresh token may survive on the backend, but
    // there is nothing more we can do from here and nothing that justifies
    // keeping the cookies.
  } finally {
    await clearSession();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
