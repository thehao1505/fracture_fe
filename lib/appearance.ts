import type { Appearance } from "./api/types";
import { isHttpUrl } from "./validation";

/**
 * Maps the §5 appearance schema onto styles for the public page. Values are
 * user-supplied, so anything not strictly validated server-side (gradient
 * strings, image URLs, font names) is sanitized before touching CSS.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
// letters, digits, spaces and the characters gradients legitimately use
const SAFE_CSS_VALUE = /^[a-zA-Z0-9#%(),.\s-]+$/;
const SAFE_FONT = /^[a-zA-Z0-9\s,'-]+$/;

export interface PublicPageStyle {
  isDark: boolean;
  pageStyle: React.CSSProperties;
  buttonStyle: React.CSSProperties;
  buttonRadiusClass: string;
}

export function resolveAppearance(
  appearance: Appearance | null,
): PublicPageStyle {
  appearance ??= {};
  const isDark = appearance.theme === "dark";

  const pageStyle: React.CSSProperties = {};
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
    }
  }
  if (appearance.font && SAFE_FONT.test(appearance.font)) {
    pageStyle.fontFamily = `${appearance.font}, sans-serif`;
  }

  const buttonStyle: React.CSSProperties = {};
  if (appearance.button?.color && HEX.test(appearance.button.color)) {
    buttonStyle.backgroundColor = appearance.button.color;
  }

  const buttonRadiusClass =
    {
      rounded: "rounded-lg",
      sharp: "rounded-none",
      pill: "rounded-full",
      "": "rounded-lg",
    }[appearance.button?.style ?? ""] ?? "rounded-lg";

  return { isDark, pageStyle, buttonStyle, buttonRadiusClass };
}
