# Discussion sessions and Google Calendar — StarsTask

## 1. Scope

StarsTask lets a class schedule **discussion sessions** — tutorials, review
meetings, and Q&A posted by the class admin (ketua kelas) — and lets members RSVP
to them. Two calendar paths sit on top:

| Stage | What it does                                             | Needs an OAuth grant?  |
| ----- | -------------------------------------------------------- | ---------------------- |
| **A** | "Add to Google Calendar" link that pre-fills the event   | No                     |
| **B** | Optional connected calendar that StarsTask keeps in sync | Yes, `calendar.events` |

Stage A works on every deployment, including one with no Google credentials at
all. Stage B is additive: if it is not configured, every other feature still
works and the UI explains why.

**Status:** code, migrations, RLS, tests, and this document are complete.
`pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass locally
(647 unit tests). No Supabase project or Google OAuth client was available while
building this, so nothing has been exercised against a live database or the real
Google Calendar API. §16 lists exactly what that means.

| Piece                | Location                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Schema               | `supabase/migrations/20261029001600_discussion_sessions.sql`                                        |
| Functions            | `supabase/migrations/20261029001700_session_functions.sql`                                          |
| RLS and grants       | `supabase/migrations/20261029001800_session_rls.sql`, `…2000_session_grants.sql`                    |
| Calendar tables      | `supabase/migrations/20261029001900_google_calendar.sql`                                            |
| Contracts            | `packages/contracts/src/sessions.ts`                                                                |
| Pure helpers         | `packages/shared/src/session.ts`, `packages/shared/src/google-calendar.ts`                          |
| Data access          | `apps/web/src/lib/db/sessions.ts`                                                                   |
| Feature services     | `apps/web/src/features/sessions/*`, `apps/web/src/features/integrations/google-calendar-service.ts` |
| Google provider code | `apps/web/src/lib/integrations/google/*`                                                            |
| HTTP API             | `apps/web/src/app/api/sessions/**`, `apps/web/src/app/api/integrations/google-calendar/**`          |
| Reminders            | `apps/web/src/lib/push/session-*.ts`, `apps/web/src/app/api/cron/session-jobs/route.ts`             |
| UI                   | `apps/web/src/app/(workspace)/sessions/**`, `apps/web/src/components/sessions/**`                   |

---

## 2. Data model

### `discussion_sessions`

One row per session. Times are absolute (`timestamptz`, stored in UTC); the
IANA zone is kept alongside them so the wall clock the organiser intended
survives every later edit.

| Column                                  | Notes                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| `id`                                    | uuid primary key                                                   |
| `class_id`                              | FK → `classes`, `on delete cascade`                                |
| `assignment_id`                         | FK → `assignments`, `on delete set null` (optional link)           |
| `organizer_id`                          | FK → `auth.users`, `on delete cascade`                             |
| `title`, `description`                  | 3–160 and 10–5,000 characters                                      |
| `agenda`                                | optional, ≤5,000 characters; hidden from anonymous readers         |
| `session_type`                          | `online` \| `in_person`                                            |
| `meeting_url`                           | required for `online`; must start with `https://`                  |
| `location`                              | required for `in_person`; ≤200 characters                          |
| `starts_at`, `ends_at`                  | `ends_at > starts_at` and `≤ starts_at + 24 hours`                 |
| `time_zone`                             | IANA name validated by the app; drives every rendering             |
| `capacity`                              | `null` (unlimited) or 1–1,000                                      |
| `registration_deadline`                 | optional, `≤ starts_at`                                            |
| `visibility`                            | `class_members` \| `public`                                        |
| `status`                                | `scheduled` \| `cancelled` \| `completed`                          |
| `cancelled_at`                          | set by a status change, `null` otherwise (checked by a constraint) |
| `checkin_latitude`, `checkin_longitude` | optional room point for location check-in                          |
| `checkin_radius_m`                      | 25–1,000 metres, default 150                                       |

Indexes cover the four real queries: upcoming per class, the global upcoming
list, public sessions, and "sessions I organise".

### `discussion_session_checkins`

One row per `(session_id, user_id)`. `status` is `present`, `late`, `excused`,
or `absent`; `method` is `geo` for a self check-in and `manual` for an organizer
recording a row without a location. A geo row stores the reported coordinates,
`accuracy_m`, and `distance_m` for dispute review. A manual row leaves those
columns null — the database constraint refuses a geo row without a reading, so
the record never pretends to be something it is not.

Coordinates are **not** in the column grant: clients can read distance and
accuracy, never the raw position. The session detail page asks
`session_checkin_summary(p_session_id)` for the derived settings (whether a
point exists and the radius), so even the check-in configuration reaches the
browser without the coordinates.

### `discussion_session_rsvps`

One row per `(session_id, user_id)` — a unique constraint, so a double-submit
updates instead of duplicating. `status` is `going`, `maybe`, or `not_going`.
There is no `not_going` row requirement: cancelling an RSVP deletes the row, and
`not_going` exists for a user who wants to record a decision they may revisit.

### `discussion_session_reminders`

The durable reminder ledger, one row per `(user_id, session_id, reminder_type,
starts_at)`. Including `starts_at` in the key means a rescheduled session
produces a **new** logical reminder rather than reusing a settled one. Columns
mirror `notification_deliveries`: `status` (`pending`/`processing`/`sent`/
`failed`/`skipped`), `attempt_count`, `next_attempt_at`, `last_error_category`.

### `google_calendar_connections`

One row per user (`user_id` is the primary key). Stores the calendar id, the
granted scope, **ciphertext only** for the access and refresh tokens, the expiry,
and a `status` of `connected` / `revoked` / `error`.

### `google_calendar_event_mappings`

One row per `(user_id, session_id)`. Records which Google calendar and event
StarsTask created, plus `status` (`pending`, `synced`, `out_of_sync`, `failed`,
`deleted`) and retry bookkeeping. A partial unique index on
`(user_id, calendar_id, google_event_id)` prevents two mappings claiming the same
event.

---

## 3. Permissions

No new global role was introduced. The existing `class_admins` table already
represents "the people who run this class" — the student class admin, or ketua
kelas. There is no lecturer account, so session management reuses that role.

| Actor                     | Read                                           | Create / edit / change status | RSVP     |
| ------------------------- | ---------------------------------------------- | ----------------------------- | -------- |
| Platform admin            | Every session                                  | Any class                     | Own only |
| Class admin (ketua kelas) | Their class's sessions                         | Their class                   | Own only |
| Class member (student)    | Their class's sessions, plus public ones       | **No**                        | Own only |
| Anyone else / anonymous   | `public` sessions, without agenda or join link | No                            | No       |

`can_organize_class_sessions(class_id)` is the single predicate:

```sql
is_platform_admin ()
or is_class_admin (class_id)
```

It is a `SECURITY DEFINER` function so RLS policies can call it without
recursing, and it is re-checked inside every write function. The API routes also
call `getClassRole()` first, purely to return a friendly `403` before the
database has to raise one.

**Privilege escalation is not reachable from the client.** There is no INSERT,
UPDATE, or DELETE grant on any session table for `anon` or `authenticated`; every
write goes through a function that reads `auth.uid()` and re-checks the
predicate. A client cannot pass another user's id, a different organiser, or a
role. The one function that takes another user's id is
`record_discussion_session_checkin`, and it only accepts a member of the class
the caller administers — so it can record attendance, never a role or an RSVP.

---

## 4. RSVP behaviour

### States and transitions

```
(none) --going--> going --maybe--> maybe --not_going--> not_going
   ^                 |                |                   |
   +----- cancel ----+----------------+-------------------+
```

- A user has at most one row per session; changing their mind updates it.
- `DELETE /api/sessions/[id]/rsvp` removes the row entirely.
- Every response returns fresh counts, so the UI never shows an optimistic lie.

### When RSVP is open

All of the following must hold, checked again inside `rsvp_discussion_session`:

1. the session is `scheduled` (not cancelled or completed),
2. `now() < starts_at`,
3. `registration_deadline` is null or in the future,
4. for `going` only: `capacity` is null or `going_count < capacity`.

`maybe` and `not_going` are accepted even when the session is full — a full room
should not stop someone from signalling interest.

### Concurrency

`rsvp_discussion_session` takes `SELECT … FOR UPDATE` on the session row before
counting, so two simultaneous "going" requests cannot both pass the capacity
check. The `(session_id, user_id)` unique constraint plus `ON CONFLICT DO
UPDATE` makes a double-submit idempotent. The result is a correct count under
concurrency without an advisory lock or a serialisable transaction.

### Errors

| Condition                         | SQLSTATE | HTTP | `code`                |
| --------------------------------- | -------- | ---- | --------------------- |
| Not allowed to see the session    | `42501`  | 403  | `forbidden`           |
| Session missing                   | `P0002`  | 404  | `not_found`           |
| Capacity reached                  | `SS001`  | 409  | `session_full`        |
| Registration window closed        | `SS002`  | 409  | `registration_closed` |
| Session no longer `scheduled`     | `SS003`  | 409  | `not_scheduled`       |
| Duplicate row (other constraints) | `23505`  | 409  | `conflict`            |

### Privacy

Attendance **counts** are visible to anyone who can see the session. Participant
**identities** are not: the RLS policy on `discussion_session_rsvps` returns
another user's row only to a class manager, so the participant list is rendered
only for managers. A cancelled session keeps its counts but closes RSVP.

### Cancelled and rescheduled sessions

- Cancelling notifies every `going`/`maybe` participant once (deduped on the
  session and start time), skips pending reminders, and marks calendar mappings
  `out_of_sync` so the next sync removes the event.
- Editing the **time** does the same for reminders and mappings, then notifies
  participants that the details changed.
- Reopening a cancelled session reschedules the sync and notifies participants.
- RSVP rows are preserved across all three transitions, so a reopened session
  keeps its audience.

---

## 5. Attendance check-in

Only `in_person` sessions take attendance. The class admin (ketua kelas) either
saves a room point from their own browser (`checkin_latitude`, `checkin_longitude`,
`checkin_radius_m`) or records rows manually. The session form can capture the
point and radius while creating an in-person session; the session page keeps the
same controls for a later change. Capturing the point is optional, and the form
does not block the session if the reading is unavailable.

`NEXT_PUBLIC_FEATURE_SESSION_CHECKIN=false` hides the check-in cards and answers
`404` on the check-in routes. Existing attendance rows stay readable, and
sessions, RSVPs, and reminders are unaffected.

### What the server decides

`check_in_discussion_session` re-checks everything; the UI is never the
authority:

1. the caller is signed in and belongs to the session's class (or may organize
   it),
2. the session is `in_person`, `scheduled`, and has a saved point,
3. `now()` is between `starts_at - 15 minutes` and `ends_at`,
4. the reported accuracy is at most 100 m,
5. the reading's `capturedAt` timestamp is at most 60 seconds old and not in
   the future (see Freshness below),
6. the haversine distance is within `checkin_radius_m` (25-1,000 m).

Every check-in inside the open window records `present` — there is no
late threshold anymore. `late` survives only as a manual status an
organizer can set via correction/sheet. A retry while the meeting is open
updates the existing row (fresh distance, accuracy, and check-in time), so a
student with a bad first fix can simply check in again; an
organizer-reviewed manual row still wins over a student retry.

### Attendance Sheet

One course renders as one spreadsheet (`AttendanceSheet` on the course
attendance page, manager only). Rows are students, columns are meetings, and
cells are text codes — ✓ present, I excused, S sick, A absent, T late — with
subtle fills. Codes map to the standardized stored values
(`present|excused|sick|absent|late`); `SHEET_LABELS` localizes display per
campus (`id` Hadir/Izin/Sakit/Alfa/Terlambat, `en` Present/Excused/Sick/
Absent/Late). Cell edits go through the audited correction endpoint (reason
auto-filled, present still requires the physical-verification attestation),
and a per-column "All ✓" marks a whole meeting present. Totals use the sheet
formula H / total meetings × 100. Students keep their own view; the sheet is
manager-only. On mobile the table scrolls horizontally with sticky
No/NIM/Name columns.

### Shareable check-in link

The meeting dashboard has **Copy check-in link**: the class admin shares
`/attendance/checkin/[sessionId]` to the group. The link is not a public
bypass — it lives in the workspace, so the student must sign in, and GPS,
identity, radius, and window are still enforced on the server. The page only
narrows the existing student meeting view to that one meeting; a student who
is not eligible (closed meeting, not enrolled) gets a friendly notice.

### Freshness

A browser may cache a fix, so the client sends the reading's own timestamp
as `capturedAt`. The contract (`CHECKIN_POSITION_MAX_AGE_MS`, 60 seconds)
rejects a stale or future stamp before the request, and the database wrapper
overloads in `20261106000000_geofencing_freshness.sql` re-check it with
`now()`: discussion check-in raises `SS106` (`checkin_stale_position`),
meeting check-in returns `checkin_stale_position`. A null stamp keeps old
clients valid. The organizer's room-point picker is unaffected.

A missing row becomes `present`, or `late` once more than ten minutes have passed
since the start. A repeated request returns the existing row instead of failing,
so a retry after a dropped response is safe. The exception is an unreviewed
manual row: a real reading upgrades it, so an organizer's placeholder cannot
block somebody who is actually in the room.

### Manual rows

`record_discussion_session_checkin` lets an organizer write a row for a class
member when location is unavailable, or mark somebody `absent`. The row is
stored with `method = 'manual'` and no coordinates, so it is never confused with
a geo check-in. The function refuses a target who is not a member of the class.
The `POST /api/sessions/[id]/checkins` route additionally refuses `absent` before
`ends_at`, so an absence is only recorded after the session finished. That guard
lives in the API, not yet in the database function; a direct RPC call can still
write an early absence until the rule is moved into SQL with a reviewed
migration.

Organizers can override any row to `present`, `late`, `excused`, or `absent`
through `review_discussion_session_checkin`. The override keeps the original geo
data and is written to the audit log.

### Student view and the percentage policy

`/attendance` is check-in first for students. It leads with today's present,
late, and not-yet-checked-in counts and the sessions whose check-in window is
open. Upcoming meetings are listed too, with a disabled **Check in** that
explains the class admin has not opened attendance yet. A student presses
**Check in**; the browser supplies a reading and the server decides whether it
counts. Class admins also get a **Class admin tools** shortcut to each class
they manage. The **History** tab keeps the read-only record, filters,
breakdowns, and per-session details. A failed check-in is shown as an error
(including the outside-area message) and is never silently turned into a
present row.

The page and the class-admin summary use one policy everywhere (dashboard,
student page, class-admin summary):

- **Attended** = `present` + `late`. A late arrival still attended.
- **Eligible** = attended + `absent` + `unrecorded`. The percentage is
  `round(attended / eligible × 1000) / 10`, or `—` when nothing is eligible.
- `excused` is excluded from both sides. It is not present and it does not count
  as a miss.
- A finished session with no check-in is `unrecorded`; it is never treated as
  present. A session that has not finished is `pending` and is excluded.
- Cancelled sessions, and sessions that started before the student joined the
  class, are not part of that student's history.
- Missing records are never silently filled in by a read.

Each class workspace also has an **Attendance** tab with the same **Check-in**
and **History** split as `/attendance`. Check-in lists that class's open and
upcoming meetings; an upcoming meeting shows a disabled **Check in** until a
manager opens attendance. Managers can open a scheduled meeting directly from
the meeting list, or open its dashboard for the roster and close/finalize
controls. History holds the class-scoped subject breakdown plus either the
per-member table and session list (managers) or the student's own session
history (members). Managers see every member's attendance; everyone else sees
only their own. The older `/dashboard/classes/[slug]/attendance` URL redirects
to the tab.

An approved absence request integrates here: `review_leave_request` marks the
covered sessions `excused`, leaves existing `present` / `late` rows untouched,
and creates `excused` rows for sessions that had none. See
`docs/LEAVE_REQUESTS.md`.

### Honest limits

Coordinates come from the browser, so they can be spoofed (devtools, a fake GPS
app, an emulator). A check-in is evidence that the student was near the room,
not proof. Keep the radius generous enough for indoor GPS error, and treat a
suspicious row as a conversation rather than an automatic sanction.

Raw latitude and longitude are not in the column grant. Clients see distance and
accuracy only; the coordinates exist for dispute review.

### Timing limits

The check-in window is derived from the session schedule: it opens 15 minutes
before `starts_at`, closes at `ends_at`, and the present/late boundary is fixed at
ten minutes after `starts_at`. The database stores those two instants and the
fixed offset, not separate opening, closing, or on-time-deadline columns.
Attendance meetings, described below, are the exception: they store an explicit
window and late offset in `20261101090000_attendance_meetings.sql`. Configuring
those values on an ordinary discussion session would still need a separate
migration. The page groups "today" and the sessions' own date/time labels use
`Asia/Jakarta`, while each session keeps its own `time_zone` for display.

### Retention

Check-in rows follow the session (`on delete cascade`). The coordinates are
personal data, so they are purged after the review window the institution's
policy allows. `purge_discussion_checkin_coordinates(days)` clears `latitude`
and `longitude` for rows whose session ended before the window, sets
`coordinates_purged_at`, and keeps `status`, `method`, `distance_m`,
`accuracy_m`, and the reviewer fields. A geo row stays valid without its reading
because the purge marker is the documented exception to the geo-fields check.

The scheduler hits `/api/cron/attendance-retention`; each call purges at most
5,000 rows, so a backlog drains across runs without one large update lock. The
window comes from `ATTENDANCE_RETENTION_DAYS` (default 30, allowed 1–3650). The
function is `service_role` only, and no client column grant includes
`coordinates_purged_at`.

### Attendance meetings

`20261101090000_attendance_meetings.sql` adds session-based attendance for
`Pertemuan 1, 2…`. **The migration is written but not applied to the live
project**; the meeting UI and API return an error until the owner applies it.
An attendance meeting is a `discussion_sessions` row with `subject_id` and
`meeting_number`; ordinary sessions keep the behaviour above.

- **Lifecycle.** A class admin creates a meeting for one subject, then opens and
  closes attendance. The phase is `scheduled`, `open`, `closed`, or `finalized`.
  Closing with `finalize: true` writes a `system` absence for every eligible
  member without a record; reopening deletes only those system rows. A location
  is locked once attendance opens and can only change through the audited
  location route. Every create/open/close/reopen/location/export action is
  written to `audit_logs`.
- **Statuses.** `present`, `late` (after `late_after_minutes`, configurable per
  meeting; `0` disables late), `excused` (approved absence), `absent` (written at
  finalization or manually), `not_recorded` (opened but not finalized, and no
  row), and not applicable (a member who joined after the meeting, or a meeting
  that was never opened). A meeting never becomes absent while it is open.
- **Check-in.** The student enters their full name and NIM. The server compares
  those against the verified profile and the roster, requires class membership,
  checks the window and the accuracy ceiling, and computes the haversine
  distance against the stored radius. A failure is reported with one of the
  documented codes (`checkin_name_mismatch`, `checkin_nim_mismatch`,
  `checkin_identity_missing`, `checkin_too_far`, `checkin_imprecise`,
  `checkin_not_open`, `checkin_closed`, `checkin_unavailable`), and the student
  can retry. The unique `(session_id, user_id)` row prevents duplicates; a repeat
  call returns the existing row with `alreadyCheckedIn`.
- **Roster.** The master roster is every active class member, sorted
  case-insensitively by full name (Indonesian collation) and then NIM, including
  students who never attended. It is never derived from check-in rows alone.
- **Admin view.** The class Attendance tab lists meetings with live counts and
  links to a per-meeting dashboard. The dashboard polls every 20 seconds while
  open and shows the roster, distance, accuracy, status, and failed verification
  attempts (without the typed name or NIM). Corrections after finalization go
  through the existing audited manual-check-in route.
- **Exports.** Real `.xlsx` files: `…_Pertemuan_01.xlsx` (one meeting, all
  students), `…_Attendance_Recap_2026.xlsx` (semester matrix with `P/L/I/A/NR`
  and percentages), and `…_Attendance_Checklist.xlsx` (blank, `P/L/I/A`
  dropdowns, plus a read-only **Existing records** sheet).
- **Limits.** GPS comes from the browser and can be spoofed; the radius is
  evidence, not proof. Only normalized distance, accuracy, and timestamps are
  exposed. Exact coordinates stay server-side and follow the same retention
  purge as other check-ins.

---

## 6. Google Calendar — Stage A (link)

`buildGoogleCalendarUrl()` in `packages/shared/src/google-calendar.ts` produces a
`https://calendar.google.com/calendar/render` URL with:

| Parameter  | Value                                                      |
| ---------- | ---------------------------------------------------------- |
| `action`   | `TEMPLATE`                                                 |
| `text`     | session title                                              |
| `dates`    | `YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ`, both absolute in UTC  |
| `details`  | description, optional agenda, join link or location, title |
| `ctz`      | the session's IANA zone                                    |
| `location` | meeting URL, else the physical location, else omitted      |

Everything goes through `URLSearchParams`, so `&`, `?`, `#`, and non-ASCII
characters are encoded correctly.

Deliberate behaviour:

- **No OAuth.** The URL is opened by the browser; Google creates the event. No
  access token, no client secret, no API call.
- **No private data.** The description never contains participant names, RSVP
  counts, or organiser identity. A calendar event can be shared or exported, so
  it must not become a second copy of the participant list.
- **Cancelled and completed sessions render no link at all**, so a dead meeting
  cannot be recreated from a stale page.
- **Absolute instants plus `ctz`**: the event lands at the right moment even if
  the reader's device is in another zone, while the calendar shows it in the
  session's zone.

---

## 7. Google Calendar — Stage B (optional connection)

`NEXT_PUBLIC_FEATURE_CALENDAR_SYNC=false` turns this stage off: the settings page
explains that sync is unavailable, the connect/callback/disconnect routes answer
`404`, and the cron skips calendar work. Stage A links and all session features
keep working.

### Flow

```
User clicks "Connect Google Calendar"
  └─ GET /api/integrations/google-calendar/start
       ├─ requires a signed-in user (else redirect to /login?next=…)
       ├─ creates a random state, stores "<userId>:<state>" in an
       │  httpOnly, SameSite=Lax cookie scoped to the calendar routes
       └─ 303 → accounts.google.com/o/oauth2/v2/auth
                 scope=https://www.googleapis.com/auth/calendar.events
                 access_type=offline&include_granted_scopes=true&prompt=consent

Google redirects back
  └─ GET /api/integrations/google-calendar/callback
       ├─ re-reads the cookie, compares it with ?state= and auth.uid()
       ├─ exchanges the code (server-to-server, 10s timeout)
       ├─ encrypts the tokens (AES-256-GCM) and upserts the connection row
       ├─ clears the state cookie
       └─ 303 → /settings/calendar?connected=1 (or ?error=<code>)
```

### Scopes

Only `https://www.googleapis.com/auth/calendar.events` is requested. That is
enough to create, update, and delete events StarsTask itself created, and not
enough to read the rest of the calendar. `calendar` (full read/write) is
deliberately **not** requested. `access_type=offline` is requested because the
sync runs later, without the user present.

### Token storage

| Concern    | How                                                                               |
| ---------- | --------------------------------------------------------------------------------- |
| Encryption | AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`, key from `GOOGLE_TOKEN_ENCRYPTION_KEY` |
| Binding    | The AAD is a fixed purpose string, so a ciphertext cannot be replayed elsewhere   |
| Transport  | Tokens never leave the server; no API response includes them                      |
| Database   | `authenticated` has no `SELECT` grant on the token columns                        |
| Logs       | Only the error category is logged, never the token or the response body           |
| Git        | Credentials live in env vars only; `.env.example` holds placeholders              |

### Connection state

`status` is `connected`, `revoked`, or `error`. A refresh that returns
`invalid_grant` marks the row `revoked` and the UI asks the user to reconnect
instead of retrying forever. Disconnecting revokes the grant at Google
(best-effort), deletes the mappings, and deletes the connection — and it never
touches the Supabase session, so the user stays signed in.

### Why not reuse the Supabase Google client

The Supabase project's Google provider is configured for sign-in. Adding
`calendar.events` to it would change the consent screen for **every** login and
would couple an optional feature to the authentication flow. Instead the
integration uses its own OAuth client with its own client id, secret, and
redirect URI. `docs/DEPLOYMENT.md` §3.1 lists the Google Cloud console steps.

---

## 8. Calendar synchronisation

StarsTask is the source of truth. There is no bidirectional sync and no webhook:
an event edited in Google is overwritten on the next sync, and a deleted event is
recreated.

### Idempotency

1. `(user_id, session_id)` is unique, so there is exactly one mapping per pair.
2. The created event carries a private extended property
   `starstaskSessionId=<uuid>`.
3. Before creating, the service searches for an event with that property. If a
   previous attempt created an event but failed to record it, the retry adopts
   the existing event instead of duplicating it.
4. Updates use `PATCH` on the stored event id; a `404` triggers the search-and-adopt
   path rather than a blind create.

### What happens when a session changes

| Session event              | Sync effect                                                   |
| -------------------------- | ------------------------------------------------------------- |
| Created                    | Mapping starts `pending`                                      |
| Time/title/location change | Mapping becomes `out_of_sync`, event is patched               |
| Cancelled / completed      | Mapping becomes `out_of_sync`; the sync **deletes** the event |
| Reopened                   | Mapping becomes `out_of_sync`; the event is recreated         |

### Failure handling

| Category            | Meaning                             | Response                                         |
| ------------------- | ----------------------------------- | ------------------------------------------------ |
| `not_connected`     | No connection row                   | `409 calendar_not_connected`                     |
| `revoked`           | Google returned `invalid_grant`     | `409 calendar_reconnect_required`                |
| `transient`         | 5xx, timeout, rate limit            | `502 calendar_unavailable`, retried with backoff |
| `invalid_request`   | Google rejected the body            | `502 calendar_error`, recorded as `failed`       |
| `session_not_found` | Mapping points at a deleted session | `404`, mapping marked `deleted`                  |

Retries are capped (5 attempts) with exponential backoff, and the failure is
visible in the UI rather than silent. **Unrelated events are never touched**:
every write targets an id StarsTask stored or an event carrying its own private
property.

---

## 9. Reminders

Two windows, both per-user and both on by default: **24 hours** and **3 hours**
before `starts_at`. They are separate columns on `notification_preferences`
(`session_reminder_24h`, `session_reminder_3h`) and are toggled in
`/settings/notifications`.

```
GET /api/cron/session-jobs              (Authorization: Bearer CRON_SECRET, every 10 min)
  ├─ list candidate sessions            scheduled, starts_at in (now, now + 25h]
  ├─ list_session_reminder_audience()   RSVP = going, push enabled, window enabled
  ├─ enqueue discussion_session_reminders
  │     unique (user, session, type, starts_at), ignore duplicates
  ├─ claim_session_reminders()          FOR UPDATE SKIP LOCKED, re-joins the session
  ├─ re-validate each claim             cancelled / moved / opted out / no device
  ├─ web-push to every active device
  └─ complete_session_reminder()        sent | pending (retry) | failed | skipped
```

Rules the scheduler enforces:

- **Only `going`** participants are reminded. `maybe` is not a commitment.
- **Cancelled and completed sessions never remind.** Cancelling marks pending
  rows `skipped` immediately, and the claim query filters on `status =
'scheduled'` as a second guard.
- **No duplicates.** The unique key plus `ignoreDuplicates` makes a repeated
  cron run a no-op; the claim is transactional, so two overlapping runs cannot
  both send.
- **Reschedules** create a new logical reminder (the key includes `starts_at`)
  and skip the old one.
- **Time zone.** The instant is absolute; the body is rendered in the reader's
  saved zone, falling back to the session zone.
- **Delivery is durable.** The ledger lives in Postgres, so a closed browser or
  an offline device does not lose the reminder — the service worker shows it when
  the device next connects.

The same cron route also drains due calendar syncs (20 per run), so one schedule
covers both queues.

---

## 10. HTTP API

All responses use the standard envelope (`{ data }` or `{ error: { code,
message } }`). Every write validates its body with a Zod schema, resolves the
caller from the Supabase session, and rate-limits per user.

| Method   | Path                                           | Who                    | Limit      |
| -------- | ---------------------------------------------- | ---------------------- | ---------- |
| `GET`    | `/api/sessions`                                | Anyone                 | 240 / min  |
| `POST`   | `/api/sessions`                                | Class manager          | 30 / hour  |
| `GET`    | `/api/sessions/[id]`                           | Anyone who may view    | 240 / min  |
| `PATCH`  | `/api/sessions/[id]`                           | Class manager          | 60 / hour  |
| `POST`   | `/api/sessions/[id]/status`                    | Class manager          | 60 / hour  |
| `PUT`    | `/api/sessions/[id]/rsvp`                      | Signed-in viewer       | 120 / hour |
| `DELETE` | `/api/sessions/[id]/rsvp`                      | Signed-in viewer       | 120 / hour |
| `POST`   | `/api/sessions/[id]/checkin`                   | Signed-in class member | 60 / hour  |
| `PUT`    | `/api/sessions/[id]/checkin-location`          | Class manager          | 60 / hour  |
| `DELETE` | `/api/sessions/[id]/checkin-location`          | Class manager          | 60 / hour  |
| `POST`   | `/api/sessions/[id]/checkins`                  | Class manager          | 120 / hour |
| `PATCH`  | `/api/sessions/[id]/checkins/[checkinId]`      | Class manager          | 120 / hour |
| `POST`   | `/api/sessions/[id]/calendar-sync`             | Signed-in viewer       | 60 / hour  |
| `GET`    | `/api/integrations/google-calendar/start`      | Signed-in user         | 20 / hour  |
| `GET`    | `/api/integrations/google-calendar/callback`   | Signed-in user         | —          |
| `POST`   | `/api/integrations/google-calendar/disconnect` | Signed-in user         | 20 / hour  |
| `GET`    | `/api/cron/session-jobs`                       | `CRON_SECRET`          | —          |
| `GET`    | `/api/cron/attendance-retention`               | `CRON_SECRET`          | —          |

`POST /api/sessions/[id]/status` accepts `{"status": "scheduled" | "cancelled" |
"completed"}`. `PUT …/rsvp` accepts `{"status": "going" | "maybe" | "not_going"}`.
Neither accepts a user id: the caller is always `auth.uid()`.

`POST /api/sessions/[id]/checkin` accepts `{ latitude, longitude, accuracy }` and
always records the caller. `POST …/checkins` accepts `{ userId, status }` and is
the one write that names another user; the database rejects a target outside the
class.

`GET /api/sessions` query parameters: `class` (uuid), `type`, `status`
(`upcoming` default, `all`, `scheduled`, `cancelled`, `completed`), `from`, `to`,
`page`, `pageSize`.

---

## 11. UI

| Route                                    | Purpose                                       |
| ---------------------------------------- | --------------------------------------------- |
| `/sessions`                              | Upcoming list, filters, list/calendar toggle  |
| `/sessions/[id]`                         | Detail: agenda, join link, RSVP, participants |
| `/sessions/[id]/edit`                    | Edit form (managers, scheduled sessions only) |
| `/sessions/new`                          | Class picker, then the create form            |
| `/dashboard/classes/[slug]/sessions`     | The same list scoped to one class             |
| `/dashboard/classes/[slug]/sessions/new` | Create form pre-scoped to that class          |
| `/settings/calendar`                     | Connect / disconnect Google Calendar          |

Behaviour worth knowing:

- **The main navigation now opens `/schedule`** (the shared academic calendar),
  where discussion sessions appear as class-schedule events. Every `/sessions`
  route and API stays available, including RSVP, check-in, and Google sync.
- **The list filter is a plain GET form**, so it works without JavaScript and is
  linkable.
- **The calendar is server-rendered** and navigates by link (`?view=calendar&month=YYYY-MM`),
  so no session data is shipped to the browser just to lay out a grid. It shows
  every session in the month, cancelled ones included, which is why the status
  filter is hidden in that view.
- **RSVP buttons** post to the API and re-render from the server's counts; a full
  or closed session produces a real message instead of an optimistic state.
- **Cancelled sessions** keep their card and detail page, lose the calendar
  action, and explain that they were called off.
- **Empty, loading, and error states** exist for the list (`loading.tsx`,
  contextual empty copy), for RSVP (inline alerts), and for the calendar
  ("Nothing scheduled this month").
- **Accessibility**: the filter is a labelled `role="search"` form, RSVP uses
  `aria-pressed` buttons in a labelled group, month navigation has
  `aria-label`s, and every interactive element keeps a visible focus ring.

---

## 12. Environment variables

```bash
# Required for Stage A (and everything else).
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Required for reminders.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=

# Optional: Stage B. All four or none.
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/integrations/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

`node --env-file=apps/web/.env.local scripts/check-env.mjs` validates all of
this, including that the encryption key decodes to exactly 32 bytes and that the
four calendar values are set together or not at all.

Generate the key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` makes existing ciphertexts unreadable.
The integration treats that as `revoked`, so users reconnect once — nothing else
breaks.

---

## 13. Local development

```bash
pnpm install
cp .env.example apps/web/.env.local     # then fill in the Supabase values
supabase start                          # local Postgres + Auth
pnpm db:reset                           # apply every migration
pnpm dev                                # http://localhost:3000
```

The migrations apply in filename order. For this feature:

| Migration                   | Contents                                  |
| --------------------------- | ----------------------------------------- |
| `…1600_discussion_sessions` | three tables, constraints, indexes, prefs |
| `…1700_session_functions`   | the SECURITY DEFINER write/read functions |
| `…1800_session_rls`         | RLS policies and column grants            |
| `…1900_google_calendar`     | connection and mapping tables + RLS       |
| `…2000_session_grants`      | explicit `EXECUTE` grants                 |

Stage B needs a public HTTPS callback for real Google testing. Use a tunnel
(`ngrok http 3000`) and register the tunnel URL as the redirect URI, or test
Stage A locally and Stage B in a preview deployment.

### Checks

```bash
pnpm typecheck
pnpm lint
pnpm test          # unit tests, no database required
pnpm build
```

---

## 14. Deployment

1. Apply the migrations (`supabase db push`, or the CI job).
2. Set the environment variables from §12 in the hosting project.
3. Confirm the Vercel cron entry for `/api/cron/session-jobs` (every 10 minutes)
   and that `CRON_SECRET` matches the value the platform sends.
4. For Stage B, follow `docs/DEPLOYMENT.md` §3.1 to create the OAuth client, then
   verify `/settings/calendar` shows "Connect Google Calendar" rather than the
   "not configured" notice.
5. Smoke test: create a session, RSVP, open the calendar link, and (if Stage B is
   on) sync it and confirm the event appears in Google Calendar.

---

## 15. Troubleshooting

### "Google Calendar sync is not configured on this deployment"

`isGoogleCalendarConfigured()` returns false. It requires all four calendar
variables and a valid 32-byte key. Run `scripts/check-env.mjs`; it names the
missing or malformed value. Stage A is unaffected.

### The callback lands on `/settings/calendar?error=…`

| Code              | Cause                                                 | Fix                                                           |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `not_configured`  | Env vars missing                                      | Set all four                                                  |
| `session_expired` | The StarsTask session ended during consent            | Sign in again and retry                                       |
| `invalid_state`   | Cookie missing, expired (10 min), or a different user | Start again from `/settings/calendar` in the same browser     |
| `cancelled`       | Consent screen dismissed                              | Nothing to fix                                                |
| `callback_failed` | Code exchange rejected                                | Check that the redirect URI matches the Google client exactly |
| `transient`       | Google returned 5xx                                   | Retry in a minute                                             |
| `storage_failed`  | The connection row could not be written               | Check the database logs and the migration state               |

### "redirect_uri_mismatch" at Google

The value in `GOOGLE_CALENDAR_REDIRECT_URI` must be **character-for-character**
one of the authorised redirect URIs on the OAuth client: scheme, host, port, and
path. `http://localhost` and `https://preview-xyz.vercel.app` are different
clients' worth of configuration — register each one you use.

### Sync returns `calendar_reconnect_required`

Google revoked the grant (password change, manual removal, or expiry). The
connection is marked `revoked`. Disconnect and reconnect from
`/settings/calendar`; the next sync recreates the events.

### Duplicate events appear in Google Calendar

Should not happen: the mapping row is unique and events carry a private
`starstaskSessionId`. If it does, check whether two different `user_id`s are
involved (each user has their own copy by design) or whether the private
property was stripped by another tool.

### Reminders never arrive

1. Is `push_enabled` true and does the user have an active device?
2. Is the session `scheduled` with `starts_at` inside the next 25 hours?
3. Did the user RSVP `going`? `maybe` does not get reminders.
4. Did the cron run? Look for the aggregate counters in the route log.
5. Is `CRON_SECRET` set in the deployment?

### A session cannot be edited

Only `scheduled` sessions are editable. Reopen a cancelled or completed session
first (organiser controls on the detail page); this also reschedules the calendar
sync and notifies participants.

---

## 16. What is verified, and what is not

Verified locally, with the real toolchain:

- `pnpm typecheck` — clean across `packages/shared`, `packages/contracts`, `apps/web`.
- `pnpm lint` — zero warnings, zero errors.
- `pnpm test` — 355 unit tests pass, 139 of them new for this feature: session
  schemas, time-zone conversion (including a DST spring-forward), the calendar
  URL builder, reminder planning and re-validation, the reminder scheduler with
  in-memory fakes, token encryption round-trips and tamper detection, OAuth state
  binding, notification path allowlisting, and the RSVP view state.
- `pnpm build` — production build succeeds; every new route is registered.

Not verified, because the resources were unavailable:

- Applying the migrations to a real Postgres instance, and therefore the actual
  RLS behaviour under two different users. The policies follow the existing,
  tested patterns, but they have not been executed.
- A real OAuth round-trip with Google, and therefore the live Calendar API calls
  (create, patch, delete, search by extended property).
- End-to-end push delivery to a browser or phone.

The authenticated Playwright suite (`tests/e2e/authenticated-flows.spec.ts`)
now covers the class-invitation join and an RSVP against a disposable local
Supabase stack, but not yet check-in, reminders, or the calendar round-trip.

If you have a Supabase project, the highest-value first checks are: create a
session as a class admin, try the same as a student (expect `403`), RSVP twice as
one user (expect one row), and fill the last seat from two browsers at once
(expect one success and one `session_full`).
