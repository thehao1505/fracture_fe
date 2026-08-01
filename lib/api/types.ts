/**
 * Types mirroring FE_GUIDELINE.md §4 (endpoints) and §5 (models/enums) 1-to-1.
 * Do not add fields that the contract does not define.
 */

// ---------- §5 Models ----------

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  /** Contract says default `{}` (§5), but the live API returns `null` until set. */
  appearance: Appearance | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  /** Present on GET /me/profile; omitted by the API when empty (omitempty). */
  blocks?: Block[];
}

export interface Block {
  id: string;
  profile_id: string;
  type: BlockType;
  content: BlockContent;
  position: number;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
}

/** Public view (§4 GET /profile/{username}) — sensitive fields stripped. */
export interface PublicProfile {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  appearance: Appearance | null;
  blocks?: PublicBlock[];
}

export interface PublicBlock {
  id: string;
  type: BlockType;
  content: BlockContent;
}

// ---------- §5 Enums ----------

export const BLOCK_TYPES = ["link", "socials", "header"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const SOCIAL_PLATFORMS = [
  "instagram",
  "github",
  "x",
  "twitter",
  "youtube",
  "tiktok",
  "facebook",
  "linkedin",
  "threads",
  "twitch",
  "discord",
  "telegram",
  "spotify",
  "email",
  "website",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

// ---------- §5 Block content schemas (strict on the server) ----------

export interface LinkContent {
  title: string; // 1–80 chars, required
  url: string; // http/https, required
  icon?: string;
  thumbnail?: string;
}

export interface SocialItem {
  platform: SocialPlatform;
  url: string; // http/https
}

export interface SocialsContent {
  items: SocialItem[]; // 1–20 items
}

export interface HeaderContent {
  text: string; // 1–80 chars, required
}

export type BlockContent = LinkContent | SocialsContent | HeaderContent;

// ---------- §5 Appearance schema (strict) ----------

export const THEMES = ["", "dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const BACKGROUND_TYPES = ["", "color", "gradient", "image"] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export const BUTTON_STYLES = ["", "rounded", "sharp", "pill"] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];

export interface Appearance {
  theme?: Theme;
  background?: {
    type: BackgroundType;
    value: string; // #rrggbb when type === "color"
  };
  button?: {
    style: ButtonStyle;
    color?: string; // #rrggbb when present
  };
  font?: string;
}

// ---------- §4 Requests ----------

export interface RegisterRequest {
  email: string;
  password: string; // min 8, max 72
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** §4 (Google guideline) POST /auth/google. */
export interface GoogleLoginRequest {
  id_token: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
}

export interface UpdateUserRequest {
  email?: string; // empty string = leave unchanged
  name?: string; // empty string = leave unchanged
}

export interface ListUsersParams {
  page?: number; // default 1
  limit?: number; // default 20, max 100
  keyword?: string; // matches name or email
}

export interface CreateProfileRequest {
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  appearance?: Appearance;
}

/**
 * §4 PUT /me/profile — full replace of display_name/bio/avatar_url.
 * §8.4: is_published is a plain bool server-side; omitting it unpublishes.
 * Always send every field explicitly.
 */
export interface UpdateProfileRequest {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  appearance?: Appearance; // only overwrites when non-empty
  is_published: boolean;
}

export interface CreateBlockRequest {
  type: BlockType;
  content: BlockContent;
}

export interface UpdateBlockRequest {
  type: BlockType;
  content: BlockContent;
  /** Pointer semantics (§7.8): omit = keep current visibility. */
  is_active?: boolean;
}

export interface ReorderBlocksRequest {
  order: string[]; // exact set of current block ids
}

// ---------- §3/§4 Responses ----------

export interface DataResponse<T> {
  data: T;
}

export interface MessageResponse {
  message: string;
}

export interface LoginResponse {
  data: User;
  access_token: string;
  token_type: "Bearer";
}

/** §3 pagination gotcha: echoed page/limit are raw query values (0 when omitted). */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface ListUsersResponse {
  data: User[];
  pagination: Pagination;
}

export interface ClickResponse {
  url: string;
}

/** §6 — every error body is { error: string }. */
export interface ErrorResponse {
  error: string;
}
