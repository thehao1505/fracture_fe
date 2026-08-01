# FE_GUIDELINE.md — Backend Contract for the Fracture API

> Purpose: this document is the **frontend↔backend contract** for the Fracture
> API. It is extracted entirely from the Go source (Gin + PostgreSQL/pgx + JWT).
> Every endpoint, field, status code and rule below cites the source file:line
> it came from. **Nothing here is guessed** — uncertain points are in §8.
>
> Stack: Go 1.25 · Gin · pgx/PostgreSQL · sqlc · JWT (HS256).
> Module: `github.com/lukenguyen/fracture`.
>
> Improvement backlog (FE-side + backend asks): see
> [FE_ENHANCEMENTS.md](./FE_ENHANCEMENTS.md).

---

## 1. System Overview

Fracture is a **link-in-bio** backend (think Linktree-style): a user registers,
creates **one profile** identified by a public `username`, adds ordered
**blocks** (links, social icon rows, headers) to it, and publishes it. Anyone
can then view the published profile at its username and click its links (clicks
are counted).

**Actors**
- **Anonymous visitor** — reads a published public profile and records link clicks. No token.
- **Authenticated user** — owns exactly one profile, manages their profile + blocks, and can perform generic user CRUD. Needs a JWT.

**Main flows**
1. `register` → `login` → obtain JWT (`cmd/api/main.go:81`, `internal/handler/auth_handler.go`).
2. Authenticated user creates profile → adds/edits/reorders blocks → publishes (`internal/handler/profile_handler.go`, `internal/handler/block_handler.go`).
3. Visitor loads `GET /profile/{username}` and posts click events (`internal/handler/profile_handler.go:100,123`).

> ⚠️ There is **no role system** and **no ownership check on the `/users/*`
> CRUD endpoints** — any authenticated user can read/update/delete any user. See
> §2 and §8.

---

## 2. Auth & Authorization

### Mechanism
- **JWT bearer access token**, signed HS256 (`pkg/token/jwt.go:52`).
- Obtained from `POST /api/v1/auth/login` (`internal/handler/auth_handler.go:85`).
- **Lifetime: 24h** by default (`JWT_EXPIRY`, default `"24h"` — `config/config.go:41`).
- **No refresh token, no logout, no revocation.** When the token expires the user must log in again. (`pkg/token/jwt.go` exposes only `Generate`/`Parse`.)

### Required header on protected routes
```
Authorization: Bearer <access_token>
```
Parsing is case-insensitive on the `Bearer` scheme and requires a non-empty
token, else `401` (`internal/handler/middleware/auth.go:23-28`). The token from
login has `token_type: "Bearer"` (`internal/handler/auth_handler.go:105`).

### Token payload (claims) — informational
The JWT contains `uid` (user UUID) and `email` (`pkg/token/jwt.go:21-25`). The FE
does not need to parse it, but may decode it client-side to read these.

### Roles → permissions → routes
There are **no roles/scopes in the code**. Authorization is binary: a route is
either public or requires a valid token (`cmd/api/main.go:78-93`).

| Access level | How enforced | Allowed routes |
|---|---|---|
| **Anonymous** | none | `POST /auth/register`, `POST /auth/login`, `GET /profile/:username`, `POST /profile/:username/blocks/:id/click`, `GET /health`, `GET /swagger/*` |
| **Authenticated** (any valid JWT) | `AuthRequired` middleware (`middleware/auth.go:21`) | everything under `/users/*` and `/me/*` |

> ⚠️ `/users/*` is authenticated but **not scoped to the caller** — a logged-in
> user can operate on *any* user id. Only `/me/*` is scoped to the token owner
> (`internal/usecase/profile_usecase.go`, via `currentUserID`). See §7/§8.

---

## 3. API Conventions

- **Base URL:** `http://localhost:8080` in dev (`APP_PORT=8080`, `.env`; `main.go:96`).
- **API prefix / versioning:** all business routes are under **`/api/v1`** (`cmd/api/main.go:78`). `/health` and `/swagger` are **not** under the prefix (`main.go:74,76`).
- **Date/time format:** Go `time.Time` → **RFC 3339 / ISO 8601 UTC**, e.g. `"2026-07-11T09:30:00Z"` (may include sub-second precision). All timestamps are generated with `time.Now().UTC()` (`usecase/*.go`), so **timezone is always UTC**.
- **IDs:** all resource ids are **UUID v4** strings (`github.com/google/uuid`).
- **Content type:** request and response bodies are JSON.

