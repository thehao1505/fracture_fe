import type { Appearance } from "./api/types";
import { isHttpUrl } from "./validation";

/**
 * Maps the §5 appearance schema onto styles for the public page. Values are
 * user-supplied, so anything not strictly validated server-side (gradient
 * strings, image URLs, font names) is sanitized before touching CSS.
 *
 * The palette itself lives in `globals.css` as `--pf-*` tokens under
 * `.pf-theme*` classes, so a profile with no theme set can follow the
 * *visitor's* colour scheme — something inline styles can't express. This
 * function picks the class and inlines only the per-profile overrides.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
// letters, digits, spaces and the characters gradients legitimately use
const SAFE_CSS_VALUE = /^[a-zA-Z0-9#%(),.\s-]+$/;
const SAFE_FONT = /^[a-zA-Z0-9\s,'-]+$/;

/** CSS custom properties can't be typed as CSSProperties keys — widen. */
export type CssVars = React.CSSProperties & Record<`--${string}`, string>;

export interface PublicPageStyle {
  /** Explicit theme choice, or null when the visitor's preference decides. */
  scheme: "light" | "dark" | null;
  /** Class carrying the `--pf-*` token set. */
  themeClass: string;
  /** Background + font for the page shell. */
  pageStyle: React.CSSProperties;
  /** Per-profile token overrides (radius, button colour). */
  themeVars: CssVars;
  /** True when the owner set any background of their own. */
  hasCustomBackground: boolean;
  /** Photo backgrounds need a scrim so text stays legible. */
  hasBackgroundImage: boolean;
}

/**
 * WCAG relative luminance. Used to pick a text colour that stays readable on
 * whatever button colour the owner picked — a light custom colour with the
 * default light-on-dark text was previously invisible.
 */
export function hexLuminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Near-black or near-white, whichever contrasts better with `hex`. */
export function readableTextColor(hex: string): string {
  return hexLuminance(hex) > 0.4 ? "#18181b" : "#fafafa";
}

const RADIUS: Record<string, string> = {
  rounded: "0.9rem",
  sharp: "0px",
  pill: "999px",
};

export function resolveAppearance(
  appearance: Appearance | null,
): PublicPageStyle {
  appearance ??= {};

  const pageStyle: React.CSSProperties = {};
  let hasBackgroundImage = false;
  const background = appearance.background;
  if (background) {
    if (background.type === "color" && HEX.test(background.value)) {
      pageStyle.backgroundColor = background.value;
    } else if (
      background.type === "gradient" &&
      SAFE_CSS_VALUE.test(background.value)
    ) {
      pageStyle.backgroundImage = background.value;
    } else if (background.type === "image" && isHttpUrl(background.value)) {
      pageStyle.backgroundImage = `url(${JSON.stringify(background.value)})`;
      pageStyle.backgroundSize = "cover";
      pageStyle.backgroundPosition = "center";
      pageStyle.backgroundAttachment = "fixed";
      hasBackgroundImage = true;
    }
  }
  if (appearance.font && SAFE_FONT.test(appearance.font)) {
    pageStyle.fontFamily = `${appearance.font}, sans-serif`;
  }

  // A photo background is arbitrary, so it always gets the scrim + light-on-
  // dark palette no matter which theme the owner picked.
  let scheme: "light" | "dark" | null = null;
  if (hasBackgroundImage || appearance.theme === "dark") scheme = "dark";
  else if (appearance.theme === "light") scheme = "light";

  const themeClass =
    scheme === "dark"
      ? "pf-theme pf-theme-dark"
      : scheme === "light"
        ? "pf-theme"
        : "pf-theme pf-theme-auto";

  const themeVars: CssVars = {
    "--pf-radius": RADIUS[appearance.button?.style ?? ""] ?? RADIUS.rounded,
  };

  const buttonColor = appearance.button?.color;
  if (buttonColor && HEX.test(buttonColor)) {
    themeVars["--pf-btn-bg"] = buttonColor;
    themeVars["--pf-btn-fg"] = readableTextColor(buttonColor);
  }

  return {
    scheme,
    themeClass,
    pageStyle,
    themeVars,
    hasCustomBackground: Boolean(
      pageStyle.backgroundColor || pageStyle.backgroundImage,
    ),
    hasBackgroundImage,
  };
}
