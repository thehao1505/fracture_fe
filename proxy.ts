import { NextResponse, type NextRequest } from "next/server";
import { subdomainFromHost } from "@/lib/domain";
import { AuthExpiredError, refreshTokens } from "@/lib/auth/refresh";
import {
  clearSessionCookies,
  isAccessTokenExpiringSoon,
  readSessionTokens,
  writeSessionCookies,
  ACCESS_COOKIE,
  COOKIE_OPTIONS,
  PATHNAME_HEADER,
  REAUTH_PATH,
  REFRESH_GUARD_COOKIE,
  REFRESH_GUARD_MAX_AGE,
  type SessionTokens,
} from "@/lib/auth/tokens";

/**
 * §2 — authorization is binary (valid token or not). This only checks cookie
 * presence for routing UX; the Fracture API verifies the JWT on every call.
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
 * /dashboard — the JWT carries no role claim yet, so any signed-in user
 * currently passes it. Real admin authorization has to come from the backend
 * (a role/claim check) before this is safe to rely on. Session cookies are also
 * host-only (no `domain` attribute), so `admin.${ROOT_DOMAIN}` does not receive
 * them today — that gate needs cookie scoping before it can work at all.
 *
 * ---
 *
 * Refresh token (docs/FE_GUIDELINE_REFRESH_TOKEN.md): Proxy is the ONLY caller
 * of `/auth/refresh` (§6 requires exactly one). It has to be, because Server
 * Components cannot write cookies — a refresh whose rotated token can't be
 * persisted is a dead session (§0.1) — while Proxy runs before every render,
 * Server Action and Route Handler and can set cookies on any of those
 * responses. It works in two modes:
 *
 *   proactive: `at` is missing or nearly expired while `rt` is present → rotate
 *              now, forward the fresh token to the render pass, and hand the new
 *              pair to the browser via Set-Cookie.
 *   forced:    a 401 reached app code anyway (revoked mid-request, clock skew) →
 *              app code redirects to REAUTH_PATH, handled here, retried exactly
 *              once (§3.3) and otherwise hard logout.
 *
 * The refresh is one API call, only once per access-token lifetime, so the
 * latency Proxy adds is bounded — but it is on the request path. Do not add more
 * fetching here (see Next's "Proxy is not intended for slow data fetching").
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const subdomain = subdomainFromHost(host);

  // Public profile pages: no session involved, keep them off the auth path
  // entirely so a visitor never pays for a refresh.
  if (subdomain && subdomain !== "admin") {
    return NextResponse.rewrite(
      new URL(`/sites/${subdomain}${pathname}`, request.url),
    );
  }

  if (pathname === REAUTH_PATH) return forcedRefresh(request);

  const session = await ensureFreshAccessToken(request, pathname);

  if (subdomain === "admin") {
    if (!session.access) return finish(redirectToLogin(request), session);
    return finish(
      NextResponse.rewrite(new URL(`/admin${pathname}`, request.url), {
        request: { headers: forwardedHeaders(request, pathname) },
      }),
      session,
    );
  }

  if (pathname.startsWith("/dashboard") && !session.access) {
    return finish(redirectToLogin(request), session);
  }

  return finish(
    NextResponse.next({
      request: { headers: forwardedHeaders(request, pathname) },
    }),
    session,
  );
}

/**
 * Paths where a stale access token is not worth a refresh round-trip: they do
 * not call the API on the user's behalf, and a 401 there means "wrong password",
 * not "expired session" (§3.3).
 *
 * /logout is deliberately absent: `POST /auth/logout` needs a valid Bearer to
 * revoke the session (§1.3), so signing out after the access token expired has
 * to renew it first or the refresh token stays alive on the backend.
 */
const NO_REFRESH_PATHS = ["/login", "/register"];

interface SessionState {
  /** Access token the app code will see — the rotated one when we just refreshed. */
  access: string;
  /** Set when the pair rotated and the browser still needs the new cookies. */
  rotated: SessionTokens | null;
  /** Set on 401/400 from /auth/refresh → hard logout (§0.3). */
  expired: boolean;
}

/**
 * Rotates the pair when the access token is spent, then rewrites the request's
 * own `cookie` header so the render pass / action reads the fresh token in the
 * same round-trip (`RequestCookies.set` writes back into the headers, which
 * `NextResponse.next({ request: { headers } })` forwards).
 */
async function ensureFreshAccessToken(
  request: NextRequest,
  pathname: string,
): Promise<SessionState> {
  const { access, refresh } = readSessionTokens(request.cookies);

  const skip = NO_REFRESH_PATHS.some((path) => pathname.startsWith(path));
  const needsRefresh =
    Boolean(refresh) && (!access || isAccessTokenExpiringSoon(access));
  if (skip || !needsRefresh) return { access, rotated: null, expired: false };

  try {
    const tokens = await refreshTokens(refresh);
    request.cookies.set(ACCESS_COOKIE, tokens.access);
    return { access: tokens.access, rotated: tokens, expired: false };
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return { access: "", rotated: null, expired: true };
    }
    // Network error or 5xx: keep both tokens and carry on with whatever access
    // token we have (§0.4). A missing one lands on /login without wiping the
    // session, so the user is back in as soon as the API answers again.
    return { access, rotated: null, expired: false };
  }
}

function finish(response: NextResponse, session: SessionState): NextResponse {
  if (session.rotated) writeSessionCookies(response.cookies, session.rotated);
  if (session.expired) clearSessionCookies(response.cookies);
  return response;
}

/**
 * Forced refresh (REAUTH_PATH): the escape hatch for a 401 that reached app
 * code. Retries exactly once — the `rg` cookie proves a rotation happened
 * seconds ago, so a second visit means the session is genuinely dead (§3.3).
 */
async function forcedRefresh(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const { refresh } = readSessionTokens(request.cookies);
  const alreadyRetried = Boolean(
    request.cookies.get(REFRESH_GUARD_COOKIE)?.value,
  );

  if (!refresh || alreadyRetried) {
    return hardLogout(request, next);
  }

  try {
    const tokens = await refreshTokens(refresh);
    const response = NextResponse.redirect(new URL(next, request.url));
    writeSessionCookies(response.cookies, tokens);
    response.cookies.set(REFRESH_GUARD_COOKIE, "1", {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_GUARD_MAX_AGE,
    });
    return response;
  } catch (err) {
    if (err instanceof AuthExpiredError) return hardLogout(request, next);
    // §0.4 — the API is unreachable or broken, not the session. Keep the cookies
    // so retrying the same URL works once it recovers.
    return NextResponse.redirect(loginUrl(request, next, "network"));
  }
}

function hardLogout(request: NextRequest, next: string) {
  const response = NextResponse.redirect(loginUrl(request, next, "expired"));
  clearSessionCookies(response.cookies);
  return response;
}

function loginUrl(request: NextRequest, next: string, reason?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", next);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(loginUrl(request, request.nextUrl.pathname));
}

/** Only internal paths, so `next` can never be turned into an open redirect. */
function safeNextPath(raw: string | null): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

/**
 * Carries the pathname to the server so `reauthenticate()` and the login
 * redirect can preserve the deep link (Server Components cannot read the URL).
 */
function forwardedHeaders(request: NextRequest, pathname: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname + request.nextUrl.search);
  return headers;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
