import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@/lib/session";

/**
 * Clears the session cookie and lands on /login. Server components can't
 * mutate cookies mid-render, so pages that hit a 401 redirect here (§8.7 —
 * tokens hard-expire after 24h with no refresh flow).
 */
export async function GET(request: Request) {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  return NextResponse.redirect(new URL("/login", request.url));
}
