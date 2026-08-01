# FE_ENHANCEMENTS.md — Frontend Improvement Backlog

> Companion to [FE_GUIDELINE.md](./FE_GUIDELINE.md) (the backend contract).
> This file tracks improvements **on top of** the current implementation —
> what the FE can do on its own, and what needs backend changes first.
> Ordered by impact within each section.

Current state (2026-07-12): all contract screens are built and verified
end-to-end — auth, dashboard (profile + blocks editor), public page at
`/{username}` with server-mediated click tracking, and the `/users` utility
screens. `tsc` / `eslint` / `next build` clean.

---

## A. FE-only enhancements (no backend change required)

### A1. Cache public pages with Cache Components ⭐ highest impact
**Problem:** `/{username}` is the hot path (it's the URL people share), but
every request currently hits the Go API (`fetch` with `cache: "no-store"`).

**Proposal:** since *all* mutations flow through this app's server actions,
Next can own the cache and invalidate it precisely:
- Enable `cacheComponents: true` in `next.config.ts`.
- Wrap the public-profile fetch in `'use cache'` + `cacheTag('profile:' + username)`.
- Call `updateTag('profile:' + username)` in every profile/block server action
  (`app/dashboard/actions.ts`).

**Result:** public pages serve from cache instantly and update the moment the
owner saves. Also unlocks `unstable_instant` route validation (Next 16).

**Caveat:** if anything ever mutates profiles *without* going through this app
(direct API use, another client), the tag never gets purged — add a fallback
`cacheLife` profile (e.g. minutes) as a safety net.

### A2. Optimistic UI for the blocks manager
**Problem:** reorder (↑/↓), hide/show, and delete all wait for a server
round-trip + `revalidatePath` before the list visibly changes.

**Proposal:**
- `useOptimistic` in `components/dashboard/blocks-manager.tsx` so the list
  updates immediately and reconciles when the action resolves.
- Upgrade reorder from arrow buttons to drag-and-drop (`dnd-kit`); keep the
  arrows for keyboard accessibility. Reorder must still submit the **complete
  id set** (guideline §7.7).

### A3. Live username availability check
**Problem:** username conflicts (409) only surface after submit.

**Proposal:** debounce-check while typing in the create/edit profile forms.
Client-side rules (regex, length, reserved words — `lib/validation.ts`) can
run on every keystroke today. A true *taken/free* check needs backend help
(see B3): `GET /api/v1/profile/:username` only sees **published** profiles, so
it can produce false "available" answers for unpublished ones.

### A4. Live preview in the dashboard
Linktree-style phone-frame preview next to the editor, rendering the public
page with the values currently in the form. The rendering logic is already
isolated (`lib/appearance.ts` + the public page markup) — extract a shared
`<ProfilePreview>` component and feed it form state.

### A5. Token-expiry UX (mitigation only — real fix is B1)
**Problem:** tokens hard-expire after 24h with no refresh (§2, §8.7). A user
mid-edit loses their form input: submit → 401 → redirect to `/login`.

**Proposal:**
- Decode the JWT `exp` client-side (payload already carries it, §2) and show a
  "session expires soon — save your work" banner.
- Before an expiry-triggered redirect, stash unsaved form state in
  `localStorage` and restore it after re-login.

### A6. Open Graph images for public pages
Add a dynamic `opengraph-image` under `app/[username]/` (avatar + display
name + theme colors) so shared links unfurl nicely. For a link-in-bio product,
social sharing *is* the distribution channel.

### A7. Smaller polish items
- **Real SVG icons** for the socials row (platform enum §5 is fixed — 15
  icons), instead of text chips.
- **`target="_blank"`** on public link blocks (keep the `/go/` click-tracking
  redirect; §7.12 still holds).
- Replace `window.confirm` (block delete, user delete) with an in-app dialog.
- **Playwright E2E suite** codifying the manual smoke test: register → create
  profile → add block → publish → visit `/{username}` → click → count
  incremented. Run against a disposable backend DB.
- **`unauthorized.tsx` / `forbidden.tsx`** (Next 16 file conventions) if/when
  roles arrive (B-section).

---

## B. Blocked on backend changes (proposals for the API team)

> These extend the "⚠️ Assumptions / To confirm" items in FE_GUIDELINE.md §8.

### B1. Refresh token / sliding session (extends §8.7)
The single biggest UX problem the FE cannot fix. 24h hard expiry logs users
out mid-session with no warning. Ask: a refresh endpoint (or sliding-expiry
tokens). Until then A5 is the mitigation.

### B2. PATCH semantics for `PUT /me/profile` (extends §8.4)
Full-replace + non-pointer `is_published` forces the FE to GET-then-PUT just
to toggle publish (`togglePublishAction`), costing a round-trip and racing if
two tabs are open. Ask: pointer/`omitempty` semantics like block `is_active`
(§4), or a dedicated `POST /me/profile/publish` toggle.

### B3. Username availability endpoint
`GET /profile/:username` 404s for unpublished profiles (§4), so the FE cannot
distinguish *free* from *taken-but-unpublished*. Ask: `HEAD /api/v1/usernames/:name`
(or similar) returning 200/404, no auth. Unblocks A3 fully.

### B4. Structured validation errors (extends §6.B)
Gin's verbose validator strings are returned verbatim and must be treated as
opaque. Ask: `{"errors": [{"field": "...", "message": "..."}]}` so the FE can
attach server-side errors to the right field instead of a generic banner.

### B5. Avatar upload
Only `avatar_url` free-text exists (unvalidated — §8.3). Most users don't
have a hosted image URL. Ask: an upload endpoint or presigned-URL flow; then
the FE replaces the URL input with a file picker + crop.

### B6. Click analytics over time
`click_count` is a lifetime total (§5). A useful dashboard ("clicks, last 7
days") needs a time-series endpoint, e.g.
`GET /me/blocks/:id/clicks?from=&to=` with daily buckets.

### B7. Already filed in FE_GUIDELINE §8 (reminders)
- Reserve `dashboard` + `logout` usernames (§8.11) — root-level `/{username}`
  pages shadow these.
- Normalize `appearance` to `{}` instead of `null` (§8.12).
- CORS (§8.1) — currently moot because the FE proxies everything server-side,
  but blocks any future native/mobile client.
- Scope or gate `/users/*` (§8.6) — the FE shows a warning banner today; the
  real fix is roles server-side.

---

## Suggested order of work

| # | Item | Effort | Depends on |
|---|---|---|---|
| 1 | A1 Cache Components on public pages | S–M | — |
| 2 | A2 Optimistic blocks manager + DnD | M | — |
| 3 | A4 Live preview | M | — |
| 4 | A5 Expiry banner + draft saving | S | — |
| 5 | A6 OG images | S | — |
| 6 | A3 Username availability (client rules now) | S | full version: B3 |
| 7 | A7 polish batch | S | — |
| 8 | B1/B2/B3/B4 | — | backend |
