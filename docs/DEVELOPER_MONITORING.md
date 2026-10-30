# Developer monitoring — StarsTask

## 1. Scope

`/developer` is an internal operations console. It shows real account,
sign-in, application-activity, error, and health data to a small server-side
allowlist. It is not a product feature and it is not part of the workspace
navigation.

The console renders inside the normal workspace shell (same left sidebar and
topbar as every other page). For an allowlisted developer account the sidebar's
main section is replaced by the console sections below, and the proxy bounces
developer accounts from student-only workspace paths (`/dashboard`,
`/assignments`, `/classes`, `/leave-requests`, `/sessions`, `/submit`,
`/my-assignments`) to `/developer` as a routing rule — every page still
enforces its own auth requirements independently. Post-sign-in, a developer
account lands on `/developer` and every other account on `/dashboard`.

The console has seven sections, all behind the same allowlist:

| Section      | Path                      | Purpose                                                              |
| ------------ | ------------------------- | -------------------------------------------------------------------- |
| Overview     | `/developer`              | Metrics, health, recent activity.                                    |
| Users        | `/developer/users`        | Paginated, searchable account directory.                             |
| Logs         | `/developer/logs`         | Browse sanitized server-error markers with time and text filters.    |
| Security     | `/developer/security`     | Browse the audit trail and recorded sign-in outcomes.                |
| Database     | `/developer/database`     | Connectivity, connection usage, table sizes, applied migration list. |
| Integrations | `/developer/integrations` | Configuration presence checks and a storage reachability probe.      |
| Incidents    | `/developer/incidents`    | Track operational incidents with severity, status, and notes.        |

Access is independent of every application role. A platform admin, class admin,
lecturer, or student is denied unless their verified email is on the developer
allowlist.

| Piece              | Location                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| Allowlist logic    | `packages/shared/src/developer.ts`                                     |
| Query contracts    | `packages/contracts/src/developer.ts`                                  |
| Access guards      | `apps/web/src/lib/auth/developer.ts`                                   |
| Read models        | `apps/web/src/lib/db/developer.ts`                                     |
| Operations models  | `apps/web/src/lib/db/developer-operations.ts`                          |
| Integration status | `apps/web/src/lib/observability/integration-status.ts`                 |
| Event writers      | `apps/web/src/lib/observability/events.ts`                             |
| Error capture      | `apps/web/src/instrumentation.ts`, `apps/web/src/lib/api/responses.ts` |
| Pages              | `apps/web/src/app/(workspace)/developer/**`                            |
| APIs               | `apps/web/src/app/api/developer/**`                                    |
| Monitoring tables  | `supabase/migrations/20261029002800_developer_monitoring.sql`          |
| Operations tables  | `supabase/migrations/20261029003200_developer_operations.sql`          |

## 2. Configuration

### Allowlist

```dotenv
DEVELOPER_EMAILS=developer@example.com
```

- Comma-separated: `DEVELOPER_EMAILS=first@example.com,second@example.com`.
- Entries are trimmed, lowercased, deduplicated, and matched against the email
  Supabase Auth returns for the verified session.
- Server-only. Never add the `NEXT_PUBLIC_` prefix.
- Empty, blank, or malformed values fail closed. One malformed entry invalidates
  the whole list so a typo cannot silently grant access to the remaining names.
- Missing or invalid configuration shows a closed "not configured" state; it
  never falls back to role checks, client metadata, or a hidden link.

`SUPABASE_SERVICE_ROLE_KEY` must also be configured on the server. The dashboard
uses it for the Auth admin API, the monitoring tables, and health probes. Without
it, `/developer` stays closed to non-allowlisted callers and shows a
"data source not configured" warning to an allowlisted developer.

### Grant and revoke

1. Add or remove the email in `DEVELOPER_EMAILS` in the server environment.
2. Redeploy or restart the application so the new value is read.
3. Confirm the person can sign in through the normal Google flow.

Revoking an email takes effect on the next request after redeploy. No database
row, account, or application role changes. Removing `DEVELOPER_EMAILS`
entirely closes the dashboard for everyone.

### Production