### Response envelope
There is **no single unified envelope**; keys depend on the endpoint:
- Resource returned: `{"data": <object|array>}` (most GET/POST).
- Login also adds top-level `access_token` + `token_type` (`auth_handler.go:102`).
- Pure mutations return `{"message": "<text>"}` (`user_handler.go:155`, etc.).
- Click returns `{"url": "<destination>"}` (`profile_handler.go:138`).
- Errors always return `{"error": "<message>"}` (see §6).

### Pagination (list users only)
Query params `page` (default 1) and `limit` (default 20, **capped at 100**)
(`usecase/user_usecase.go:107-115`). Response includes:
```json
"pagination": { "page": <int>, "limit": <int>, "total": <int> }
```
> ⚠️ **Gotcha:** the handler echoes the **raw, un-normalized** `page`/`limit` it
> parsed from the query string, not the effective values used for the query. If
> the client omits them, `page` and `limit` come back as **`0`** even though the
> data was fetched with page 1 / limit 20 (`user_handler.go:206-227` vs the
> normalization in `user_usecase.go:107`). Compute display values on the FE; do
> not trust the echoed `page`/`limit`.

### Filter / sort
- `/users` supports a single `keyword` query param (matches name or email) (`user_handler.go:208`, `user_usecase.go:119`). No sort param exists.
- No generic filtering/sorting convention elsewhere.

### CORS
> ⚠️ **No CORS middleware is configured anywhere** (verified: no `cors` usage in
> the Go source). A browser SPA on a different origin will be blocked until CORS
> is added server-side. See §8.

---

## 4. Endpoint Catalog

All paths below are **actual mounted routes** (from `cmd/api/main.go` +
`RegisterRoutes`), which is authoritative. Note the Swagger godoc comments use
`/p/{username}` but the code mounts the public profile group at **`/profile`**
(`main.go:82`) — trust the paths in this section.

Prefix for everything in this section: **`/api/v1`**.

---

### 4.0 `GET /health` — liveness (NOT under `/api/v1`)
- Auth: none.
- 200: `{"status":"ok"}` (`main.go:24`).

---

### AUTH (public)

#### `POST /api/v1/auth/register` — create an account
Source: `auth_handler.go:50`, `usecase/auth_usecase.go:25`.
- Auth: none.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `email` | string | yes | valid email (`binding:"required,email"`) |
| `password` | string | yes | min 8, max 72 chars (`binding:"required,min=8,max=72"`) |
| `name` | string | yes | non-empty |

- **201** — account created:
```json
{
  "data": {
    "id": "3f6a9c1e-8b2d-4e7a-9c11-0a2b3c4d5e6f",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "created_at": "2026-07-11T09:30:00Z",
    "updated_at": "2026-07-11T09:30:00Z"
  }
}
```
  (`password` is never returned — `domain/user.go:12` `json:"-"`.)
- Errors: `400` invalid body (validator message), `409` `{"error":"resource already exists"}` (email taken, `auth_usecase.go:31`), `500`.

#### `POST /api/v1/auth/login` — obtain token
Source: `auth_handler.go:85`, `usecase/auth_usecase.go:60`.
- Auth: none.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `email` | string | yes | valid email |
| `password` | string | yes | non-empty |

- **200**:
```json
{
  "data": {
    "id": "3f6a9c1e-8b2d-4e7a-9c11-0a2b3c4d5e6f",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "created_at": "2026-07-11T09:30:00Z",
    "updated_at": "2026-07-11T09:30:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```
- Errors: `400` invalid body; `401` `{"error":"invalid email or password"}` — **same message for unknown email and wrong password** (`auth_usecase.go:60-71`); `500`.

---

### USERS (auth required — generic CRUD, NOT scoped to caller)

> ⚠️ These are separate from `/auth/register`. `POST /users` creates a user with
> **no password** (password defaults to `''`) — such a user cannot log in
> (`user_usecase.go:33`, migration `000002`). Treat `/users/*` as admin/utility
> CRUD; see §8.

#### `GET /api/v1/users/{id}` — get user by id
Source: `user_handler.go:51`.
- Auth: Bearer required.
- Path param: `id` — UUID, required.
- **200**: `{"data": <user>}` (same user shape as above).
- Errors: `400` `{"error":"invalid id format"}` (bad UUID); `404` `{"error":"resource not found"}`.

