/**
 * Root domain of the deployment, derived from NEXT_PUBLIC_SITE_URL so there is
 * one source of truth for both the metadata base and subdomain routing.
 * Locally this is "localhost:3000" — `{name}.localhost` resolves to loopback
 * in every modern browser, so `haonguyen.localhost:3000` / `admin.localhost:3000`
 * work without editing /etc/hosts.
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const ROOT_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

const PROTOCOL = SITE_URL.startsWith("https://") ? "https" : "http";

/** Absolute origin of the root marketing domain (login, dashboard, admin.*). */
export function rootOrigin(): string {
  return SITE_URL;
}

/** Absolute origin of a user's public profile subdomain. */
export function profileOrigin(username: string): string {
  return `${PROTOCOL}://${username}.${ROOT_DOMAIN}`;
}

/**
 * Subdomain label from a request Host header, or null for the root domain
 * (with or without "www."). Drives proxy.ts's rewrite into `_sites/[username]`
 * (any other label) or `_admin` (the reserved "admin" label).
 */
export function subdomainFromHost(host: string): string | null {
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  const suffix = `.${ROOT_DOMAIN}`;
  return host.endsWith(suffix) ? host.slice(0, -suffix.length) : null;
}
