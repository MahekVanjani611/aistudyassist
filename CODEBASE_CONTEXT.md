# StudentsAI Codebase Context (Feature + Workflow Deep Dive)

## 1) What this codebase is

StudentsAI is a full-stack AI-assisted study platform with:
- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind + shadcn/Radix components.
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL + Alembic.
- **AI layer:** OpenAI-based summarization/flashcard generation and local NLP utilities (TF-IDF similarity/keywords).
- **Core domain:** notes, graph connections, flashcards, SRS review loop, profile analytics, settings, auth/security.

---

## 2) High-level architecture

## Runtime components
1. **Next.js UI** handles user interactions and route-level experiences (landing/auth/notes/flashcards/profile/settings/verification).
2. **API client (`frontend/src/lib/api.ts`)** wraps all backend calls, attaches JWT, and retries once on `401` by calling `/auth/refresh`.
3. **FastAPI app (`backend/app/main.py`)** exposes all domain endpoints (auth, notes, AI, flashcards, graph, profile, settings, uploads).
4. **Database models (`backend/app/database.py`)** persist users, notes, links, similarities, flashcards, SRS, events, aggregates, pending email changes.
5. **AI service (`backend/app/ai_service.py`)** provides summarization/flashcard generation + similarity + keyword extraction.

## Security/control layers
- JWT auth + bcrypt password hashing.
- Email verification required before password login succeeds.
- Per-endpoint/per-user/IP rate limiting.
- CORS origin handling with studentsai.org/vercel regex and explicit header middleware.

---

## 3) Implemented backend features (by domain)

## A) Authentication & account lifecycle
Implemented endpoints include:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/google/login`
- `GET /auth/google/callback`
- `POST /auth/google`
- `POST /auth/send-verification`
- `GET /auth/verify/{token}`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/request-account-deletion`
- `POST /auth/confirm-account-deletion`

Key behavior:
- Register creates user, hashes password, returns JWT, and triggers async verification email.
- Login blocks unverified users with `403`.
- Refresh re-issues JWT using current user context.
- Google OAuth exchanges auth code with Google and creates/gets OAuth user.
- Password reset token and account-deletion token flows are implemented.

## B) Email verification + email change (2-step)
Implemented endpoints:
- `POST /auth/send-email-change-verification`
- `GET /auth/verify-email-change-step1/{token}`
- `GET /auth/verify-email-change-step2/{token}`

Flow:
1. User requests change to new email.
2. System records `pending_email_changes` row with expiration.
3. Step 1 verifies ownership of current email.
4. Step 2 verifies new email.
5. User email is updated and a fresh JWT is issued.

## C) Notes and linking
Implemented endpoints:
- `GET /notes`, `POST /notes`, `GET /notes/{id}`, `PUT /notes/{id}`, `DELETE /notes/{id}`
- `PUT /notes/{id}/tags`
- `POST /notes/{id}/links`
- `DELETE /notes/{id}/links/{target_id}`
- `GET /notes/{id}/backlinks`

Key behavior:
- Notes are user-scoped.
- Updates parse `[[WikiLink]]` titles and refresh manual link rows.
- Explicit note linking/backlink retrieval is supported.
- Tagging is first-class via array field on notes.

## D) AI features for notes
Implemented endpoints:
- `POST /ai/summarize`
- `POST /ai/flashcards`
- `POST /notes/{id}/summarize`
- `POST /notes/{id}/extract-keywords`
- `GET /notes/{id}/keywords`

Key behavior:
- Summaries and flashcards use OpenAI chat completion calls.
- Keywords use TF-IDF extraction.
- AI operations are guarded by AI-specific rate limit.

## E) Flashcards + SRS + review intelligence
Implemented endpoints:
- `GET /notes/{id}/flashcards`
- `POST /notes/{id}/flashcards/generate`
- `GET /flashcards/user`
- `GET /flashcards/due`
- `POST /flashcards/{id}/review`
- `POST /notes/{id}/flashcards/contextual/generate`
- `POST /flashcards/generate` (enhanced single/context mode)
- `POST /flashcards/{id}/review/enhanced`
- `GET /flashcards/sets`
- `GET /flashcards/due/srs`
- `POST /flashcards/archive/mastered`
- `POST /flashcards/{id}/tags/{tag}` / `DELETE /flashcards/{id}/tags/{tag}`

Key behavior:
- Supports normal and contextual flashcard generation.
- Stores review_count, mastery_level, performance, tags.
- Uses `flashcard_srs` for schedule (`efactor`, interval, due_date, repetitions).
- Enhanced review computes quality rating and updates SRS/mastery/tags.

## F) Graph and note relationships
Implemented endpoint:
- `GET /graph`

Graph combines:
- AI/TF-IDF similarity edges,
- Manual link edges,
- Persisted similarity rows (`note_similarities`) for stable weighted rendering.

## G) Activity/profile analytics
Implemented endpoints:
- `GET /api/profile/summary`
- `GET /api/profile/activity`
- `GET /api/profile/recent`
- `POST /api/events`
- `POST /api/profile/aggregate`
- `POST /api/profile/export`

Key behavior:
- Tracks event stream (`events` table) and optional daily aggregates (`activity_daily`).
- Computes streaks and date-range activity, and supports data export of notes/flashcards.

## H) Settings + media upload
Implemented endpoints:
- `GET/PATCH /api/settings/profile`
- `GET/PATCH /api/settings/appearance`
- `GET/PATCH /api/settings/graph`
- `GET/PATCH /api/settings/ai`
- `GET/PATCH /api/settings/studyflow`
- `GET/PATCH /api/settings/advanced`
- `GET /api/settings/username/check/{username}`
- `POST /upload/image`