#### `POST /api/v1/users` — create user
Source: `user_handler.go:80`.
- Auth: Bearer required.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `email` | string | yes | valid email |
| `name` | string | yes | non-empty |

- **201**: `{"data": <user>}` (created user; `password` empty/hidden).
- Errors: `400` invalid body; `409` email exists; `500`.

#### `PUT /api/v1/users/{id}` — update user
Source: `user_handler.go:123`, `user_usecase.go:52`.
- Auth: Bearer required.
- Path param: `id` — UUID, required.
- Request body (partial update; at least one of email/name must be non-empty):

| field | type | required | validation |
|---|---|---|---|
| `email` | string | no | if present, valid email (`omitempty,email`); empty string = "leave unchanged" |
| `name` | string | no | empty string = "leave unchanged" |

  Behaviour: only non-empty fields overwrite existing values (`user_usecase.go:75-80`). Sending both empty → `400 bad request`.
- **200**: `{"message":"user updated successfully"}`.
- Errors: `400` invalid id or empty body; `404` not found; `409` email exists; `500`.

#### `DELETE /api/v1/users/{id}` — delete user
Source: `user_handler.go:171`.
- Auth: Bearer required.
- Path param: `id` — UUID, required.
- **200**: `{"message":"user deleted successfully"}`.
- Errors: `400` invalid id; `404` not found; `500`.

#### `GET /api/v1/users` — list users
Source: `user_handler.go:205`, `user_usecase.go:105`.
- Auth: Bearer required.
- Query params:

| name | type | required | constraints |
|---|---|---|---|
| `page` | int | no | default 1; values < 1 treated as 1 |
| `limit` | int | no | default 20; **max 100** (higher is capped) |
| `keyword` | string | no | matches name **or** email |

- **200**:
```json
{
  "data": [
    { "id": "…", "email": "jane@example.com", "name": "Jane Doe",
      "created_at": "2026-07-11T09:30:00Z", "updated_at": "2026-07-11T09:30:00Z" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42 }
}
```
  (See §3 pagination gotcha: echoed `page`/`limit` are the raw query values, `0` when omitted.)
- Errors: `401` unauthorized; `500`.

---

### ME — PROFILE (auth required, scoped to token owner)

#### `GET /api/v1/me/profile` — get my profile (full, incl. drafts + all blocks)
Source: `profile_handler.go:151`, `usecase/profile_usecase.go:208`.
- Auth: Bearer required.
- **200**: full profile including **all** blocks (active and hidden):
```json
{
  "data": {
    "id": "a1…",
    "user_id": "3f6a…",
    "username": "jane",
    "display_name": "Jane",
    "bio": "hi there",
    "avatar_url": "https://cdn.example.com/a.png",
    "appearance": { "theme": "dark" },
    "is_published": true,
    "created_at": "2026-07-11T09:30:00Z",
    "updated_at": "2026-07-11T09:40:00Z",
    "blocks": [
      {
        "id": "b1…",
        "profile_id": "a1…",
        "type": "link",
        "content": { "title": "My site", "url": "https://example.com" },
        "position": 0,
        "is_active": true,
        "click_count": 12,
        "created_at": "2026-07-11T09:31:00Z",
        "updated_at": "2026-07-11T09:31:00Z"
      }
    ]
  }
}
```
- Errors: `401`; `404` `{"error":"resource not found"}` if the user has no profile yet.

#### `POST /api/v1/me/profile` — create my profile (one per user)
Source: `profile_handler.go:172`, `usecase/profile_usecase.go:236`.
- Auth: Bearer required.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `username` | string | yes | normalized (lowercased, trimmed); 3–30 chars; `^[a-z0-9_.]+$`; no leading/trailing `.`, no `..`; not a reserved word (see §5) |
| `display_name` | string | no | free text |
| `bio` | string | no | free text |
| `avatar_url` | string | no | free text (⚠️ **not validated** on create — see §8) |
| `appearance` | object (JSON) | no | must match the appearance schema in §5; `{}` / omitted = default |

- **201**: `{"data": <profile>}` — the created profile (blocks omitted since none yet; `is_published` defaults `false`).
- Errors: `400` invalid body / bad username / bad appearance; `409` `{"error":"resource already exists"}` — the user **already has a profile** *or* the username is taken (`profile_usecase.go:246,257`).

