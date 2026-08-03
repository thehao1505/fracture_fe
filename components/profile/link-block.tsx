import { ArrowUpRight } from "lucide-react";
import type { LinkContent } from "@/lib/api/types";
import { safeImageUrl } from "@/lib/validation";

/**
 * A `link` block. §5 already carries optional `icon` and `thumbnail`, so the
 * shape of the row is derived from the content rather than from a setting:
 *
 *   thumbnail → media card (image, title, destination host)
 *   icon      → icon row (glyph chip, title)
 *   neither   → plain centred button
 *
 * All three share the owner's button colour and radius (`--pf-btn-*`,
 * `--pf-radius`) so a page with mixed blocks still reads as one set.
 */

const SURFACE =
  "pf-reveal group flex w-full items-center overflow-hidden border border-transparent font-semibold outline-none transition-[transform,box-shadow] duration-200 will-change-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0";

const SURFACE_STYLE: React.CSSProperties = {
  backgroundColor: "var(--pf-btn-bg)",
  color: "var(--pf-btn-fg)",
  borderRadius: "var(--pf-radius)",
  boxShadow: "var(--pf-shadow)",
  outlineColor: "var(--pf-ring)",
};

/** Faint wash over the button colour — works on any hue, light or dark. */
const INSET_TINT = "color-mix(in srgb, currentColor 12%, transparent)";

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Arrow() {
  return (
    <ArrowUpRight
      className="h-4 w-4 shrink-0 opacity-45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-90"
      aria-hidden
    />
  );
}

export function LinkBlock({
  href,
  content,
  index,
}: {
  href: string;
  content: LinkContent;
  index: number;
}) {
  const style = { ...SURFACE_STYLE, animationDelay: `${index * 60}ms` };
  const thumbnail = safeImageUrl(content.thumbnail ?? "");
  const host = hostname(content.url);

  if (thumbnail) {
    return (
      <a href={href} className={`${SURFACE} gap-3.5 p-2 pr-4`} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary
            user-supplied hosts; next/image would need remotePatterns */}
        <img
          src={thumbnail}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 shrink-0 object-cover"
          style={{
            borderRadius: "calc(var(--pf-radius) * 0.66)",
            backgroundColor: INSET_TINT,
          }}
        />
        <span className="min-w-0 flex-1 py-0.5 text-left">
          <span className="block truncate text-sm">{content.title}</span>
          {host && (
            <span className="mt-0.5 block truncate text-xs font-normal opacity-55">
              {host}
            </span>
          )}
        </span>
        <Arrow />
      </a>
    );
  }

  const icon = renderIcon(content.icon);
  if (icon) {
    return (
      <a href={href} className={`${SURFACE} gap-3 p-2.5 pr-4`} style={style}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base leading-none"
          style={{ backgroundColor: INSET_TINT }}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm">
          {content.title}
        </span>
        <Arrow />
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`${SURFACE} justify-center gap-2 px-4 py-3.5 text-sm`}
      style={style}
    >
      <span className="truncate">{content.title}</span>
      <Arrow />
    </a>
  );
}

/**
 * `icon` is a free-text field in the contract, so accept the two things people
 * actually put there — an image URL or an emoji — and ignore anything else
 * rather than printing a stray word next to the title.
 */
function renderIcon(icon: string | undefined): React.ReactNode {
  const value = icon?.trim();
  if (!value) return null;

  const url = safeImageUrl(value);
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- see above */
      <img
        src={url}
        alt=""
        width={20}
        height={20}
        loading="lazy"
        decoding="async"
        className="h-5 w-5 rounded-sm object-contain"
      />
    );
  }
  // Emoji are 1–2 code points; longer strings are labels, not glyphs.
  return [...value].length <= 2 ? value : null;
}
