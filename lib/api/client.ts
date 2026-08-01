import type { ErrorResponse } from "./types";

/**
 * Centralized Fracture API client (FE_GUIDELINE.md §3, §6).
 *
 * Server-side only: the backend has no CORS middleware (§8.1), so every call
 * is made from the Next.js server (Server Components, Server Actions, Route
 * Handlers) and the JWT lives in an httpOnly cookie — never in the browser.
 */

const API_BASE_URL = process.env.FRACTURE_API_URL ?? "http://localhost:8080";
const API_PREFIX = "/api/v1";

/** §6 domain error messages — stable, safe to switch on. */
export const DOMAIN_ERRORS = {
  invalidId: "invalid id format",
  badRequest: "bad request",
  notFound: "resource not found",
  alreadyExists: "resource already exists",
  invalidCredentials: "invalid email or password",
} as const;

export class ApiError extends Error {
  readonly status: number;
  /** Raw `error` string from the API body (§6). */
  readonly apiMessage: string;

  constructor(status: number, apiMessage: string) {
    super(`API error ${status}: ${apiMessage}`);
    this.name = "ApiError";
    this.status = status;
    this.apiMessage = apiMessage;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /**
   * §6.B — Gin validator strings are verbose Go messages returned verbatim.
   * Treat as opaque; callers should show a generic form error instead.
   */
  get isOpaqueValidationError(): boolean {
    return (
      this.status === 400 &&
      !Object.values(DOMAIN_ERRORS).includes(
        this.apiMessage as (typeof DOMAIN_ERRORS)[keyof typeof DOMAIN_ERRORS],
      )
    );
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", token, body, query }: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${API_PREFIX}${path}`, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network error: could not reach the Fracture API");
  }

  if (!res.ok) {
    let message = "internal server error";
    try {
      const parsed = (await res.json()) as ErrorResponse;
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // non-JSON error body — keep the fallback message
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}
