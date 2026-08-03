import { NextResponse } from "next/server";
import { fetchOgImage } from "@/lib/link-preview";
import { getSessionToken } from "@/lib/session";

/** Dashboard-only helper: fetch a URL's og:image to suggest as a link block's thumbnail. */
export async function GET(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const thumbnail = await fetchOgImage(url);
  return NextResponse.json({ thumbnail });
}