1. Add `DEVELOPER_EMAILS` and `SUPABASE_SERVICE_ROLE_KEY` to the production host
   as server-only variables.
2. Apply `supabase/migrations/20261029002800_developer_monitoring.sql` and
   `supabase/migrations/20261029003200_developer_operations.sql` in order with
   the other pending migrations.
3. Redeploy and sign in with a listed email.
4. Open `/developer`. If the configuration is malformed, the page stays closed.

Do not place real email addresses in `.env.example`, documentation, tests, or
screenshots. Use `developer@example.com` as the placeholder.

## 3. What the dashboard shows

### Metrics

| Metric                       | Source                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| Total users                  | `auth.users` row count through a service-role-only SQL function.     |
| Registrations (7 / 30 days)  | `auth.users.created_at` within the window.                           |
| Successful sign-ins (7 / 30) | `auth_activity_events` rows written by `/auth/callback`.             |
| Unique active users (7 / 30) | Distinct `user_id` among recorded successful sign-ins in the window. |
| Total assignments            | `assignments` row count.                                             |
| Auth failures (24 hours)     | Recorded `sign_in_failed` callback outcomes.                         |

Nothing is estimated or hardcoded. When a table has no rows, the UI says so.

### User directory

The directory uses the Supabase Auth admin API on the server. Columns:

- display name (profile row first, then OAuth metadata)
- account creation date
- last successful sign-in (`last_sign_in_at`)
- account ID
- role: Platform admin, Class admin (with class count), or Member

Platform and class roles are derived from `platform_admins` and `class_admins`.
The directory does not read passwords, providers, tokens, or session data.

Personal data stays out of this surface. Emails are never returned by the API
route, rendered, or used as a search key, and NIM is never selected: the
monitoring queries do not touch `profiles.nim`. Only the public nickname
(`profiles.display_name`) and the account ID identify a row.

Search and sort run in memory. Supabase Auth has no server-side filter for
`listUsers`, so the server pages through up to 50 pages of 1,000 accounts.
Search matches the OAuth metadata name; the displayed name prefers the profile
row. If the scan cap is reached, the UI warns that search and totals cover only
the scanned accounts. The page size is capped at 100 and defaults to 25.

### Authentication activity

- Recent successful and failed callback outcomes with timestamps.
- Recent registrations from profile rows.
- Failure reasons are fixed server-side labels such as `exchange_failed`,
  `missing_code`, `provider_error`, `oauth_cancelled`, and `rate_limited`.

This is **not** a complete login history:

- Supabase Auth stores only the latest `last_sign_in_at` per account.
- Event recording begins when this feature is deployed.
- A password failure inside Supabase Auth is not visible to this app; only
  callback failures are recorded.
- No IP address, user agent, email, or token is stored in these rows.

### Application activity

Recent rows combine:

- `audit_logs`: class, application, leave, verification, moderation, and role
  changes already recorded by existing database functions.
- `app_activity_events`: assignment create, update, and delete, written by the
  server after the operation succeeds.

Rows contain an event type, timestamp, actor ID when available, resource type,
resource ID, and optional class ID. They never contain document contents, titles
from leave evidence, passwords, or tokens.

### System health

- Application: the dashboard itself rendered through the running app.
- Database: a read-only account query with latency.
- Object storage: a metadata lookup for the attachment bucket with latency.
- Server errors in the last 24 hours and the five most recent sanitized rows.
- Auth callback failures in the last 24 hours.

Health responses do not include environment values, credentials, stack traces,
database contents, or bucket names.

## 4. Error tracking

Two server paths write `app_error_events`:

1. `instrumentation.ts` `onRequestError` captures uncaught render, route, action,
   and proxy errors. It stores the route template, HTTP method, error name, and
   Next digest only.
2. `handleRouteError` records the error name and digest when an API route throws
   an unexpected error after its own handling. Expected `ApiError`, validation,
   authentication, and not-found responses are not recorded.

Messages, stacks, headers, cookies, query strings, and bodies are never stored.
This is not a replacement for platform logs and does not capture handled 4xx
responses.

## 5. Database security

