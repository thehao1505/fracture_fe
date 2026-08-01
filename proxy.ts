import { NextResponse, type NextRequest } from "next/server";

const TOKEN_COOKIE = "fracture_token";

/**
 * §2 — authorization is binary (valid token or not). This only checks cookie
 * presence for routing UX; the Fracture API verifies the JWT on every call.
 * A present-but-expired cookie still reaches the page, whose API call 401s
 * and sends the user to /logout → /login (no refresh flow exists, §8.7).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (!hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
