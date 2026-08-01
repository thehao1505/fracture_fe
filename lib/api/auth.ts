import { apiFetch } from "./client";
import type {
  DataResponse,
  GoogleLoginRequest,
  LoginRequest,
  LoginResponse,
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
