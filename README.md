# Meeting Note

Meeting Note is a SvelteKit application for planning meetings, submitting meeting reports, managing user accounts, and generating meeting report PDFs.

The app has two related but distinct business objects:

- `form_submissions`: submitted reports and uploaded evidence
- `calendar_events`: planned or completed calendar entries tied to reports when applicable

The main developer goal in this codebase is to keep those two concepts separate while coordinating them cleanly through service and API layers.

## What The App Does

- Authenticated users can log in and land on the calendar.
- Users can plan meetings on the calendar before the meeting happens.
- Past planned meetings become action-required items until a report is submitted.
- Users can submit a meeting report from the report form.
- A report can either:
	- create a new linked calendar event for a spontaneous meeting, or
	- complete an existing planned calendar event through `eventId`
- Completed reports can generate PDFs.
- Owner/admin users can manage accounts.

## Main User Flows

### 1. Authentication Flow

- `/` redirects to `/login` for unauthenticated users.
- `/` redirects to `/calendar` for authenticated users.
- `/login` redirects to `/calendar` if the user already has a valid session.
- Session state is enforced server-side in the SvelteKit hook and mirrored client-side in `sessionStorage` for navigation display.

### 2. Planned Meeting Flow

1. User opens the calendar.
2. User clicks `Plan Meeting`.
3. Sidebar form submits to the calendar page action.
4. The page action proxies the request to `/api/calendar?action=createPlannedEvent`.
5. The API stores a row in `calendar_events` with no `form_submission_id` yet.

### 3. Completing A Planned Meeting

1. A past unlinked event is shown as `action-required`.
2. Clicking it redirects to `/form-laporan?eventId=...`.
3. The form fetches `/api/calendar?eventId=...`.
4. `judulMeeting` and `tanggalMeeting` are prefilled and locked.
5. Form submission sends `eventId` to `/api/form-submission`.
6. The backend stores the meeting report and links it to the existing calendar event.

### 4. Spontaneous Meeting Flow

1. User submits a meeting report without an existing planned event.
2. The backend stores the report in `form_submissions`.
3. The service creates a new linked row in `calendar_events`.

### 5. PDF Flow

- PDF generation is triggered after successful meeting report submission.
- Existing reports can also be backfilled or regenerated through the form-submission API.

## Tech Stack

- SvelteKit
- Svelte 5
- TypeScript
- Drizzle ORM
- libSQL / SQLite
- Vitest
- Quill for rich-text meeting notes
- `@event-calendar/core` for calendar UI
- Puppeteer for PDF generation

## Project Structure

The codebase is organized by responsibility instead of putting all logic in route files.

### Frontend routes

- [src/routes/login/+page.svelte](src/routes/login/+page.svelte): login UI
- [src/routes/calendar/+page.svelte](src/routes/calendar/+page.svelte): calendar UI with sidebar planning/edit/report views
- [src/routes/form-laporan/+page.svelte](src/routes/form-laporan/+page.svelte): meeting report form
- [src/routes/list-laporan/+page.svelte](src/routes/list-laporan/+page.svelte): report listing UI
- [src/routes/accounts/+page.svelte](src/routes/accounts/+page.svelte): account management UI

### Route loaders and actions

- [src/routes/+page.server.ts](src/routes/+page.server.ts): root redirect logic
- [src/routes/login/+page.server.ts](src/routes/login/+page.server.ts): login redirect logic for authenticated users
- [src/routes/calendar/+page.server.ts](src/routes/calendar/+page.server.ts): calendar load and action proxy layer

### API routes

- [src/routes/api/login/+server.ts](src/routes/api/login/+server.ts)
- [src/routes/api/logout/+server.ts](src/routes/api/logout/+server.ts)
- [src/routes/api/accounts/+server.ts](src/routes/api/accounts/+server.ts)
- [src/routes/api/accounts/owner/+server.ts](src/routes/api/accounts/owner/+server.ts)
- [src/routes/api/signup/+server.ts](src/routes/api/signup/+server.ts)
- [src/routes/api/form-submission/+server.ts](src/routes/api/form-submission/+server.ts)
- [src/routes/api/calendar/+server.ts](src/routes/api/calendar/+server.ts)

### Server-side services

