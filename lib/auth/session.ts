import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearSessionCookies,
  readSessionTokens,
  writeSessionCookies,
  PATHNAME_HEADER,
  REAUTH_PATH,
  type SessionTokens,
} from "./tokens";

/**
 * Session access for app code (Server Components, Server Actions, Route
 * Handlers) — docs/FE_GUIDELINE_REFRESH_TOKEN.md.
 *
 * App code never calls `/auth/refresh`. Proxy does, before the request reaches
 * here (proxy.ts), which is what keeps the guideline's "exactly one call site"
 * rule true in a framework where Server Components cannot write cookies: a
 * refresh whose rotated token can't be persisted kills the session.
 *
 * So a 401 from an authed call at this layer means the session died for real
 * (revoked, or Proxy's refresh failed on the network) — send it through
 * `reauthenticate()`, which is Proxy's forced-refresh path and ends in either a
 * revived session or a hard logout.
 */

export async function getSessionTokens(): Promise<SessionTokens> {
  return readSessionTokens(await cookies());
}

/** Presence check only — proves nothing about validity (§2d, the API decides). */
export async function hasSession(): Promise<boolean> {
  const { access, refresh } = await getSessionTokens();
  return Boolean(access || refresh);
}

/**
 * Writes both tokens (§3.1). Server Actions and Route Handlers only — Next.js
 * throws if called during a Server Component render, and swallowing that error
 * would silently discard a rotated token.
 */
export async function setSession(tokens: SessionTokens): Promise<void> {
  writeSessionCookies(await cookies(), tokens);
}

/** Hard logout (§3.4): cookies go first, whatever the backend said. */
export async function clearSession(): Promise<void> {
  clearSessionCookies(await cookies());
}

/**
 * Access token for an authed API call, or a redirect. Safe in Server Components:
 * it only reads.
 */
export async function requireAccessToken(): Promise<string> {
  const { access, refresh } = await getSessionTokens();
  if (access) return access;

  // Proxy refreshes ahead of the render, so an absent access token with a live
  // refresh token means its refresh failed on the network (§0.4 — tokens are
  // kept). Retry through the forced path so the user gets a real error instead
  // of a silent logout.
  if (refresh) await reauthenticate();

  redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
}

/**
 * Hand a 401 from an authed call to Proxy's forced refresh: it retries exactly
 * once (guarded by the `rg` cookie) and hard-logs-out if the session is dead.
 * Never returns.
 */
export async function reauthenticate(next?: string): Promise<never> {
  const target = next ?? (await currentPath());
  redirect(`${REAUTH_PATH}?next=${encodeURIComponent(target)}`);
}

async function currentPath(): Promise<string> {
  const value = (await headers()).get(PATHNAME_HEADER);
  // Only internal paths, same rule as the post-login redirect.
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}