#### `PUT /api/v1/me/profile` — update my profile
Source: `profile_handler.go:208`, `usecase/profile_usecase.go:271`.
- Auth: Bearer required.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `username` | string | yes | same rules as create; only re-validated/uniqueness-checked when it changes |
| `display_name` | string | no | overwrites (empty string clears it) |
| `bio` | string | no | overwrites (empty clears) |
| `avatar_url` | string | no | overwrites (empty clears) |
| `appearance` | object | no | validated; only overwrites when a non-empty value is sent (`profile_usecase.go:299`) |
| `is_published` | bool | no | sets publish state; **defaults to `false` if omitted** (plain bool, see §8) |

  ⚠️ This is a **full replace** of `display_name`/`bio`/`avatar_url`, not a patch — omitted string fields are sent to the DB as empty and will clear existing values. Always send the current values you want to keep.
- **200**: `{"message":"profile updated successfully"}`.
- Errors: `400` invalid body / bad username / bad appearance; `404` profile not found; `409` username taken.

---

### ME — BLOCKS (auth required, scoped to token owner)

Route registration note: `PATCH /me/blocks/reorder` is registered **before**
`/me/blocks/:id` so `reorder` is not treated as an id (`block_handler.go:26-29`).

#### `GET /api/v1/me/blocks` — list my blocks (incl. hidden)
Source: `block_handler.go:58`.
- Auth: Bearer required.
- **200**: `{"data": [ <block>, … ]}` — full block objects (see block shape in `GET /me/profile` above), ordered by `position`.
- Errors: `401`; `404` profile not found.

#### `POST /api/v1/me/blocks` — create a block
Source: `block_handler.go:79`, `usecase/profile_usecase.go:322`.
- Auth: Bearer required.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `type` | string | yes | one of `link` / `socials` / `header` (§5) |
| `content` | object (JSON) | yes | must match the schema for `type` (§5), **unknown fields rejected** |

- Server sets: `position` = end of list, `is_active` = `true`, `click_count` = `0` (`profile_usecase.go:344-350`).
- Max **100 blocks** per profile (`profile_usecase.go:18,339`) → `400` beyond that.
- **201**: `{"data": <block>}` (full block).
- Errors: `400` invalid body / invalid type / invalid content / limit reached; `404` profile not found.

#### `PUT /api/v1/me/blocks/{id}` — update a block
Source: `block_handler.go:112`, `usecase/profile_usecase.go:356`.
- Auth: Bearer required.
- Path param: `id` — UUID, required (`400 invalid id format` if not a UUID).
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `type` | string | yes | valid block type (§5) |
| `content` | object | yes | must match schema for `type`, unknown fields rejected |
| `is_active` | bool \| omitted | no | **pointer semantics**: omit = keep current visibility; `true`/`false` = set it (`profile_usecase.go:376`) |

- **200**: `{"message":"block updated successfully"}`.
- Errors: `400` invalid id / body / content; `404` profile not found **or** block not owned by caller (IDOR-safe, returns not found — `profile_usecase.go:370`).

#### `DELETE /api/v1/me/blocks/{id}` — delete a block
Source: `block_handler.go:150`.
- Auth: Bearer required.
- Path param: `id` — UUID, required.
- **200**: `{"message":"block deleted successfully"}`.
- Errors: `400` invalid id; `404` profile not found.

#### `PATCH /api/v1/me/blocks/reorder` — reorder blocks
Source: `block_handler.go:177`, `usecase/profile_usecase.go:413`.
- Auth: Bearer required.
- Request body:

| field | type | required | validation |
|---|---|---|---|
| `order` | string[] (UUIDs) | yes | must be the **exact set** of the profile's current block ids — same count, no missing, no extra, no duplicates |

```json
{ "order": ["b3…", "b1…", "b2…"] }
```
- **200**: `{"message":"blocks reordered successfully"}`.
- Errors: `400` invalid UUID in list, or the set doesn't exactly match existing blocks (`profile_usecase.go:423-439`); `404` profile not found.

---

### PROFILE (public — NO auth)

Mounted at `/api/v1/profile` (`main.go:82`). *(Swagger says `/p/{username}`; the
code path is `/profile/{username}` — trust the code. See §8.)*

