import { lookup } from "node:dns/promises";
import { isHttpUrl } from "./validation";

/**
 * Auto-fills the "thumbnail" field on a link block from the target page's
 * og:image (falling back to twitter:image) — the user can still paste their
 * own image URL over it, this is just a convenience default.
 */

const FETCH_TIMEOUT_MS = 3_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 500_000; // og:image lives in <head>, well within this
const USER_AGENT = "Mozilla/5.0 (compatible; fracturebot/1.0; +link-preview)";

/**
 * The server fetches whatever URL a user pastes into the dashboard — a
 * textbook SSRF vector (localhost, private ranges, cloud metadata IPs). Every
 * hop (initial host and each redirect target) is resolved and checked here
 * before being fetched; a redirect to a blocked address is refused rather
 * than followed.
 */
function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice("::ffff:".length), 4);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") throw new Error("blocked host");
  const { address, family } = await lookup(hostname);
  if (isPrivateAddress(address, family)) throw new Error("blocked host");
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractMetaContent(html: string, keys: string[]): string | null {
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  const propertyRegex = /(?:property|name)\s*=\s*["']([^"']+)["']/i;
  const contentRegex = /content\s*=\s*["']([^"']*)["']/i;

  for (const tag of html.match(metaTagRegex) ?? []) {
    const property = propertyRegex.exec(tag)?.[1]?.toLowerCase();
    if (!property || !keys.includes(property)) continue;
    const content = contentRegex.exec(tag)?.[1];
    if (content) return content;
  }
  return null;
}

/** Resolves the current best-guess preview image for a user-supplied URL, or null if none was found. */
export async function fetchOgImage(rawUrl: string): Promise<string | null> {
  if (!isHttpUrl(rawUrl)) return null;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      await assertPublicHost(current.hostname);
    } catch {
      return null;
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
      return null;
    }

    const html = await readCapped(response, MAX_HTML_BYTES);
    const found = extractMetaContent(html, ["og:image", "og:image:url", "twitter:image"]);
    if (!found) return null;

    try {
      const resolved = new URL(found, current).toString();
      return isHttpUrl(resolved) ? resolved : null;
    } catch {
      return null;
    }
  }

  return null; // too many redirects
}
