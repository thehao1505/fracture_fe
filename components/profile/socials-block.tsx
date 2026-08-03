import type { CssVars } from "@/lib/appearance";
import type { SocialItem } from "@/lib/api/types";
import { brandAccents, platformLabel, SocialGlyph } from "./social-icons";

/**
 * A `socials` block: a row of circular brand icons.
 *
 * §7.11 — only `link` blocks are click-tracked, so these href straight out.
 * The platform slug used to be printed as raw lowercase text; the glyph plus
 * an `aria-label` reads better and stays legible at any row width.
 */
export function SocialsBlock({
  items,
  index,
}: {
  items: SocialItem[];
  index: number;
}) {
  return (
    <ul
      className="pf-reveal flex flex-wrap justify-center gap-2 py-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {items.map((item, itemIndex) => {
        const accents = brandAccents(item.platform);
        return (
          <li key={`${item.platform}-${itemIndex}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={platformLabel(item.platform)}
              title={platformLabel(item.platform)}
              className="pf-social flex h-10 w-10 items-center justify-center rounded-full border outline-none transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={
                accents
                  ? ({
                      "--pf-brand-l": accents.light,
                      "--pf-brand-d": accents.dark,
                    } as CssVars)
                  : undefined
              }
            >
              <SocialGlyph platform={item.platform} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
