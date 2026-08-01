import {
  BACKGROUND_TYPES,
  BUTTON_STYLES,
  SOCIAL_PLATFORMS,
  THEMES,
  type Appearance,
  type HeaderContent,
  type LinkContent,
  type SocialsContent,
} from "./api/types";

/**
 * Client-side validation mirroring the server rules in FE_GUIDELINE.md §4/§5.
 * Shared by client components (pre-submit) and server actions (pre-request).
 */

// §5 reserved usernames (profile_usecase.go:36)
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "login",
  "register",
  "health",
  "swagger",
  "me",
  "p",
  "www",
  "support",
  "about",
  "auth",
  "user",
  "users",
]);

const USERNAME_REGEX = /^[a-z0-9_.]+$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/; // §5 (profile_usecase.go:155)

/** §7.10 — server lowercases and trims; mirror before validating. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < 3 || username.length > 30) {
    return "Username must be 3–30 characters.";
  }
  if (!USERNAME_REGEX.test(username)) {
    return "Username may only contain lowercase letters, numbers, underscores and dots.";
  }
  if (username.startsWith(".") || username.endsWith(".")) {
    return "Username cannot start or end with a dot.";
  }
  if (username.includes("..")) {
    return "Username cannot contain consecutive dots.";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "That username is reserved. Please pick another.";
  }
  return null;
}

/** §7.14 — bcrypt cap: 8–72 chars. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  return null;
}

export function validateEmail(email: string): string | null {
  // Light-weight mirror of Gin's `email` binding; server has the final say.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

/** §7.13 — only http/https URLs are accepted server-side. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateHttpUrl(value: string): string | null {
  if (!value.trim()) return "URL is required.";
  if (!isHttpUrl(value.trim())) {
    return "URL must start with http:// or https://";
  }
  return null;
}

/**
 * §8.3 — avatar_url is NOT validated server-side; sanitize before rendering
 * so javascript:/data: URLs never reach an <img src>.
 */
export function safeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed && isHttpUrl(trimmed) ? trimmed : null;
}

// ---------- §5 block content validation ----------

export function validateLinkContent(content: LinkContent): string | null {
  const title = content.title.trim();
  if (title.length < 1 || title.length > 80) {
    return "Title must be 1–80 characters.";
  }
  return validateHttpUrl(content.url);
}

export function validateSocialsContent(content: SocialsContent): string | null {
  if (content.items.length < 1 || content.items.length > 20) {
    return "Add between 1 and 20 social links.";
  }
  for (const item of content.items) {
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(item.platform)) {
      return `Unknown platform "${item.platform}".`;
    }
    const urlError = validateHttpUrl(item.url);
    if (urlError) return `${item.platform}: ${urlError}`;
  }
  return null;
}

export function validateHeaderContent(content: HeaderContent): string | null {
  const text = content.text.trim();
  if (text.length < 1 || text.length > 80) {
    return "Text must be 1–80 characters.";
  }
  return null;
}

// ---------- §5 appearance validation (strict server-side) ----------

export function validateAppearance(appearance: Appearance): string | null {
  if (
    appearance.theme !== undefined &&
    !(THEMES as readonly string[]).includes(appearance.theme)
  ) {
    return "Theme must be dark, light, or default.";
  }
  if (appearance.background) {
    const { type, value } = appearance.background;
    if (!(BACKGROUND_TYPES as readonly string[]).includes(type)) {
      return "Background type must be color, gradient, or image.";
    }
    if (type === "color" && !HEX_COLOR_REGEX.test(value)) {
      return "Background color must be a 6-digit hex value like #1a2b3c.";
    }
  }
  if (appearance.button) {
    const { style, color } = appearance.button;
    if (!(BUTTON_STYLES as readonly string[]).includes(style)) {
      return "Button style must be rounded, sharp, or pill.";
    }
    if (color && !HEX_COLOR_REGEX.test(color)) {
      return "Button color must be a 6-digit hex value like #1a2b3c.";
    }
  }
  return null;
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}
