import { apiFetch } from "./client";
import type { ClickResponse, DataResponse, PublicProfile } from "./types";

/**
 * §4 GET /api/v1/profile/{username} — published profiles only, active blocks
 * only. 404 covers both "unknown username" and "not published" (§7.2).
 */
export function getPublicProfile(
  username: string,
): Promise<DataResponse<PublicProfile>> {
  return apiFetch<DataResponse<PublicProfile>>(
    `/profile/${encodeURIComponent(username)}`,
  );
}

/**
 * §4 POST /api/v1/profile/{username}/blocks/{id}/click — counts the click and
 * returns the destination URL to redirect to (§7.12). `link` blocks only.
 */
export function recordClick(
  username: string,
  blockId: string,
): Promise<ClickResponse> {
  return apiFetch<ClickResponse>(
    `/profile/${encodeURIComponent(username)}/blocks/${encodeURIComponent(blockId)}/click`,
    { method: "POST" },
  );
}
