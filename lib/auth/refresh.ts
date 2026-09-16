import { refreshSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { SessionTokens } from "./tokens";

/**
 * The single-flight guard around `POST /auth/refresh`
 * (docs/FE_GUIDELINE_REFRESH_TOKEN.md §3.2 — "phần quan trọng nhất").
 *
 * Refresh tokens are single-use: sending a rotated one makes the backend treat
 * it as stolen and revoke the whole session (§0.2, §2c). Two mechanisms keep
 * that from happening, both keyed by the refresh token value so unrelated
 * sessions never share state:
 *
 *  1. `inflight` — concurrent callers holding the same refresh token await one
 *     promise. Replaces the guideline's in-tab promise; also covers what
 *     `navigator.locks` did for the SPA, because parallel tabs now land in the
 *     same server process instead of in separate JS heaps.
 *
 *  2. `rotated` — a short grace window mapping an already-spent refresh token to
 *     the tokens it produced. A request that was already in flight with the old
 *     cookie (browser hadn't received the new `Set-Cookie` yet) gets the new
 *     pair from memory instead of tripping reuse detection. This is the
 *     server-side stand-in for the SPA's "re-read storage after winning the
 *     lock" step (§3.2), which is impossible here: each request carries its own
 *     immutable cookie snapshot.
 *
 * Limits, stated plainly: this is per-process memory. Two Next.js instances
 * behind a load balancer have separate maps, so a refresh racing across
 * instances can still trip reuse detection. Deploy single-instance, use sticky
 * sessions, or move both maps to shared storage before scaling out.
 *
 * Only Proxy calls this (see proxy.ts) — one call site, as §6 requires.
 */

export class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

const inflight = new Map<string, Promise<SessionTokens>>();

interface RotatedEntry {
  tokens: SessionTokens;
  at: number;
}

const rotated = new Map<string, RotatedEntry>();
const ROTATED_TTL_MS = 60_000;
const ROTATED_MAX_ENTRIES = 1_000;

/**
 * Exchanges a refresh token for a fresh pair. Throws:
 *  - `AuthExpiredError` on 401/400 → hard logout, no retry (§0.3, §1.2)
 *  - `ApiError` on network failure or 5xx → keep the tokens, let the user retry
 *    (§0.4). Never confuse the two: that is what logs people out on flaky wifi.
 *
 * Does not write cookies; the caller owns the response and is the only one that
 * can. Callers MUST persist what they get back — a rotated token that is not
 * stored is a dead session (the grace window above buys ~60s to recover).
 */
export function refreshTokens(refreshToken: string): Promise<SessionTokens> {
  const alreadyRotated = readRotated(refreshToken);
  if (alreadyRotated) return Promise.resolve(alreadyRotated);

  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const pending = performRefresh(refreshToken).finally(() => {
    // Always release, including on failure: a stuck entry would pin one network
    // error forever (§3.2 "reset trong finally").
    inflight.delete(refreshToken);
  });
  inflight.set(refreshToken, pending);
  return pending;
}

async function performRefresh(refreshToken: string): Promise<SessionTokens> {
  let tokens: SessionTokens;
  try {
    const res = await refreshSession({ refresh_token: refreshToken });
    tokens = { access: res.access_token, refresh: res.refresh_token };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
      // 400 = we sent a malformed body (FE bug), 401 = session revoked, expired,
      // past the 90-day cap, or already rotated. Both are unrecoverable (§1.2).
      throw new AuthExpiredError(`refresh rejected: ${err.status}`);
    }
    throw err;
  }

  rememberRotation(refreshToken, tokens);
  return tokens;
}

function readRotated(refreshToken: string): SessionTokens | null {
  const entry = rotated.get(refreshToken);
  if (!entry) return null;
  if (Date.now() - entry.at > ROTATED_TTL_MS) {
    rotated.delete(refreshToken);
    return null;
  }
  // Not deleted on read: several stale-cookie requests may arrive in a row.
  return entry.tokens;
}

function rememberRotation(spent: string, tokens: SessionTokens): void {
  pruneRotated();
  rotated.set(spent, { tokens, at: Date.now() });
}

function pruneRotated(): void {
  const now = Date.now();
  for (const [key, entry] of rotated) {
    if (now - entry.at > ROTATED_TTL_MS) rotated.delete(key);
  }
  // Bound the map even if something pathological keeps it hot: oldest first,
  // since Map preserves insertion order.
  while (rotated.size >= ROTATED_MAX_ENTRIES) {
    const oldest = rotated.keys().next();
    if (oldest.done) break;
    rotated.delete(oldest.value);
  }
}
