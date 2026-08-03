import { NextResponse, type NextRequest } from "next/server";
import { subdomainFromHost } from "@/lib/domain";

const TOKEN_COOKIE = "at";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * §2 — authorization is binary (valid token or not). This only checks cookie
 * presence for routing UX; the Fracture API verifies the JWT on every call.
 * A present-but-expired cookie still reaches the page, whose API call 401s
 * and sends the user to /logout → /login (no refresh flow exists, §8.7).
 *
 * Subdomain routing: `{username}.${ROOT_DOMAIN}` rewrites into `sites/
 * [username]`, and the reserved `admin.${ROOT_DOMAIN}` label into `admin`.
 * `sites/[username]` and `admin` are still ordinary routable paths (Next has
 * no "route but only via rewrite" convention — a "_"-prefixed private folder
 * is opted out of routing *entirely*, including as a rewrite target), so
 * each page/route under them independently checks the host itself
 * (`subdomainFromHost(host)` must match) and 404s otherwise — that's what
 * actually stops `${ROOT_DOMAIN}/sites/haonguyen` or `${ROOT_DOMAIN}/admin`
 * from working directly on the root domain.
 *
 * Note: the admin gate below only proves *a* valid session exists, same as
 * /dashboard — the JWT carries no role claim yet (lib/session.ts), so any
 * signed-in user currently passes it. Real admin authorization has to come
 * from the backend (a role/claim check) before this is safe to rely on.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const subdomain = subdomainFromHost(host);
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (subdomain === "admin") {
    if (!hasToken) return redirectToLogin(request);
    return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url));
  }

  if (subdomain) {
    return NextResponse.rewrite(
      new URL(`/sites/${subdomain}${pathname}`, request.url),
    );
  }

  if (pathname.startsWith("/dashboard") && !hasToken) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
