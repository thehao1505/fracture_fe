# FE Generation Prompts

Two paired prompts. **Prompt 1** produces a `FE_GUIDELINE.md` with a fixed
structure from a backend source. **Prompt 2** consumes exactly that structure
to build the frontend.

---

## Prompt 1 — Generate `FE_GUIDELINE.md` from backend source

```
# ROLE
You are a Senior Frontend Architect. Task: read the ENTIRE backend source and
produce a FE_GUIDELINE.md — a "contract" that lets another AI/dev build the
frontend WITHOUT re-reading the backend.

# INPUT
Backend source is at: <PATH / REPO>.
Backend stack: <e.g. NestJS + PostgreSQL / Spring Boot / Django ...>.

# HOW TO WORK (follow in order)
1. Scan the whole backend. DO NOT guess. Every piece of information must be
   extracted from real code. Prioritize: routers/controllers, DTOs/schemas/
   validation, entities/models, enums, auth middleware, CORS config, error
   handlers, and any OpenAPI/Swagger file if present.
2. For each endpoint, read the handler to determine the ACTUAL request/response
   (including fields added/removed in the service layer), not just the DTO name.
3. If anything is uncertain, record it explicitly under "⚠️ Assumptions / To
   confirm". NEVER invent a field or status code.

# OUTPUT: write a single FE_GUIDELINE.md with this exact structure

## 1. System Overview
- Business domain, main actors/roles, main flows in a few sentences.

## 2. Auth & Authorization
- Mechanism (JWT/session/OAuth), required headers, token refresh flow.
- Table: role → permissions → allowed routes.

## 3. API Conventions
- Base URL, versioning, date/time format, timezone, pagination convention,
  filter/sort convention, response envelope format (if any).

## 4. Endpoint Catalog (the most important section)
For EACH endpoint, use the following block/table:
- Method + Path + one-line description
- Auth: required or not, required role
- Path/Query params: name | type | required? | constraints
- Request body: table of field | type | required? | validation
  (min/max/regex/enum)
- 2xx response: FULL sample JSON + field table
- Possible error codes (4xx/5xx) + error body shape

## 5. Data Models / Enums
- List entities used by the FE, fields + types.
- All enums + values + meaning (for dropdowns, badges, filters).

## 6. Standard Error Format
- Common error shape, e.g. validation error, and how to map messages to the UI.

## 7. Business Rules Affecting the UI
- Business constraints (e.g. only the owner can edit; which state allows which
  action) — things the FE MUST enforce or disable buttons for.

## 8. ⚠️ Assumptions / To Confirm
- Every uncertain point.

# QUALITY REQUIREMENTS
- Every endpoint/field must map back to a file:line in the backend (cite source).
- Sample JSON must be valid JSON, complete, with correct types.
- Do NOT add any FE framework/logic here — this file describes the BACKEND
  CONTRACT only.
```

---

## Prompt 2 — Build the FE from `FE_GUIDELINE.md`

```
# ROLE
You are a Senior Frontend Engineer. Task: build the frontend based on
FE_GUIDELINE.md, treating that file as the SINGLE SOURCE OF TRUTH for
API/business logic.

# INPUT
- Contract: FE_GUIDELINE.md
- FE repo: current directory.
- Stack: <e.g. Next.js (App Router) + TypeScript + TanStack Query + Tailwind>
- Priority features: <list the screens/flows to build first>

# IMPORTANT STACK CONSTRAINT
⚠️ This is NOT the Next.js you know — it has breaking changes to APIs,
conventions, and file structure. BEFORE writing code, you MUST read the
relevant guide in node_modules/next/dist/docs/ and follow it. Heed every
deprecation notice.

# HOW TO WORK (in order)
1. Read all of FE_GUIDELINE.md. If the "Assumptions / To confirm" section has a
   point that blocks a requested screen → ask first, do not invent.
2. Generate the type layer first:
   - TypeScript types/interfaces for all models, enums, requests, responses —
     matching sections 4 & 5 of the guideline 1-to-1.
   - A centralized API client (base URL, attach auth header, handle refresh,
     parse errors per section 6). Every call goes through this client.
3. For each endpoint used: write a typed function (input → output matching the
   contract).
4. Build the UI for the priority features:
   - Forms: client validation MUST match constraints in section 4
     (min/max/regex/enum).
   - Enums → render using the exact values in section 5
     (dropdown/badge/filter).
   - Enforce business rules from section 7 (hide/disable disallowed actions).
   - Handle all 3 states: loading / error / empty. Map API errors to the UI per
     section 6.
   - Authorization per section 2: block routes/actions by role.
5. Do NOT call fields/endpoints that don't exist in the guideline. If something
   needed is missing, record it under a "Gaps" section at the end and propose
   it — do NOT fabricate an API.

# QUALITY
- Code matches the repo's existing conventions (naming, style, folder layout).
- End-to-end type-safe; no `any` for API data.
- After coding: run typecheck/lint/build and fix errors yourself.
- At the end, list: which screens were built, which endpoint each maps to in the
  guideline, and any "Gaps" the backend still needs to fill.
```

---

**Usage:** replace the `<...>` placeholders to fit your project. Run Prompt 1 in
the backend repo (or point it at that path); run Prompt 2 inside the FE repo.