#### `GET /api/v1/profile/{username}` — public profile page
Source: `profile_handler.go:100`, `usecase/profile_usecase.go:222`.
- Auth: none.
- Path param: `username` — string (server lowercases/trims before lookup).
- Only returns the profile **if it is published**; returns **only active blocks**. Sensitive fields (`user_id`, `is_published`, block `position`/`is_active`/`click_count`) are **stripped** (`profile_handler.go:72-89`).
- **200**:
```json
{
  "data": {
    "username": "jane",
    "display_name": "Jane",
    "bio": "hi there",
    "avatar_url": "https://cdn.example.com/a.png",
    "appearance": { "theme": "dark" },
    "blocks": [
      { "id": "b1…", "type": "link", "content": { "title": "My site", "url": "https://example.com" } }
    ]
  }
}
```
- Errors: `404` `{"error":"resource not found"}` if the username doesn't exist **or the profile isn't published** (indistinguishable).

#### `POST /api/v1/profile/{username}/blocks/{id}/click` — record a link click
Source: `profile_handler.go:123`, `usecase/profile_usecase.go:446`.
- Auth: none.
- Path params: `username` (string), `id` (block UUID).
- Only works for a **published** profile, an **active** block, of **type `link`**, with a valid `url` in its content. Increments `click_count` server-side and returns the destination for the FE to redirect to.
- **200**: `{"url":"https://example.com"}`.
- Errors: `400` `{"error":"invalid id format"}` (bad UUID) or `{"error":"bad request"}` (block is not a clickable link / no url); `404` profile or block not found.

---

## 5. Data Models / Enums

### User (`internal/domain/user.go`)
| field | type | notes |
|---|---|---|
| `id` | string (UUID) | |
| `email` | string | unique |
| `name` | string | |
| `created_at` | string (RFC3339 UTC) | |
| `updated_at` | string (RFC3339 UTC) | |
| `password` | — | **never serialized** (`json:"-"`) |

### Profile (`internal/domain/profile.go:42`)
| field | type | notes |
|---|---|---|
| `id` | string (UUID) | |
| `user_id` | string (UUID) | owner; **omitted from public view** |
| `username` | string | unique, lowercase |
| `display_name` | string | default `""` |
| `bio` | string | default `""` |
| `avatar_url` | string | default `""` |
| `appearance` | object (JSONB) | default `{}`; schema below |
| `is_published` | bool | default `false`; **omitted from public view** |
| `created_at` / `updated_at` | string (RFC3339 UTC) | |
| `blocks` | Block[] | present on `/me/profile`; omitted when empty (`omitempty`) |

### Block (`internal/domain/profile.go:30`)
| field | type | notes |
|---|---|---|
| `id` | string (UUID) | |
| `profile_id` | string (UUID) | owning profile; **omitted from public view** |
| `type` | string enum | `link` / `socials` / `header` |
| `content` | object (JSONB) | shape depends on `type` (below) |
| `position` | int | order, 0-based; **omitted from public view** |
| `is_active` | bool | visibility; **omitted from public view** |
| `click_count` | int | **omitted from public view** |
| `created_at` / `updated_at` | string (RFC3339 UTC) | |

**PublicBlock** (public view, `profile.go:65`) exposes only `id`, `type`, `content`.

### Enum: BlockType (`internal/domain/profile.go:24`)
| value | meaning | `content` schema (validated in `usecase/profile_usecase.go:98`) |
|---|---|---|
| `link` | a single titled link/button | `{ "title": string(1–80, req), "url": http/https(req), "icon"?: string, "thumbnail"?: string }` |
| `socials` | a row of social icons | `{ "items": [ { "platform": <enum below>, "url": http/https } ] }` — 1–20 items |
| `header` | a text divider/heading | `{ "text": string(1–80, req) }` |

> `content` is validated with **strict unmarshal** — any field not listed above
> causes `400 bad request` (`profile_usecase.go:65`).

### Enum: social `platform` (`usecase/profile_usecase.go:90`)
`instagram`, `github`, `x`, `twitter`, `youtube`, `tiktok`, `facebook`,
`linkedin`, `threads`, `twitch`, `discord`, `telegram`, `spotify`, `email`,
`website`. (Any other platform → `400`.)

### Appearance schema (`usecase/profile_usecase.go:158`)
Empty or `{}` = default. Otherwise (strict — unknown fields rejected):
| field | type | allowed values |
|---|---|---|
| `theme` | string | `""`, `dark`, `light` |
| `background` | object | `{ "type": "color"\|"gradient"\|"image"\|"", "value": string }` — if `type` is `color`, `value` **must** be a 6-digit hex `#rrggbb`; for `gradient`/`image`/`""` the value is free-form |
| `button` | object | `{ "style": "rounded"\|"sharp"\|"pill"\|"", "color": "#rrggbb" }` — `color` if present must be 6-digit hex |
| `font` | string | free text |

