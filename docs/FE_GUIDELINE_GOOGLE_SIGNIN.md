# FE_GUIDELINE_LOGIN_VIA_GOOGLE.md — Google Sign-In Contract

> Companion to `FE_GUIDELINE.md`. Describes the **backend contract** for signing
> in with Google. Extracted from the Go source; every claim cites `file:line`.
>
> Approach: **backend verifies a Google ID token** (the frontend does the Google
> UI and obtains the token). No redirect, no `state`, no session — the flow is
> stateless and returns the same JWT as password login.

---

## 1. Flow overview

```
┌────────────┐   1. Google Sign-In UI      ┌─────────────┐
│  Next.js   │ ──────────────────────────► │   Google    │
│  frontend  │ ◄────────────────────────── │             │
└────────────┘   2. id_token (a JWT)       └─────────────┘
      │
      │ 3. POST /api/v1/auth/google { "id_token": "..." }
      ▼
┌────────────────────────────────────────────────────────┐
│  Fracture backend                                        │
│  4. verify id_token against Google public keys           │
│     (audience must equal GOOGLE_CLIENT_ID)               │
│  5. find/link/create user (see §5)                       │
│  6. return { data: user, access_token, token_type }      │
└────────────────────────────────────────────────────────┘
      │
      ▼  7. store access_token, use as `Authorization: Bearer <token>`
         for all protected routes — exactly like password login.
```

The frontend's only new job is steps 1–3. Everything after `access_token` is
identical to the existing email/password flow in `FE_GUIDELINE.md` §2.

---

## 2. One-time setup (Google Cloud Console)

You do **not** have credentials yet — create them once:

1. Go to **Google Cloud Console → APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** (External; add app name, support email; add your domain(s) to _Authorized domains_).
3. **Create Credentials → OAuth client ID → Application type: Web application.**
4. Under **Authorized JavaScript origins**, add every origin the Next.js app runs on, e.g. `http://localhost:3000` and your production URL. _(Only needed for the browser Google Sign-In library; the backend does not use a redirect URI in this flow.)_
5. Copy the generated **Client ID** (looks like `1234567890-abc123.apps.googleusercontent.com`).

There is **no Client Secret needed** for this flow — the backend only verifies
ID tokens; it never exchanges an authorization code.

### Backend env

Set the same Client ID on the backend (`.env`):

```
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

It is read at startup (`config/config.go`, key `GOOGLE_CLIENT_ID`) and used as
the **expected audience** when verifying tokens
(`internal/infrastructure/auth/google_verifier.go`). If it is empty, the
endpoint returns `401` — Google sign-in is effectively disabled
(`google_verifier.go`, `errNotConfigured`).

### Frontend env

The **same** Client ID is public and used by the browser SDK:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

---

## 3. Frontend integration (Next.js) — reference only

> Not part of the backend contract, included so the FE knows what to send. Any
> library that yields a Google **ID token** works; example uses
> `@react-oauth/google`.

```tsx
// app/providers.tsx
import { GoogleOAuthProvider } from "@react-oauth/google";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      {children}
    </GoogleOAuthProvider>
  );
}
```

```tsx
// components/GoogleLoginButton.tsx
import { GoogleLogin } from "@react-oauth/google";

export function GoogleLoginButton() {
  return (
    <GoogleLogin
      onSuccess={async (cred) => {
        // cred.credential IS the Google ID token (a JWT).
        const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: cred.credential }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const { access_token } = await res.json();
        // Store access_token (memory / httpOnly cookie via a route handler /
        // localStorage per your security model) and use it as Bearer for
        // protected routes.
      }}
      onError={() => {
        /* show a generic sign-in error */
      }}
    />
  );
}
```

> The token the FE sends **must** be the Google **ID token** (a JWT with three
> dot-separated parts), not an OAuth access token. With `@react-oauth/google`'s
> `<GoogleLogin>` component this is `credentialResponse.credential`.

---

## 4. Endpoint

### `POST /api/v1/auth/google` — sign in with a Google ID token

Source: route `internal/handler/auth_handler.go` (`RegisterRoutes` →
`rg.POST("/google", h.GoogleLogin)`); handler `GoogleLogin`; logic
`internal/usecase/auth_usecase.go` (`LoginWithGoogle`).

- **Auth:** none (this is how you obtain a token).
- **Request body:**

| field      | type   | required | validation                                                                                                                                      |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id_token` | string | yes      | non-empty; must be a valid, unexpired Google ID token whose `aud` equals the backend's `GOOGLE_CLIENT_ID`, and whose `email_verified` is `true` |

```json
{ "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..." }
```