Notes:
- Profile updates (username/email/password) are fully implemented with validations.
- Non-profile settings currently return/echo schema defaults (placeholder persistence).
- Upload validates `image/*`, stores under backend uploads, returns absolute URL.

---

## 4) Core data model (implemented)

Primary SQLAlchemy entities:
- `User` (email, username, password/oauth, verified, plan)
- `PendingEmailChange`
- `Note` (title/content/summary/tags)
- `NoteLink` (manual/AI links)
- `NoteSimilarity` (normalized pair + integer score)
- `Flashcard` (difficulty, scheduling metadata, type, context, tags, mastery)
- `FlashcardSRS` (SM-2-lite state)
- `FlashcardSet` (generation batches)
- `FlashcardReview` (detailed review records)
- `Event` + `ActivityDaily` (analytics)

This schema supports user isolation, graph linking, spaced repetition, and behavioral analytics.

---

## 5) Implemented frontend features (by route/view)

## Public routes
- `/(public)/landing`: marketing page with feature sections and visual previews.
- `/(public)/auth`: login/signup UI (`AuthForm`), Google sign-in entry.

## Verification routes
- `/verify/[token]`: email verify + account delete confirm mode.
- `/verify-email-change-step1/[token]`
- `/verify-email-change-step2/[token]`
- `/verify-email-change/[token]` (legacy/alternate flow support).

## Authenticated app routes
- `/` (notes workspace):
  - Sidebar notes explorer with search/filter/sort/tags.
  - WYSIWYG note editing + autosave + manual save.
  - AI summary trigger per note.
  - Template insertion.
  - Keyboard shortcuts and focus mode.
  - Inline switch between Notes / Flashcards / Graph tabs.
- `/flashcards`: dashboard + study mode with AI feedback, mastery views, filtering.
- `/profile`: summary stats, heatmap (UTC), activity feed, flashcard quick metrics.
- `/settings`: profile + appearance + graph + AI + studyflow + advanced tabs.

Global UI behavior:
- Header adapts navigation by context (notes/profile/settings/flashcards).
- Theme toggle with startup script to reduce flash and default dark mode experience.

---

## 6) End-to-end workflows (how system actually flows)

## Workflow 1: Register and verify email
1. User signs up in `AuthForm`.
2. Frontend calls `api.register()` → `POST /auth/register`.
3. Backend creates user, returns JWT, starts async verification email task.
4. User clicks `/verify/{token}` link.
5. Frontend verify page calls backend verify endpoint.
6. Backend marks `user.verified = true`.
7. User can now login successfully via password flow.

## Workflow 2: Login and token refresh
1. Frontend calls `api.login()`.
2. JWT is stored in localStorage and attached to future requests.
3. On expired token (`401`), API client auto-calls `/auth/refresh` once.
4. If refresh fails, token/user are cleared and app redirects to landing/auth.

## Workflow 3: Note authoring + autosave + links
1. User creates/edits note in `EditableNoteView` and WYSIWYG editor.
2. Debounced autosave runs (~3s) for existing/new note.
3. Backend upserts note content.
4. On updates, backend parses `[[Title]]` patterns and rewrites manual links.
5. Sidebar list updates, including tags/metadata.

## Workflow 4: AI summary and keywording
1. User clicks summary or keyword extraction actions.
2. Frontend calls note AI endpoints.
3. Backend checks AI rate limit.
4. AI service returns summary/keywords.
5. Note is updated and returned to UI.

## Workflow 5: Flashcard generation and study loop
1. User generates flashcards (single or contextual).
2. Backend creates flashcards and initializes SRS entries (enhanced flow).
3. User studies card and submits answer.
4. Enhanced review endpoint scores answer (heuristic + optional LLM path), updates:
   - `review_count`,
   - `last_performance`,
   - `mastery_level`,
   - `flashcard_srs` schedule,
   - adaptive tags (e.g., `recently_learned`).
5. UI shows feedback, verdict, and next review context.

## Workflow 6: Graph exploration
1. Frontend graph component calls `/graph`.
2. Backend assembles nodes + edges from similarities + manual links + stored similarity.
3. D3 force graph renders with zoom/drag/highlight/local-focus controls.
4. Node click can drive note selection and local expansion behavior.

## Workflow 7: Profile analytics
1. User opens profile.
2. Frontend loads summary + recent events + activity range.
3. Backend computes totals/streaks and day counts (aggregate table if available).
4. Heatmap renders continuous day buckets (UTC-based).

## Workflow 8: Settings and account management
1. Settings page loads profile + setting groups.
2. Profile updates are persisted server-side with validation.
3. Appearance/graph/AI/studyflow/advanced endpoints currently act as defaults/echo placeholders.
4. Account deletion request emails confirmation link; confirm endpoint hard-deletes associated data graph.

---

## 7) Operational and implementation notes

- **Rate limiting:**
  - Base in-memory limiter active across endpoints.
  - Enhanced Redis-backed limiter exists and is initialized on startup, but core endpoints mostly call the base limiter helpers.
- **CORS hardening:** allows configured origins + studentsai/vercel regex + explicit response header enforcement middleware.
- **Uploads:** static mount at `/uploads` and explicit upload endpoint.
- **Eventing:** many mutating actions call `record_event` best-effort (failures don’t block user flow).
- **Settings persistence gap:** non-profile setting groups are scaffolded but not yet persisted to DB.

---

## 8) Practical mental model for contributors

Think of the system as four connected loops:
1. **Capture loop:** write/edit notes quickly (autosave + templates + tags).
2. **Intelligence loop:** summarize, extract keywords, generate flashcards.
3. **Retention loop:** review cards, get scoring/feedback, update SRS schedule.
4. **Insight loop:** see graph connections + profile activity trends.

Most user value comes from chaining these loops in one session: **note → AI compression → flashcards → review feedback → scheduled revisit**.