Hex color regex: `^#[0-9a-fA-F]{6}$` (`profile_usecase.go:155`).

### Reserved usernames (`usecase/profile_usecase.go:36`) — rejected with `400`
`admin`, `api`, `app`, `login`, `register`, `health`, `swagger`, `me`, `p`,
`www`, `support`, `about`, `auth`, `user`, `users`.

> **FE routing convention:** public profile pages are served at the **root**
> path **`/{username}`** (e.g. `fracture.app/jane`), backed by
> `GET /api/v1/profile/{username}`. Static FE routes always win over the
> dynamic `/{username}` segment, so the FE's own top-level paths that are
> **not** in the reserved list above — currently **`dashboard`** and
> **`logout`** — would shadow a profile with that username. See §8.11.

---

## 6. Standard Error Format

All error responses share the shape:
```json
{ "error": "<message>" }
```
(`respondInternal` at `handler/response.go:15`; every handler uses `gin.H{"error": …}`.)

There is **no field-level/validation-error object**. Two message families:

**A. Domain error messages** (stable, safe to switch on) — `internal/domain/errors.go`:
| message | typical status | meaning |
|---|---|---|
| `invalid id format` | 400 | path/body UUID couldn't be parsed |
| `bad request` | 400 | failed a business validation rule |
| `resource not found` | 404 | missing (or not-published / not-owned) resource |
| `resource already exists` | 409 | unique conflict (email / username / second profile) |
| `invalid email or password` | 401 | login failed |
| `unauthorized` | — | defined but see auth middleware messages below |

