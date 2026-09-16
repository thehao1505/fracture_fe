import { NextResponse } from "next/server";
import { fetchOgImage } from "@/lib/link-preview";
import { getSessionTokens } from "@/lib/auth/session";

/** Dashboard-only helper: fetch a URL's og:image to suggest as a link block's thumbnail. */
export async function GET(request: Request) {
  // Presence check only: this handler calls no Fracture endpoint, so there is
  // nothing to refresh — Proxy has already done it if it was needed.
  const { access } = await getSessionTokens();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const thumbnail = await fetchOgImage(url);
  return NextResponse.json({ thumbnail });
}
