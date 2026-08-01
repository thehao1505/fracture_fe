"use server";

import { redirect } from "next/navigation";
import { login, register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { FormState } from "@/lib/form-state";
import { clearSessionToken, setSessionToken } from "@/lib/session";
import { validateEmail, validatePassword } from "@/lib/validation";

/** Only allow internal paths for the post-login redirect. */
function safeNextPath(raw: FormDataEntryValue | null): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    const res = await login({ email, password });
    await setSessionToken(res.access_token);
  } catch (err) {
    if (err instanceof ApiError) {
      // §6 — same message for unknown email and wrong password
      if (err.isUnauthorized) return { error: "Invalid email or password." };
      if (err.isOpaqueValidationError) {
        return { error: "Please check your email and password." };
      }
      return { error: "Something went wrong. Please try again." };
    }
    throw err;
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // §4 register constraints: valid email, password 8–72, non-empty name
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required.";
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await register({ email, password, name });
    // Register returns no token (§4) — log in with the same credentials.
    const res = await login({ email, password });
    await setSessionToken(res.access_token);
  } catch (err) {
    if (err instanceof ApiError) {
      // §6 mapping: 409 on register = email already in use
      if (err.isConflict) {
        return { fieldErrors: { email: "That email is already in use." } };
      }
      if (err.isOpaqueValidationError) {
        return { error: "Please check the form and try again." };
      }
      return { error: "Something went wrong. Please try again." };
    }
    throw err;
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  // §2 — no server-side logout/revocation; dropping the cookie is all there is.
  await clearSessionToken();
  redirect("/login");
}