- [src/lib/server/auth.ts](src/lib/server/auth.ts): authentication, password hashing, sessions, cookies
- [src/lib/server/form-submissions.ts](src/lib/server/form-submissions.ts): generic submission orchestration
- [src/lib/server/meeting-form-submissions.ts](src/lib/server/meeting-form-submissions.ts): meeting-specific report logic and calendar linking
- [src/lib/server/calendar-events.ts](src/lib/server/calendar-events.ts): calendar business logic

### Repositories and schema

- [src/lib/server/db.ts](src/lib/server/db.ts): libSQL/Drizzle connection
- [src/lib/server/repositories](src/lib/server/repositories): direct database access layer
- [src/lib/server/schema](src/lib/server/schema): Drizzle table definitions

### Supporting infrastructure

- [src/hooks.server.ts](src/hooks.server.ts): authentication gate for protected pages and APIs
- [scripts/migrate.ts](scripts/migrate.ts): applies Drizzle migrations
- [scripts/pdf-backfill.ts](scripts/pdf-backfill.ts): regenerates missing PDFs in bulk
- [server/index.ts](server/index.ts): standalone Node/Express entry for built output

## Data Model Overview

### `form_submissions`

Defined in [src/lib/server/schema/form-submissions.ts](src/lib/server/schema/form-submissions.ts).

Stores:

- submission metadata
- arbitrary field JSON
- uploaded file metadata JSON
- optional generated PDF link

This table is generic and supports multiple submission types, including `meeting`.

### `calendar_events`

Defined in [src/lib/server/schema/calendar-events.ts](src/lib/server/schema/calendar-events.ts).

Stores:

- event title
- start and end timestamps
- optional `form_submission_id`
- cancelled state
- timestamps

Important rule:

- a planned event starts with `form_submission_id = null`
- a completed event has `form_submission_id != null`

There is also a migration-enforced uniqueness rule so one form submission cannot be linked to multiple calendar events.

## Calendar State Model

Calendar UI state is derived from event data rather than stored separately.

Core states:

- `planned`: future event, not cancelled, no linked report
- `action-required`: past event, not cancelled, no linked report
- `completed`: linked report exists
- `cancelled`: `isCancelled = true`

The UI mapping lives in [src/lib/calendar/event-state.ts](src/lib/calendar/event-state.ts).

## Request Flow And Layering

This repo intentionally avoids putting business logic directly inside page components.

### Calendar page flow

1. UI in [src/routes/calendar/+page.svelte](src/routes/calendar/+page.svelte)
2. Page server load/action proxy in [src/routes/calendar/+page.server.ts](src/routes/calendar/+page.server.ts)
3. API in [src/routes/api/calendar/+server.ts](src/routes/api/calendar/+server.ts)
4. Service in [src/lib/server/calendar-events.ts](src/lib/server/calendar-events.ts)
5. Repository in [src/lib/server/repositories/calendar-events.ts](src/lib/server/repositories/calendar-events.ts)

That split matters because it keeps page code thin and makes API/service testing straightforward.

### Meeting form submission flow

1. UI in [src/routes/form-laporan/+page.svelte](src/routes/form-laporan/+page.svelte)
2. API in [src/routes/api/form-submission/+server.ts](src/routes/api/form-submission/+server.ts)
3. Meeting-specific service in [src/lib/server/meeting-form-submissions.ts](src/lib/server/meeting-form-submissions.ts)
4. Shared submission service and repositories below that

## Authentication Model

Authentication is session-based with an HTTP-only cookie, plus a small client-side mirror for UX.

- Session cookie name: `meeting_note_session`
- Password hashing: Node `scrypt`
- Session storage in DB: hashed token in `auth_sessions`
- Server auth lookup: [src/lib/server/auth.ts](src/lib/server/auth.ts)
- Route protection: [src/hooks.server.ts](src/hooks.server.ts)

Protected pages currently include:

- `/calendar`
- `/form-laporan`
- `/list-laporan`
- `/accounts`
- private API routes under `/api/*` except the explicitly public ones

### Owner bootstrap

The first owner account is created once through:

- `POST /api/accounts/owner`

After that, owner/admin account management is performed through the account APIs.

## API Summary

### Auth and accounts

- `POST /api/accounts/owner`: create the first owner account once
- `POST /api/login`: authenticate and create a session
- `POST /api/logout`: revoke the current session
- `GET /api/accounts`: list accounts
- `POST /api/signup`: create an account
- `PATCH /api/accounts/:accountId`: activate/deactivate account