- `auth_activity_events`, `app_activity_events`, and `app_error_events` are
  append-only tables.
- RLS is enabled with no policies, and all privileges are revoked from `PUBLIC`,
  `anon`, and `authenticated`.
- `service_role` receives only `SELECT` and `INSERT` on these tables plus
  sequence usage. No `UPDATE` or `DELETE` grant exists.
- `developer_dashboard_metrics(...)` is `SECURITY DEFINER`, revoked from
  `PUBLIC`, `anon`, and `authenticated`, and executable only by `service_role`.
- Existing RLS policies and grants are unchanged.
- `app_activity_events_metadata_no_pii` rejects metadata keys `email`, `nim`,
  `full_name`, `name`, `phone`, and `avatar_url`, so personal data cannot be
  written into monitoring rows even by a future caller.
- No monitoring query runs in the browser. The service-role key is never sent to
  a client component or response.

## 6. API surface

| Endpoint                                   | Purpose                                   |
| ------------------------------------------ | ----------------------------------------- |
| `GET /api/developer/overview`              | Metrics and health.                       |
| `GET /api/developer/users`                 | Paginated, searchable user directory.     |
| `POST /api/developer/incidents`            | Open an incident (title, severity, note). |
| `PATCH /api/developer/incidents/[id]`      | Change an incident's status.              |
| `POST /api/developer/incidents/[id]/notes` | Add an investigation note to an incident. |

All endpoints run the same allowlist guard independently of the page. They
return `401` for no session, `403` for a non-allowlisted or unconfigured
deployment, and are rate limited per client. Incident mutations attribute the
actor from the server-verified session; a client-supplied actor ID is never
trusted.

## 6a. Logs, security, database, and integrations pages

- **Logs** pages `app_error_events` with a time-range filter (24h / 7d / 30d /
  all) and a substring search over route path and error name. PostgREST `or`
  filters are escaped so a search term cannot inject filter syntax.
- **Security** pages one of three streams: the `audit_logs` trail, failed
  sign-in outcomes, or successful sign-in outcomes. Only action, reason,
  provider, entity type, actor ID, and timestamp are displayed.
- **Database** calls two service-role-only SQL functions:
  `developer_database_health()` (connection usage from `pg_stat_activity` and
  total sizes of owned tables) and `developer_applied_migrations()` (the
  Supabase CLI migration history). If the role cannot see connection counts or
  the history table is absent, the page renders "unavailable" instead of zero.
  Running migrations is deliberately not exposed — that stays a CLI operation.
- **Integrations** answers only "configured / reachable" for each runtime
  dependency (Supabase client and service role, developer allowlist, Upstash
  Redis, VAPID push keys, Google Calendar credentials, cron secret, site URL,
  and a storage bucket metadata probe). No environment value, URL, or key
  material is ever included in a response.

## 6b. Incidents

`developer_incidents` and `developer_incident_notes` are service-role tables
with RLS enabled, no policies, and no grants to `anon` or `authenticated`. The
service role has `INSERT`/`UPDATE` on incidents and `INSERT`/`SELECT` on
notes; there is **no `DELETE` grant**, so incidents are an append-and-amend
record. Titles, severities, statuses, and note bodies are length- and
enum-checked at the database layer as well as in the contracts, so a skipped
client validation cannot widen what is stored.

## 7. Verification status

Verified locally:

- TypeScript, ESLint, unit tests, and the production build.
- Allowlist parsing and access-decision tests.
- Contracts for the logs, security, and incident payloads.
- Integration-status presence logic, including that no environment value
  reaches a response payload.

Not verified:

- The migrations have not been executed against a live Postgres database in
  this environment.
- Auth event writing, instrumentation capture, and the dashboard's live
  queries have not been exercised end-to-end against Supabase.
- OAuth callback recording has not been tested against a real Google sign-in.
- Storage, database health probes, and the developer operations SQL functions
  have not been tested against a live Supabase project.
- Incident writes have not been exercised against a live database.

Apply the migrations and perform a real sign-in before relying on the metrics
in production. The dashboard reports empty states honestly until those events
exist.
