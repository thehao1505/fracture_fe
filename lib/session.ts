import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * JWT session handling (FE_GUIDELINE.md §2).
 * The 24h access token lives in an httpOnly cookie; there is no refresh flow —
 * on 401 we clear the cookie and send the user back to /login (§6, §8.7).
 */

export const TOKEN_COOKIE = "at";

const TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60; // JWT_EXPIRY default "24h" (§2)

export async function setSessionToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
}

export async function clearSessionToken(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value ?? null;
}

/** For server components/actions that require auth. Redirects when absent. */
export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  return token;
}

export interface SessionClaims {
  uid: string;
  email: string;
}

/**
 * §2 — the JWT payload carries `uid` and `email`; decoding client/server-side
 * is informational only (the API verifies the signature on every call).
 */
export function decodeSessionClaims(token: string): SessionClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json) as Partial<SessionClaims>;
    if (typeof claims.uid !== "string" || typeof claims.email !== "string") {
      return null;
    }
    return { uid: claims.uid, email: claims.email };
  } catch {
    return null;
  }
}
