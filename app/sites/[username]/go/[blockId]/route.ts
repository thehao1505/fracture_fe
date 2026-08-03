import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { recordClick } from "@/lib/api/public";
import { subdomainFromHost } from "@/lib/domain";
import { isHttpUrl } from "@/lib/validation";

/**
 * §7.12 — click flow is server-mediated: POST the click to the API (which
 * increments click_count) and redirect the visitor to the returned URL.
 * Works without client-side JavaScript.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; blockId: string }> },
) {
  const { username, blockId } = await params;

  // Same rule as page.tsx: this path only exists as a proxy.ts rewrite
  // target for {username}.${ROOT_DOMAIN}, not for direct root-domain access.
  const host = request.headers.get("host") ?? "";
  if (subdomainFromHost(host) !== username) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { url } = await recordClick(username, blockId);
    // §7.13 — the API only stores http/https URLs; verify anyway.
    if (isHttpUrl(url)) {
      return NextResponse.redirect(url);
    }
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    // 400/404: block was hidden, deleted, or isn't a link — fall through.
  }

  // Back to this user's own subdomain root (proxy.ts) — request.url's origin
  // is theirs regardless of the rewrite, only the path needs replacing.
  return NextResponse.redirect(new URL("/", request.url));
}
