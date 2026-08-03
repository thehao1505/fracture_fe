import { headers } from "next/headers";
import { ROOT_DOMAIN } from "./domain";

/**
 * Absolute origin of the current request. Always derived from the forwarded
 * host rather than a fixed configured URL — with subdomain routing (a
 * user's `{username}.${ROOT_DOMAIN}` or `admin.${ROOT_DOMAIN}`) a single
 * fixed origin can't represent every host the app is served from, and the
 * host header still reflects the real origin after proxy.ts's rewrite.
 */
export async function getSiteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ROOT_DOMAIN;
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${protocol}://${host}`;
}