- **200 — signed in** (identical envelope to password login,
  `auth_handler.go` `GoogleLogin`):

```json
{
  "data": {
    "id": "3f6a9c1e-8b2d-4e7a-9c11-0a2b3c4d5e6f",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "created_at": "2026-07-12T09:30:00Z",
    "updated_at": "2026-07-12T09:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```

- The `access_token` is the **app's own JWT** (HS256, 24h) — the same kind returned by `POST /auth/login`. Use it as `Authorization: Bearer <token>` on protected routes. The Google ID token itself is **not** reused after this call.
- `password` is never present in `data` (hidden — `internal/domain/user.go`).
- A brand-new Google user has **no password**, so they cannot use `POST /auth/login`; they must always sign in via Google (see §5).

- **Errors** (shape `{ "error": "<message>" }`):

| status | `error` message                             | cause                                                                                                                          |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | validator message (e.g. missing `id_token`) | body failed binding (`ShouldBindJSON`)                                                                                         |
| `400`  | `bad request`                               | `id_token` was empty after binding (defensive)                                                                                 |
| `401`  | `unauthorized`                              | token invalid/expired, wrong audience, `email_verified=false`, missing `sub`/`email`, **or** `GOOGLE_CLIENT_ID` not configured |
| `500`  | `internal server error`                     | unexpected DB/server error                                                                                                     |

All the distinct `401` causes return the **same** `unauthorized` message on
purpose — do not try to distinguish them on the FE; show a generic
"Google sign-in failed, please try again."

---

## 5. Account resolution & linking rules (backend behavior)

When a valid, email-verified Google token arrives, the backend resolves the
account in this order (`internal/usecase/auth_usecase.go`, `LoginWithGoogle`):

1. **Already linked** — if this Google account (`provider = "google"`, `provider_user_id = <Google sub>`) is already in `user_identities`, sign that user in.
2. **Link by email** — else, if a local user exists with the **same email**, link the Google account to that existing user and sign them in. (This is how a user who first registered with email/password can later "Continue with Google" into the same account.)
3. **Create** — else, create a new passwordless user (`email`, `name` from the token; `name` falls back to the email if Google sends none) and link the Google account.

**Rules the FE should know:**

- **`email_verified` is mandatory.** Unverified Google emails are rejected (`401`) to prevent account takeover.
- **One Google account ↔ one user.** Enforced by a `UNIQUE(provider, provider_user_id)` constraint (`migrations/000005_create_user_identities_table.up.sql`).
- **Email is normalized** (lowercased/trimmed) before matching (`auth_usecase.go`).
- **No separate "sign up" step.** The same endpoint both registers and logs in — the FE shows a single "Continue with Google" button for both cases.
- **Users created via Google have no password.** Don't offer them the password-login form unless they later set a password (no such endpoint exists yet — see §7).

---

## 6. Data model touched

New table `user_identities` (`migrations/000005_create_user_identities_table.up.sql`),
domain type `domain.UserIdentity` (`internal/domain/identity.go`):

| column             | type        | notes                                 |
| ------------------ | ----------- | ------------------------------------- |
| `id`               | UUID        | PK                                    |
| `user_id`          | UUID        | FK → `users(id)`, `ON DELETE CASCADE` |
| `provider`         | text        | `"google"` (only provider today)      |
| `provider_user_id` | text        | Google `sub`                          |
| `created_at`       | timestamptz |                                       |
| —                  | —           | `UNIQUE(provider, provider_user_id)`  |

This table is **internal** — it is not exposed by any endpoint. The FE never
reads or writes it.

**Migration:** run `make migrate-up` to apply `000005` before using the endpoint.

---

## 7. ⚠️ Assumptions / To confirm

1. **No password-set / linking-management endpoints yet.** A Google-only user cannot later log in with a password, and there is no endpoint to "add a password" or "unlink Google". Confirm whether these are needed.
2. **Google is the only provider.** The schema (`user_identities`) is provider-generic and ready for more (GitHub, etc.), but only `google` is wired (`domain.ProviderGoogle`). No other provider endpoint exists.
3. **User creation + identity link are two sequential writes, not one transaction** (`LoginWithGoogle`). In the rare case the second write fails, a passwordless user row could exist without a linked identity; the next attempt would then link via the email path (step 2). Confirm whether a DB transaction is required.
4. **No refresh token** (same as the rest of the API). The 24h app JWT hard-expires; the FE must re-run Google sign-in (or password login) afterward.
5. **`GOOGLE_CLIENT_ID` must be set** in the backend environment or the endpoint returns `401` for every request. Confirm it is provisioned per environment (dev/prod may use different OAuth clients).
