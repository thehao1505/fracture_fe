/**
 * Identity block at the top of a public profile. Server-rendered — the avatar
 * glow, the reveal animation and the initials fallback are all CSS, so nothing
 * here ships JavaScript to the visitor.
 */

/** Deterministic hue so each username gets its own initials colour. */
function hueFromString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

export function ProfileHero({
  username,
  displayName,
  bio,
  avatar,
}: {
  username: string;
  displayName: string;
  bio: string | null | undefined;
  avatar: string | null;
}) {
  const hue = hueFromString(username);
  const showHandle = displayName !== `@${username}`;

  return (
    <header className="flex w-full flex-col items-center gap-4 text-center">
      <div
        className="pf-reveal relative"
        style={{ animationDelay: "0ms" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 scale-[1.35] rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to opacity-35 blur-2xl"
        />
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element -- arbitrary
             user-supplied hosts; next/image would need remotePatterns */
          <img
            src={avatar}
            alt={`${displayName}'s avatar`}
            width={112}
            height={112}
            decoding="async"
            className="h-28 w-28 rounded-full object-cover"
            style={{
              boxShadow: "var(--pf-shadow)",
              outline: "3px solid var(--pf-border)",
              outlineOffset: "2px",
            }}
          />
        ) : (
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold text-white"
            style={{
              backgroundImage: `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${(hue + 55) % 360} 72% 48%))`,
              boxShadow: "var(--pf-shadow)",
              outline: "3px solid var(--pf-border)",
              outlineOffset: "2px",
            }}
          >
            {[...displayName][0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>

      <div
        className="pf-reveal flex w-full min-w-0 flex-col items-center gap-1"
        style={{ animationDelay: "70ms" }}
      >
        <h1
          className="text-balance text-2xl font-bold tracking-tight"
          style={{ color: "var(--pf-text)", overflowWrap: "anywhere" }}
        >
          {displayName}
        </h1>
        {showHandle && (
          <p className="text-sm" style={{ color: "var(--pf-faint)" }}>
            @{username}
          </p>
        )}
        {bio && (
          <p
            /* Clamped rather than unbounded: a long bio would otherwise push
               every link below the fold. */
            className="mt-2 line-clamp-[8] max-w-[34ch] whitespace-pre-line text-pretty text-sm leading-relaxed"
            style={{ color: "var(--pf-muted)", overflowWrap: "anywhere" }}
          >
            {bio}
          </p>
        )}
      </div>
    </header>
  );
}
