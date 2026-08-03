import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getPublicProfile } from "@/lib/api/public";
import type { PublicProfile } from "@/lib/api/types";
import { resolveAppearance } from "@/lib/appearance";
import { rootOrigin, subdomainFromHost } from "@/lib/domain";
import { getSiteOrigin } from "@/lib/site-url";
import { safeImageUrl } from "@/lib/validation";
import { GradientMesh } from "@/components/gradient-mesh";
import { ProfileBlocks } from "@/components/profile/profile-blocks";
import { ProfileHero } from "@/components/profile/profile-hero";
import { QrCode } from "@/components/profile/qr-code";
import { ShareSheet } from "@/components/profile/share-sheet";

/**
 * This route is only meant to be reached via proxy.ts's rewrite of
 * `{username}.${ROOT_DOMAIN}` — but it's still an ordinary routable path, so
 * `${ROOT_DOMAIN}/sites/haonguyen` would otherwise render it directly too.
 * 404 unless the request actually came in on that user's own subdomain.
 */
async function assertOwnSubdomain(username: string): Promise<void> {
  const host = (await headers()).get("host") ?? "";
  if (subdomainFromHost(host) !== username) notFound();
}

// cache() dedupes the generateMetadata + page calls into one API request
const fetchProfile = cache(
  async (username: string): Promise<PublicProfile | null> => {
    try {
      return (await getPublicProfile(username)).data;
    } catch (err) {
      // §6 — 404 covers both "unknown username" and "not published".
      if (err instanceof ApiError && err.isNotFound) return null;
      throw err;
    }
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  await assertOwnSubdomain(username);
  const profile = await fetchProfile(username);
  // Bailing out here (before the body streams) yields a real 404 status.
  if (!profile) notFound();

  const name = profile.display_name || profile.username;
  const title = `${name} — fracture`;
  // Bios are multi-line free text; a meta description has to be one line.
  const flatBio = profile.bio?.replace(/\s+/g, " ").trim();
  const description = flatBio
    ? flatBio.length > 160
      ? `${flatBio.slice(0, 157)}…`
      : flatBio
    : `All of ${name}'s links, in one place.`;
  // This page is only ever reached via the user's own subdomain (proxy.ts),
  // so its canonical URL is the current origin's root, not a relative path.
  const origin = await getSiteOrigin();

  return {
    title,
    description,
    // og:image itself comes from opengraph-image.tsx in this segment.
    openGraph: {
      type: "profile",
      title,
      description,
      url: origin,
      siteName: "fracture",
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: origin },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  await assertOwnSubdomain(username);
  const profile = await fetchProfile(username);
  if (!profile) notFound();

  const {
    scheme,
    themeClass,
    pageStyle,
    themeVars,
    hasCustomBackground,
    hasBackgroundImage,
  } = resolveAppearance(profile.appearance);
  const avatar = safeImageUrl(profile.avatar_url); // §8.3 — sanitize before render
  const displayName = profile.display_name || `@${profile.username}`;
  const shareUrl = await getSiteOrigin();

  return (
    <div
      className={`${themeClass} relative flex min-h-screen flex-col items-center px-5 py-14 sm:py-20 ${
        hasCustomBackground ? (scheme === "dark" ? "bg-zinc-950" : "bg-zinc-50") : ""
      }`}
      style={{ ...pageStyle, ...themeVars }}
    >
      {/* The decorative default mesh only shows when the owner hasn't set a
          background of their own — a custom pageStyle always wins outright. */}
      {!hasCustomBackground && <GradientMesh scheme={scheme ?? "auto"} />}
      {/* Sits above the page's own background image (a -z-10 child would paint
          behind it) but below the content, which is lifted to z-10. */}
      {hasBackgroundImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80"
        />
      )}

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ShareSheet url={shareUrl} title={`${displayName} — fracture`}>
          <QrCode value={shareUrl} />
        </ShareSheet>
      </div>

      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-9">
        <ProfileHero
          username={profile.username}
          displayName={displayName}
          bio={profile.bio}
          avatar={avatar}
        />

        <ProfileBlocks blocks={profile.blocks ?? []} />

        {/* Cross-origin back to the root domain — "/" here would loop back
            to this same profile, since this page owns "/" on its subdomain. */}
        <Link
          href={rootOrigin()}
          className="pf-reveal rounded-full px-3 py-1 text-xs font-medium tracking-wide transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            color: "var(--pf-faint)",
            outlineColor: "var(--pf-ring)",
            animationDelay: "320ms",
          }}
        >
          made with fracture
        </Link>
      </main>
    </div>
  );
}