### Calendar

- `GET /api/calendar`: list all calendar events
- `GET /api/calendar?eventId=123`: fetch one calendar event for form prefill
- `POST /api/calendar?action=createPlannedEvent`: create planned event
- `POST /api/calendar?action=createSpontaneousReport`: create spontaneous report + linked calendar event
- `POST /api/calendar?action=updatePlannedEvent`: edit planned event
- `POST /api/calendar?action=cancelEvent`: cancel planned event

### Meeting reports

- `GET /api/form-submission`: list meeting submissions
- `POST /api/form-submission`: create meeting submission
- `POST /api/form-submission?action=backfill-pdf`: start PDF backfill
- `POST /api/form-submission?action=regenerate-pdf&submissionId=...`: regenerate one PDF

## Local Storage And Generated Files

- SQLite DB default path: `data/meeting-note.db`
- Uploaded form files: `uploads/form-submissions/` and static-served assets under `static/uploads/form-submissions/`
- Generated PDFs: `static/generated-pdfs/meeting-reports/`

The database path can be overridden with `DATABASE_URL`.

## Environment Variables

### Required or commonly used

- `DATABASE_URL`: optional override for the SQLite/libSQL connection
- `NODE_ENV`: used for secure cookie behavior in production

### Optional debug flag

- `DEBUG_CALENDAR_API=1`: enables small, request-scoped debug logs in the calendar API

The calendar debug logging is intentionally conservative: it logs IDs, action names, durations, and booleans, but not full payloads.

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Apply database migrations

```sh
npm run db:migrate
```

### 3. Start the SvelteKit dev server

```sh
npm run dev
```

### 4. Open the app

Use the local URL shown by Vite, then bootstrap the owner account if the database is empty.

## Available Scripts

```sh
npm run dev
npm run build
npm run start
npm run server:start
npm run preview
npm run check
npm run check:watch
npm run test:unit
npm run db:generate
npm run db:migrate
npm run pdf:backfill
```

### Notes on server entrypoints

- `npm run dev` is the normal development workflow.
- [server/index.ts](server/index.ts) is a standalone Express wrapper around the built SvelteKit handler and is mainly relevant after build/deployment.
- `npm run server:start` runs that Express wrapper (expects the app to be built first).
- `npm run start` builds the app and then runs the Express wrapper in one command.

## Testing

Tests use Vitest.

Run everything:

```sh
npm run test:unit
```

Run targeted suites:

```sh
npm run test:unit -- tests/api/calendar.test.ts
npm run test:unit -- tests/routes/form-laporan.test.ts
```

The project has good targeted coverage around:

- auth hook behavior
- login API behavior
- calendar API and page server actions
- meeting form submission service behavior
- report form behavior

## Developer Notes

### Where to add new business logic

Prefer this order:

1. route UI for presentation only
2. page server file for page-specific loading/actions
3. API route for transport concerns
4. service for business logic
5. repository for database access

If a change affects persistence or workflow rules, it usually belongs in the service layer, not directly in the route.

### If you add a new table

1. add schema in `src/lib/server/schema/`
2. add repository methods in `src/lib/server/repositories/`
3. add or update a service layer
4. generate a migration with `npm run db:generate`
5. apply it with `npm run db:migrate`

### If you change the meeting completion flow

Be careful not to collapse planned and spontaneous meeting behavior into the same persistence path.

Current rule:

- planned meeting completion should link an existing `calendar_events` row
- spontaneous submission should create a new linked `calendar_events` row

## Quick Orientation For New Developers

If you only read a few files first, start here:

1. [src/hooks.server.ts](src/hooks.server.ts)
2. [src/routes/calendar/+page.svelte](src/routes/calendar/+page.svelte)
3. [src/routes/calendar/+page.server.ts](src/routes/calendar/+page.server.ts)
4. [src/routes/api/calendar/+server.ts](src/routes/api/calendar/+server.ts)
5. [src/routes/form-laporan/+page.svelte](src/routes/form-laporan/+page.svelte)
6. [src/routes/api/form-submission/+server.ts](src/routes/api/form-submission/+server.ts)
7. [src/lib/server/meeting-form-submissions.ts](src/lib/server/meeting-form-submissions.ts)
8. [src/lib/server/auth.ts](src/lib/server/auth.ts)

That set gives the clearest picture of how the app works end to end.
