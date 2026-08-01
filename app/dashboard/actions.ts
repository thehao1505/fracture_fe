"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  createBlock,
  createMyProfile,
  deleteBlock,
  getMyProfile,
  reorderBlocks,
  updateBlock,
  updateMyProfile,
} from "@/lib/api/me";
import type {
  Appearance,
  BackgroundType,
  BlockContent,
  BlockType,
  ButtonStyle,
  SocialItem,
  Theme,
} from "@/lib/api/types";
import { BLOCK_TYPES } from "@/lib/api/types";
import type { FormState } from "@/lib/form-state";
import { clearSessionToken, requireSessionToken } from "@/lib/session";
import {
  normalizeUsername,
  validateAppearance,
  validateHeaderContent,
  validateLinkContent,
  validateSocialsContent,
  validateUsername,
} from "@/lib/validation";

/** §6 — 401 means the 24h token expired (no refresh flow): back to login. */
async function handleAuthExpiry(err: unknown): Promise<void> {
  if (err instanceof ApiError && err.isUnauthorized) {
    await clearSessionToken();
    redirect("/login");
  }
}

function genericError(err: unknown): FormState {
  if (err instanceof ApiError) {
    if (err.isNotFound) return { error: "Not found. Refresh and try again." };
    if (err.isOpaqueValidationError) {
      return { error: "Please check the form and try again." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  throw err;
}

// ---------- profile form parsing ----------

/**
 * §5 appearance — build the object from form fields; return undefined when the
 * user set nothing, so the API leaves appearance unchanged (§4 PUT semantics).
 */
function parseAppearance(formData: FormData): {
  appearance?: Appearance;
  error?: string;
} {
  const theme = String(formData.get("theme") ?? "") as Theme;
  const backgroundType = String(
    formData.get("background_type") ?? "",
  ) as BackgroundType;
  const backgroundValue = String(formData.get("background_value") ?? "").trim();
  const buttonStyle = String(formData.get("button_style") ?? "") as ButtonStyle;
  const buttonColor = String(formData.get("button_color") ?? "").trim();
  const font = String(formData.get("font") ?? "").trim();

  const appearance: Appearance = {};
  if (theme) appearance.theme = theme;
  if (backgroundType) {
    appearance.background = { type: backgroundType, value: backgroundValue };
  }
  if (buttonStyle) {
    appearance.button = { style: buttonStyle };
    if (buttonColor) appearance.button.color = buttonColor;
  }
  if (font) appearance.font = font;

  if (Object.keys(appearance).length === 0) return {};
  const error = validateAppearance(appearance);
  return error ? { error } : { appearance };
}

export async function createProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  const usernameError = validateUsername(username);
  if (usernameError) return { fieldErrors: { username: usernameError } };

  try {
    await createMyProfile(token, {
      username,
      display_name: displayName || undefined,
      bio: bio || undefined,
    });
  } catch (err) {
    await handleAuthExpiry(err);
    if (err instanceof ApiError && err.isConflict) {
      // §6 — same 409 for "already has a profile" and "username taken";
      // this form only renders when no profile exists, so it's the username.
      return { fieldErrors: { username: "That username is already taken." } };
    }
    return genericError(err);
  }

  revalidatePath("/dashboard");
  return { success: "Profile created." };
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const username = normalizeUsername(String(formData.get("username") ?? ""));

  const usernameError = validateUsername(username);
  if (usernameError) return { fieldErrors: { username: usernameError } };

  const { appearance, error: appearanceError } = parseAppearance(formData);
  if (appearanceError) return { error: appearanceError };

  try {
    // §7.9/§8.4 — full replace: send every field, is_published explicitly.
    await updateMyProfile(token, {
      username,
      display_name: String(formData.get("display_name") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim(),
      avatar_url: String(formData.get("avatar_url") ?? "").trim(),
      appearance,
      is_published: formData.get("is_published") === "on",
    });
  } catch (err) {
    await handleAuthExpiry(err);
    if (err instanceof ApiError && err.isConflict) {
      return { fieldErrors: { username: "That username is already taken." } };
    }
    return genericError(err);
  }

  revalidatePath("/dashboard");
  return { success: "Profile saved." };
}

export async function togglePublishAction(): Promise<FormState> {
  const token = await requireSessionToken();
  try {
    // §7.9 — PUT is full-replace, so read current values before flipping.
    const { data: profile } = await getMyProfile(token);
    await updateMyProfile(token, {
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      is_published: !profile.is_published,
    });
  } catch (err) {
    await handleAuthExpiry(err);
    return genericError(err);
  }
  revalidatePath("/dashboard");
  return {};
}

// ---------- block content parsing (§5 strict schemas) ----------

function parseBlockContent(
  type: BlockType,
  formData: FormData,
): { content?: BlockContent; error?: string } {
  if (type === "link") {
    const icon = String(formData.get("icon") ?? "").trim();
    const thumbnail = String(formData.get("thumbnail") ?? "").trim();
    const content = {
      title: String(formData.get("title") ?? "").trim(),
      url: String(formData.get("url") ?? "").trim(),
      ...(icon ? { icon } : {}),
      ...(thumbnail ? { thumbnail } : {}),
    };
    const error = validateLinkContent(content);
    return error ? { error } : { content };
  }

  if (type === "header") {
    const content = { text: String(formData.get("text") ?? "").trim() };
    const error = validateHeaderContent(content);
    return error ? { error } : { content };
  }

  // socials — the client submits items as a JSON hidden field
  let items: SocialItem[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]")) as SocialItem[];
  } catch {
    return { error: "Invalid social links payload." };
  }
  const content = {
    items: items.map((item) => ({
      platform: item.platform,
      url: String(item.url ?? "").trim(),
    })),
  };
  const error = validateSocialsContent(content);
  return error ? { error } : { content };
}

export async function addBlockAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const type = String(formData.get("type") ?? "") as BlockType;
  if (!BLOCK_TYPES.includes(type)) return { error: "Unknown block type." };

  const { content, error } = parseBlockContent(type, formData);
  if (error || !content) return { error };

  try {
    await createBlock(token, { type, content });
  } catch (err) {
    await handleAuthExpiry(err);
    if (err instanceof ApiError && err.status === 400) {
      // §7.5 — could be the 100-block limit
      return {
        error:
          "Could not add the block. Profiles are limited to 100 blocks — check the form and your block count.",
      };
    }
    return genericError(err);
  }

  revalidatePath("/dashboard");
  return { success: "Block added." };
}

export async function updateBlockAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "") as BlockType;
  if (!id) return { error: "Missing block id." };
  if (!BLOCK_TYPES.includes(type)) return { error: "Unknown block type." };

  const { content, error } = parseBlockContent(type, formData);
  if (error || !content) return { error };

  try {
    // §7.8 — is_active omitted on content edits: visibility stays unchanged.
    await updateBlock(token, id, { type, content });
  } catch (err) {
    await handleAuthExpiry(err);
    return genericError(err);
  }

  revalidatePath("/dashboard");
  return { success: "Block saved." };
}

