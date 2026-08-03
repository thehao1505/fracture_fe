import { ImageResponse } from "next/og";
import { ApiError } from "@/lib/api/client";
import { getPublicProfile } from "@/lib/api/public";
import { safeImageUrl } from "@/lib/validation";

/**
 * Social preview card for a public profile. Shared profile links used to
 * unfurl with no image at all, which is a poor look for a product whose whole
 * job is being shared.
 */

export const alt = "fracture profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MAX_AVATAR_BYTES = 300_000; // Satori's whole bundle must stay under 500KB.

/**
 * Inline the avatar ourselves rather than handing Satori a remote URL: these
 * hosts are arbitrary, and a slow or broken one would fail the whole image.
 */
async function inlineAvatar(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_AVATAR_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let displayName = username;
  let bio = "";
  let avatar: string | null = null;
  try {
    const profile = (await getPublicProfile(username)).data;
    displayName = profile.display_name || `@${profile.username}`;
    bio = profile.bio ?? "";
    avatar = await inlineAvatar(safeImageUrl(profile.avatar_url));
  } catch (err) {
    // 404 → the page itself renders not-found; still return a valid card.
    if (!(err instanceof ApiError)) throw err;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 18% 18%, #6366f1 0%, transparent 45%), radial-gradient(circle at 82% 30%, #d946ef 0%, transparent 45%), radial-gradient(circle at 50% 100%, #8b5cf6 0%, transparent 50%)",
          padding: 72,
        }}
      >
        {avatar ? (
          /* Satori renders a plain <img>; next/image has no meaning here. */
          <img
            src={avatar}
            alt=""
            width={176}
            height={176}
            style={{
              width: 176,
              height: 176,
              borderRadius: 88,
              objectFit: "cover",
              border: "6px solid rgba(255,255,255,0.22)",
            }}
          />
        ) : (
          <div
            style={{
              width: 176,
              height: 176,
              borderRadius: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 84,
              fontWeight: 700,
              color: "#ffffff",
              backgroundColor: "rgba(255,255,255,0.14)",
              border: "6px solid rgba(255,255,255,0.22)",
            }}
          >
            {[...displayName][0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          {displayName}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 30,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          @{username}
        </div>

        {bio && (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              maxWidth: 820,
              fontSize: 26,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.75)",
              textAlign: "center",
            }}
          >
            {bio.length > 120 ? `${bio.slice(0, 117)}…` : bio}
          </div>
        )}

        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 44,
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          fracture
        </div>
      </div>
    ),
    size,
  );
}
