import { apiFetch } from "./client";
import type {
  DataResponse,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  RefreshRequest,
  RegisterRequest,
  User,
} from "./types";

/** §4 POST /api/v1/auth/register */
export function register(body: RegisterRequest): Promise<DataResponse<User>> {
  return apiFetch<DataResponse<User>>("/auth/register", {
    method: "POST",
    body,
  });
}

/** §4 POST /api/v1/auth/login */
export function login(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", { method: "POST", body });
}

/** Google Sign-In guideline §4 POST /api/v1/auth/google */
export function loginWithGoogle(
  body: GoogleLoginRequest,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/google", { method: "POST", body });
}

/**
 * Refresh guideline §1.1 POST /api/v1/auth/refresh — public route, no Bearer
 * header, single-use token in the body.
 *
 * Do NOT call this directly: `lib/auth/refresh.ts` owns the single-flight guard
 * and Proxy is its only caller (§0.2 — two parallel refreshes revoke the whole
 * session).
 */
export function refreshSession(body: RefreshRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/refresh", { method: "POST", body });
}

/**
 * Refresh guideline §1.3 POST /api/v1/auth/logout — Bearer, no body. Revokes the
 * session server-side so its refresh token 401s from then on. Clearing our own
 * cookies is still mandatory (§2d: the backend fails open when Redis is down).
 */
export function revokeSession(token: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/auth/logout", { method: "POST", token });
}