export async function toggleBlockVisibilityAction(id: string): Promise<FormState> {
  const token = await requireSessionToken();
  try {
    // PUT requires type + content (§4), so re-read the block first.
    const { data: profile } = await getMyProfile(token);
    const block = (profile.blocks ?? []).find((candidate) => candidate.id === id);
    if (!block) return { error: "Block not found. Refresh and try again." };
    await updateBlock(token, id, {
      type: block.type,
      content: block.content,
      is_active: !block.is_active,
    });
  } catch (err) {
    await handleAuthExpiry(err);
    return genericError(err);
  }
  revalidatePath("/dashboard");
  return {};
}

export async function deleteBlockAction(id: string): Promise<FormState> {
  const token = await requireSessionToken();
  try {
    await deleteBlock(token, id);
  } catch (err) {
    await handleAuthExpiry(err);
    return genericError(err);
  }
  revalidatePath("/dashboard");
  return {};
}

/** §7.7 — the order array must contain every current block id exactly once. */
export async function reorderBlocksAction(order: string[]): Promise<FormState> {
  const token = await requireSessionToken();
  try {
    await reorderBlocks(token, { order });
  } catch (err) {
    await handleAuthExpiry(err);
    if (err instanceof ApiError && err.status === 400) {
      return { error: "Blocks changed elsewhere. Refresh and try again." };
    }
    return genericError(err);
  }
  revalidatePath("/dashboard");
  return {};
}
