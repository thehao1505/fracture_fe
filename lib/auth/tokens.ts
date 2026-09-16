/**
 * Token + cookie primitives for the refresh-token flow
 * (docs/FE_GUIDELINE_REFRESH_TOKEN.md).
 *
 * Deliberately free of `next/headers`: this module is imported by proxy.ts as
 * well as by Server Components, Server Actions and Route Handlers, so it may
 * only touch plain cookie jars handed to it by the caller.
 *
 * The guideline targets a browser SPA (localStorage + fetch interceptor). Here
 * the browser never holds a token, so the invariants map like this:
 *
 *   guideline (§3)                    this app
 *   --------------------------------  ------------------------------------------
 *   localStorage `fracture.auth`      httpOnly cookies `at` + `rt`
 *   storage.save({access, refresh})   writeSessionCookies() — still the ONLY writer
 *   in-tab single-flight promise      in-process promise map (lib/auth/refresh.ts)
 *   navigator.locks cross-tab lock    unnecessary: every tab shares one server-side
 *                                     refresh path, and none of them owns a token
 *   BroadcastChannel logout fan-out   unnecessary: the cookie is the only session
 *                                     state, so clearing it logs out every tab on
 *                                     its next request
 */

/**
 * Path Proxy intercepts to force a refresh after a 401 reached app code
 * (`forcedRefresh()` in proxy.ts, `reauthenticate()` in ./session.ts).
 */
export const REAUTH_PATH = "/session/refresh";

/** Request header Proxy attaches so redirects can preserve the deep link. */
export const PATHNAME_HEADER = "x-pathname";

/** Access token (JWT). Cookie lifetime tracks the token's own `exp`. */
export const ACCESS_COOKIE = "at";

/** Refresh token (opaque `"<sessionID>.<secret>"`, §2). */
export const REFRESH_COOKIE = "rt";

/**
 * One-shot marker written after a forced refresh (§3.3 "retry exactly once").
 * Seeing it on a second forced-refresh request means the app got a 401 straight
 * after a successful rotation → the session is genuinely dead, hard logout.
 */
export const REFRESH_GUARD_COOKIE = "rg";
export const REFRESH_GUARD_MAX_AGE = 10; // seconds

export interface SessionTokens {
  access: string;
  refresh: string;
}

interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

/**
 * Read side: satisfied by `next/headers`' cookie store, `NextRequest.cookies`
 * and `NextResponse.cookies` alike.
 */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Write side: attribute-carrying jars only — `next/headers`' store (Server
 * Actions / Route Handlers) and `NextResponse.cookies` (Proxy). Request cookies
 * are excluded on purpose; they cannot carry httpOnly/maxAge.
 */
export interface CookieWriter {
  set(name: string, value: string, options?: CookieOptions): unknown;
}

export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * §2 hard cap: `REFRESH_TOKEN_MAX_LIFETIME` (90 days) is the longest a session
 * can possibly live, so the cookie never expires before the token might. The
 * sliding window is the backend's business — every rotation rewrites the cookie
 * and the backend 401s the moment the token is actually dead (§1.2).
 */
const REFRESH_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

/** Only used when `exp` is unreadable; §5 forbids hardcoding the real TTL. */
const ACCESS_COOKIE_FALLBACK_MAX_AGE = 60 * 60;

/**
 * The ONE place allowed to write session cookies (§3.1). There is no
 * `setAccessToken`/`setRefreshToken` anywhere in this codebase: writing half the
 * pair is the number-one cause of reuse detection.
 */
export function writeSessionCookies(
  jar: CookieWriter,
  tokens: SessionTokens,
): void {
  jar.set(ACCESS_COOKIE, tokens.access, {
    ...COOKIE_OPTIONS,
    maxAge: accessCookieMaxAge(tokens.access),
  });

  if (tokens.refresh) {
    jar.set(REFRESH_COOKIE, tokens.refresh, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
    return;
  }

  // A login/refresh response without `refresh_token` (older backend) starts a
  // session that cannot be renewed — drop any refresh token from the previous
  // session instead of keeping a value that is already dead.
  expire(jar, REFRESH_COOKIE);
}

/** Hard logout (§3.4): storage is cleared first, everything else follows. */
export function clearSessionCookies(jar: CookieWriter): void {
  expire(jar, ACCESS_COOKIE);
  expire(jar, REFRESH_COOKIE);
  expire(jar, REFRESH_GUARD_COOKIE);
}

export function readSessionTokens(jar: CookieReader): SessionTokens {
  return {
    access: jar.get(ACCESS_COOKIE)?.value ?? "",
    refresh: jar.get(REFRESH_COOKIE)?.value ?? "",
  };
}

const DEFAULT_SKEW_MS = 60_000;

/**
 * §0.1/§2 — the access token is renewed slightly before it expires so a request
 * never races its own expiry. `exp` comes from the JWT because the TTL is a
 * backend env value that will change (§5 forbids hardcoding it).
 *
 * The skew is capped at a quarter of the token's own lifetime when `iat` is
 * present: with `JWT_EXPIRY=30s` (the §6 manual-test setting) a flat 60s skew
 * would consider every token expiring and rotate on every single request.
 */
export function isAccessTokenExpiringSoon(
  accessToken: string,
  skewMs = DEFAULT_SKEW_MS,
): boolean {
  const claims = readLifetime(accessToken);
  if (claims == null) return true; // unreadable → treat as needing a refresh
  const cap = claims.lifetimeMs == null ? skewMs : claims.lifetimeMs / 4;
  return claims.exp * 1000 - Date.now() < Math.min(skewMs, cap);
}

function accessCookieMaxAge(accessToken: string): number {
  const claims = readLifetime(accessToken);
  if (claims == null) return ACCESS_COOKIE_FALLBACK_MAX_AGE;
  // Cookie disappears when the token dies, so a missing `at` with a present
  // `rt` is exactly the "needs refresh" signal proxy.ts looks for.
  return Math.max(1, Math.floor(claims.exp - Date.now() / 1000));
}

/**
 * Decodes `exp` (and `iat` when present) and nothing else. Never use JWT claims
 * for authorization — the FE cannot verify the signature (§5); the API checks it
 * on every call.
 */
function readLifetime(
  token: string,
): { exp: number; lifetimeMs: number | null } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { exp?: unknown; iat?: unknown };
    if (typeof claims.exp !== "number") return null;
    const lifetimeMs =
      typeof claims.iat === "number" && claims.iat < claims.exp
        ? (claims.exp - claims.iat) * 1000
        : null;
    return { exp: claims.exp, lifetimeMs };
  } catch {
    return null;
  }
}

function expire(jar: CookieWriter, name: string): void {
  // Set-with-maxAge-0 rather than delete(): guarantees the attributes (path,
  // secure, …) match the cookie that was written, so it actually goes away.
  jar.set(name, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}
