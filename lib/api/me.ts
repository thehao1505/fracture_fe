import { apiFetch } from "./client";
import type {
  Block,
  CreateBlockRequest,
  CreateProfileRequest,
  DataResponse,
  MessageResponse,
  Profile,
  ReorderBlocksRequest,
  UpdateBlockRequest,
  UpdateProfileRequest,
} from "./types";

// ---------- ME — PROFILE (§4, scoped to token owner) ----------

/** §4 GET /api/v1/me/profile — 404 = user has no profile yet (§7.1) */
export function getMyProfile(token: string): Promise<DataResponse<Profile>> {
  return apiFetch<DataResponse<Profile>>("/me/profile", { token });
}

/** §4 POST /api/v1/me/profile — one per user; 409 = already has one OR username taken */
export function createMyProfile(
  token: string,
  body: CreateProfileRequest,
): Promise<DataResponse<Profile>> {
  return apiFetch<DataResponse<Profile>>("/me/profile", {
    method: "POST",
    token,
    body,
  });
}

/** §4 PUT /api/v1/me/profile — full replace; always send every field (§7.9, §8.4) */
export function updateMyProfile(
  token: string,
  body: UpdateProfileRequest,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/me/profile", {
    method: "PUT",
    token,
    body,
  });
}

// ---------- ME — BLOCKS (§4) ----------

/** §4 GET /api/v1/me/blocks — all blocks incl. hidden, ordered by position */
export function listMyBlocks(token: string): Promise<DataResponse<Block[]>> {
  return apiFetch<DataResponse<Block[]>>("/me/blocks", { token });
}

/** §4 POST /api/v1/me/blocks — appends at end, is_active=true; max 100 (§7.5) */
export function createBlock(
  token: string,
  body: CreateBlockRequest,
): Promise<DataResponse<Block>> {
  return apiFetch<DataResponse<Block>>("/me/blocks", {
    method: "POST",
    token,
    body,
  });
}

/** §4 PUT /api/v1/me/blocks/{id} — omit is_active to keep visibility (§7.8) */
export function updateBlock(
  token: string,
  id: string,
  body: UpdateBlockRequest,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/me/blocks/${id}`, {
    method: "PUT",
    token,
    body,
  });
}

/** §4 DELETE /api/v1/me/blocks/{id} */
export function deleteBlock(token: string, id: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/me/blocks/${id}`, {
    method: "DELETE",
    token,
  });
}

/** §4 PATCH /api/v1/me/blocks/reorder — must send the exact set of current ids (§7.7) */
export function reorderBlocks(
  token: string,
  body: ReorderBlocksRequest,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/me/blocks/reorder", {
    method: "PATCH",
    token,
    body,
  });
}