**B. Binding/validation messages** (from Gin's validator, on `ShouldBindJSON`)
— verbose Go strings like
`Key: 'registerRequest.Email' Error:Field validation for 'Email' failed on the 'email' tag`.
These are returned **verbatim** as `error` with status `400`
(`auth_handler.go:52-54`). **Treat these as opaque** — do not parse; show a
generic per-form message and rely on client-side validation mirroring §4/§5.

**C. Auth middleware** (`middleware/auth.go`), status `401`:
- `missing or malformed authorization header`
- `invalid or expired token`

**D. Internal**: status `500`, always `{"error":"internal server error"}` — real details are logged server-side only (`response.go:13-16`).

### FE mapping guidance
- `401` on a protected call → token missing/expired → route to login (no refresh flow).
- `409` on register/create-user → "email already in use"; on create/update profile → "username taken" *or* "you already have a profile" (same message — disambiguate by context).
- `404` on `GET /profile/:username` → treat as "page not found" (could be unpublished).
- `400` with a verbose validator string → show generic form error.

---

## 7. Business Rules Affecting the UI

1. **One profile per user.** `POST /me/profile` returns `409` if the user already has one (`profile_usecase.go:246`). FE: after first creation, switch to the edit (`PUT`) flow; check via `GET /me/profile` (404 = none yet).
2. **Publishing gates public visibility.** A profile is only reachable at `/profile/:username` when `is_published = true`; otherwise `404`. Surface a publish toggle and a "not published" state.
3. **Public page shows only active blocks.** Hidden blocks (`is_active=false`) are excluded from the public view and from click handling. `/me/blocks` shows all.
4. **Owner-only editing / IDOR-safe.** All `/me/*` operations act on the token owner's profile only; a block id not owned by the caller returns `404`, never another user's data (`profile_usecase.go:369-370,382`). FE never needs to send `profile_id`/`user_id` — the server ignores/derives them.
5. **Block limit: 100 per profile.** Disable "add block" at 100; server returns `400` (`profile_usecase.go:18,339`).
6. **New blocks append to the end**, start visible (`is_active=true`) with `click_count=0`. Reordering is a separate explicit call.
7. **Reorder must send the complete set.** `order` must list every current block id exactly once — no partial reorder. Build it from the full current list (`profile_usecase.go:423`).
8. **`is_active` update semantics.** In `PUT /me/blocks/:id`, omit `is_active` to preserve current visibility; send `true`/`false` to change it. Send it explicitly only when toggling.
9. **Profile string fields are full-replace on update.** `PUT /me/profile` overwrites `display_name`/`bio`/`avatar_url` with whatever you send (empty = cleared). Pre-fill the form with current values.
10. **Username normalization + rules.** Lowercased & trimmed server-side; 3–30 chars; only `a-z 0-9 _ .`; no leading/trailing dot or `..`; not a reserved word (§5). Mirror these client-side; a normalized dup returns `409`.
11. **Only `link` blocks are clickable.** The click endpoint rejects non-`link` blocks (`400`). Render only `link` blocks as click-tracked anchors; for others, link directly.
12. **Click flow is server-mediated.** To count a click, `POST …/blocks/:id/click`, then redirect the browser to the returned `url` (don't just navigate to the href if you want the count).
13. **URLs must be http/https.** `javascript:`/`data:` and schemeless URLs are rejected server-side (`400`) to prevent XSS (`profile_usecase.go:72`). Validate the same on the FE before submit.
14. **Password length.** Register requires 8–72 chars (bcrypt 72-byte cap). Enforce in the signup form (`auth_handler.go:19`).
15. **No password on `POST /users`.** Users created via `/users` (not `/register`) have an empty password and can't log in. Don't present `/users` create as a signup path.

---

## 8. ⚠️ Assumptions / To Confirm

1. **CORS is not configured** in the Go source (no `cors` middleware found). A browser SPA on a different origin will fail preflight/requests until the backend adds CORS. **Confirm** whether CORS is handled by a reverse proxy/gateway in deployment.
2. **Public profile path discrepancy.** Swagger godoc comments say `/p/{username}` and `/p/{username}/blocks/{id}/click`, but `main.go:82` mounts the group at **`/profile`**, so the real routes are `/api/v1/profile/:username[/blocks/:id/click]`. This doc uses the code paths. **Confirm** which is intended before publishing links.
   *Resolved for the FE:* the FE calls the code paths (`/api/v1/profile/…`) and serves the public page at the root URL **`/{username}`** (not `/p/{username}` — see §5 "FE routing convention").
3. **`avatar_url` is not validated** on profile create/update (unlike block URLs, which must be http/https). A malicious/`javascript:` avatar URL could reach the client — the FE should sanitize `avatar_url` before rendering. **Confirm** intended validation.
4. **`is_published` on `PUT /me/profile` is a non-pointer bool** (`profile_handler.go:49`), so **omitting it sends `false`** and will unpublish the profile. Always send the intended value explicitly. **Confirm** this is desired (contrast with block `is_active`, which uses pointer semantics).
5. **Pagination echo bug** (§3): the response's `page`/`limit` reflect raw query values (0 when omitted), not the effective values. **Confirm** whether this will be fixed; until then, compute display values on the FE.
6. **No roles / no authorization scoping on `/users/*`.** Any authenticated user can read/update/delete any user and list all users. **Confirm** whether `/users/*` is meant to be admin-only / removed / scoped — it is a likely access-control gap.
7. **No token refresh / logout / revocation.** Tokens are valid 24h then hard-expire. **Confirm** whether a refresh mechanism is planned; FE must handle silent expiry by redirecting to login.
8. **Exact timestamp precision** (sub-second, trailing `Z`) is Go's default RFC3339Nano-ish output; treat as ISO 8601 and parse with a tolerant parser. Sample values in this doc are illustrative.
9. **`created_at`/`updated_at` on blocks/profile in responses** come from `time.Now().UTC()` set in the usecase, then persisted; the value returned by create endpoints is the in-memory value (not a DB round-trip). Assumed equal to stored value.
10. **`content` object contents beyond validated fields**: for `link`, `icon`/`thumbnail` are accepted but not format-validated (any string). Confirm expected formats (URL? icon name?) for correct rendering.
11. **Reserved list doesn't cover all FE routes.** Public pages live at root `/{username}` (§5), but the backend's reserved-username list is missing the FE's top-level paths **`dashboard`** and **`logout`** — a user who registers one of those usernames gets a page that is shadowed (unreachable) on the web FE. **Confirm**: backend should add `dashboard` and `logout` (and any future FE top-level path) to the reserved list in `profile_usecase.go:36`.
12. **`appearance` is returned as `null`, not `{}`.** §5 documents the default as `{}`, but the live API serializes an unset appearance as JSON `null` (verified against the running backend). FE types treat it as `Appearance | null`. **Confirm** whether the backend will normalize to `{}`.
