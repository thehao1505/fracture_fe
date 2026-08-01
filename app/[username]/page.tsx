import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getPublicProfile } from "@/lib/api/public";
import type {
  HeaderContent,
  LinkContent,
  PublicProfile,
  SocialsContent,
} from "@/lib/api/types";
import { resolveAppearance } from "@/lib/appearance";
import { safeImageUrl } from "@/lib/validation";

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
  const profile = await fetchProfile(username);
  // Bailing out here (before the body streams) yields a real 404 status.
  if (!profile) notFound();
  return {
    title: `${profile.display_name || profile.username} — fracture`,
    description: profile.bio || undefined,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) notFound();

  const { isDark, pageStyle, buttonStyle, buttonRadiusClass } =
    resolveAppearance(profile.appearance);
  const avatar = safeImageUrl(profile.avatar_url); // §8.3 — sanitize before render
  const blocks = profile.blocks ?? [];

  const textClass = isDark ? "text-zinc-50" : "text-zinc-900";
  const mutedClass = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div
      className={`flex min-h-screen flex-col items-center px-4 py-16 ${
        isDark ? "bg-zinc-950" : "bg-zinc-50"
      }`}
      style={pageStyle}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element -- arbitrary
             user-supplied hosts; next/image would need remotePatterns */
          <img
            src={avatar}
            alt={`${profile.display_name || profile.username}'s avatar`}
            className="h-24 w-24 rounded-full border-2 border-white/50 object-cover shadow"
          />
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${
              isDark ? "bg-zinc-800 text-zinc-200" : "bg-zinc-200 text-zinc-700"
            }`}
          >
            {(profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="text-center">
          <h1 className={`text-xl font-bold ${textClass}`}>
            {profile.display_name || `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className={`text-sm ${mutedClass}`}>@{profile.username}</p>
          )}
          {profile.bio && (
            <p className={`mt-2 whitespace-pre-line text-sm ${mutedClass}`}>
              {profile.bio}
            </p>
          )}
        </div>

        {blocks.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>Nothing here yet.</p>
        ) : (
          <div className="flex w-full flex-col gap-3">
            {blocks.map((block) => {
              if (block.type === "header") {
                const content = block.content as HeaderContent;
                return (
                  <h2
                    key={block.id}
                    className={`mt-3 text-center text-sm font-semibold uppercase tracking-wide ${mutedClass}`}
                  >
                    {content.text}
                  </h2>
                );
              }

              if (block.type === "socials") {
                const content = block.content as SocialsContent;
                return (
                  <div
                    key={block.id}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    {/* §7.11 — only `link` blocks are click-tracked; socials link directly */}
                    {content.items.map((item, index) => (
                      <a
                        key={`${item.platform}-${index}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
                          isDark
                            ? "bg-zinc-800 text-zinc-200"
                            : "bg-zinc-200 text-zinc-800"
                        }`}
                      >
                        {item.platform}
                      </a>
                    ))}
                  </div>
                );
              }

              const content = block.content as LinkContent;
              return (
                /* §7.12 — server-mediated click: /go counts it, then redirects */
                <a
                  key={block.id}
                  href={`/${encodeURIComponent(profile.username)}/go/${block.id}`}
                  className={`block w-full px-4 py-3 text-center text-sm font-medium shadow-sm transition-transform hover:scale-[1.02] ${buttonRadiusClass} ${
                    isDark
                      ? "bg-zinc-100 text-zinc-900"
                      : "bg-zinc-900 text-zinc-50"
                  }`}
                  style={buttonStyle}
                >
                  {content.title}
                </a>
              );
            })}
          </div>
        )}

        <p className={`mt-8 text-xs ${mutedClass}`}>
          <Link href="/" className="hover:underline">
            fracture
          </Link>
        </p>
      </div>
    </div>
  );
}
