# Deployment — StarsTask

## 0. What this document is

A runbook for standing StarsTask up on Supabase, Google Cloud, and Vercel.

**None of these steps have been executed for this repository.** No Supabase project, Google
OAuth client, or Vercel project was created while building it. Everything below is the
intended procedure, written against the code in this repository. Treat it as unverified
until each box in §7 is ticked on a real deployment.

The repository itself is deployable in the sense that `pnpm build` succeeds without any
secret; it is not _usable_ until the database and OAuth provider exist. Deadline reminders
are optional and stay off until the five push variables and a cron source are configured.

Push-specific procedure: `docs/PUSH_NOTIFICATIONS.md`.

---

## 1. Prerequisites

| Requirement    | Version used here                                  |
| -------------- | -------------------------------------------------- |
| Node.js        | 24.18.0 locally; `engines` requires ≥ 20.9.0       |
| pnpm           | 11.10.0 (`packageManager` field)                   |
| Supabase CLI   | Any version supporting `supabase link` / `db push` |
| Vercel account | Hobby works; Pro is required for a 10-minute cron  |

You also need a domain (or the `*.vercel.app` hostname) and access to Google Cloud Console.

---

## 2. Supabase project

### 2.1 Create the project

1. Create a project at <https://supabase.com/dashboard>. Pick the region closest to your
   users; Supabase Storage and Postgres live in that region.
2. Save the database password — `supabase link` and `db push` need it.
3. From **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The `service_role` key is **not** an application-wide secret. Copy it only into the
server-only `SUPABASE_SERVICE_ROLE_KEY` variable, which the cron scheduler uses to claim
delivery rows across users. Never expose it to the browser, and never prefix it with
`NEXT_PUBLIC_`. `scripts/check-env.mjs` fails the build if a
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exists.

### 2.2 Apply the migrations

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run     # review the fifteen migrations
supabase db push
```

What each migration does is listed in `docs/DATABASE.md`. `db push` does **not** apply
`supabase/seed.sql`; the seed is development-only (course catalogue). Add `--include-seed`
explicitly if you want those six courses in a staging project.

Verify afterwards:

```sql
-- Expect rowsecurity = true for the core, push, and class tables.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- Expect the class workflow functions.
select proname from pg_proc
where proname in (
  'apply_for_class',
  'decide_class_application',
  'accept_class_invitation',
  'submit_class_assignment',
  'review_class_assignment',
  'moderate_assignment',
  'list_classes'
);

-- Expect one private bucket.
select id, public, file_size_limit from storage.buckets
where id = 'assignment-attachments';

-- Expect the auth trigger.
select tgname from pg_trigger where tgname = 'on_auth_user_created';

-- Expect the push RPCs to exist.
select proname from pg_proc
where proname in (
  'register_push_subscription',
  'list_reminder_audience',
  'claim_notification_deliveries',
  'complete_notification_delivery'
);
```

If `supabase db push` reports drift, do not hand-edit the remote schema: reconcile with
`supabase db pull` and a new migration, or reset a disposable project.

### 2.3 Confirm auth settings

**Authentication → Providers**

- Google: enabled (client ID/secret from §3).
- Email: disabled, or at minimum ensure the UI never offers it. StarsTask has no password
  field, no OTP, and no magic-link screen.
- All other providers: disabled.

**Authentication → URL Configuration**

| Setting       | Local                                   | Production                              |
| ------------- | --------------------------------------- | --------------------------------------- |
| Site URL      | `http://localhost:3000`                 | `https://<your-domain>`                 |
| Redirect URLs | `http://localhost:3000/auth/callback**` | `https://<your-domain>/auth/callback**` |

Preview deployments need their own entry if you want sign-in there:

```
https://*-<team-slug>.vercel.app/auth/callback**
```

The trailing `**` is required. The app appends `?next=…` to the callback URL, so an exact
`/auth/callback` entry is rejected by Supabase.

The app builds `redirectTo` from `window.location.origin`, not from
`NEXT_PUBLIC_SITE_URL`. That means every origin you actually serve must be allow-listed in
Supabase — a preview URL that is not listed fails with a redirect error at the Google step.

---

### 2.4 Seed the first platform admin

There is no UI, API, or client path that grants Platform Admin; the role is
seeded manually. Do this once, from the SQL editor or a trusted server, using the
auth user id of the operator:

```sql
insert into
  public.platform_admins (user_id, granted_by)
values
  ('<auth-user-uuid>', null) on conflict (user_id) do nothing;
```

Grant subsequent admins the same way and keep the change outside the app. See
[docs/CLASSES.md](./CLASSES.md#14-manual-setup). Without this row, no class
application can be approved and `/admin` returns 404.

## 3. Google OAuth client

1. <https://console.cloud.google.com> → create or select a project.
2. **APIs & Services → OAuth consent screen**: External, app name, support email,
   developer email. Add scopes `openid`, `email`, `profile` (Supabase requests these).
   While the app is in "Testing", only listed test users can sign in.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://<your-domain>`
   - `https://<preview-domain>` per preview that needs sign-in
5. Authorized redirect URI — this is the **Supabase** callback, not the app route:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

6. Paste the client ID and secret into Supabase → Authentication → Providers → Google.

Local CLI alternative (`supabase start`) reads them from the shell:

```bash
export SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
export SUPABASE_AUTH_GOOGLE_SECRET=...
supabase start
```

`supabase/config.toml` already wires this via `env(...)` substitution.

### 3.1 Calendar OAuth client (optional)

Calendar sync needs its **own** OAuth client. Reusing the Supabase sign-in client would
add `calendar.events` to the consent screen of every login, and would couple an optional
feature to authentication.

1. Same Google Cloud project (or a new one) → **APIs & Services → Library** →
   enable **Google Calendar API**.
2. **APIs & Services → OAuth consent screen → Data access**: add the scope
   `https://www.googleapis.com/auth/calendar.events`. Nothing else is required; do not add
   `.../auth/calendar` (full read/write) or any read scope.
3. **Credentials → Create credentials → OAuth client ID → Web application** (a second
   client, separate from the sign-in one).
4. Authorized redirect URI — this is the **app route**, not Supabase:

   ```
   http://localhost:3000/api/integrations/google-calendar/callback
   https://<your-domain>/api/integrations/google-calendar/callback
   ```

   Register one entry per environment you use. Google compares the value
   character-for-character, including the scheme and any port.

5. Copy the client ID and secret into the deployment as `GOOGLE_CALENDAR_CLIENT_ID` and
   `GOOGLE_CALENDAR_CLIENT_SECRET`, set `GOOGLE_CALENDAR_REDIRECT_URI` to the matching
   URL, and generate the token key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Put the result in `GOOGLE_TOKEN_ENCRYPTION_KEY`.

If you skip all of this, Stage A ("Add to Google Calendar") still works and
`/settings/calendar` explains that sync is not configured. Details:
`docs/SESSIONS.md` §6.

---

## 4. Environment variables

| Variable                               | Scope  | Needed at             | Notes                                           |
| -------------------------------------- | ------ | --------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public | Build **and** runtime | Inlined into the client bundle                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Build **and** runtime | Inlined; safe because RLS is the guard          |
| `NEXT_PUBLIC_SITE_URL`                 | Public | Build                 | Canonical URLs, OG tags, `robots.txt`, sitemap  |
| `RATE_LIMIT_SALT`                      | Server | Runtime               | ≥32 chars; rotating it resets all counters      |
| `UPSTASH_REDIS_REST_URL`               | Server | Runtime               | Optional                                        |
| `UPSTASH_REDIS_REST_TOKEN`             | Server | Runtime               | Optional, set together with the URL             |
| `VAPID_PUBLIC_KEY`                     | Server | Runtime               | Push group; passed to the browser as a prop     |
| `VAPID_PRIVATE_KEY`                    | Server | Runtime               | Push group; never log or expose                 |
| `VAPID_SUBJECT`                        | Server | Runtime               | Push group; `mailto:` or `https:` URI           |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server | Runtime               | Push group; cron scheduler only, bypasses RLS   |
| `CRON_SECRET`                          | Server | Runtime               | Push group; ≥32 chars, bearer token             |
| `GOOGLE_CALENDAR_CLIENT_ID`            | Server | Runtime               | Calendar group; separate from sign-in           |
| `GOOGLE_CALENDAR_CLIENT_SECRET`        | Server | Runtime               | Calendar group; never log or expose             |
| `GOOGLE_CALENDAR_REDIRECT_URI`         | Server | Runtime               | Calendar group; must match the console entry    |
| `GOOGLE_TOKEN_ENCRYPTION_KEY`          | Server | Runtime               | Calendar group; 32 bytes, base64                |
| `OCR_PROVIDER`                         | Server | Runtime               | Leave group; `disabled` (default) or `pdf-text` |
| `SUPABASE_TEST_*`                      | Server | Tests only            | Never set in Vercel                             |

The five push variables are all-or-none. When any is missing, the app still builds and
serves; `/settings/notifications` shows "not configured" and the cron route answers `503`.
Generate the keys once per deployment:

```bash
pnpm --filter @starstask/web exec web-push generate-vapid-keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # CRON_SECRET
```

The four calendar variables are also all-or-none. When any is missing, the app still
builds and serves; `/settings/calendar` shows "not configured", the sync endpoint answers
`503 calendar_not_configured`, and the "Add to Google Calendar" link keeps working.

Rotating VAPID keys invalidates every stored subscription, so users must re-enable
notifications. Rotating `CRON_SECRET` only requires updating the scheduler's header.
Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` makes stored tokens unreadable, so every user
reconnects once; nothing else breaks. Full push runbook:
`docs/PUSH_NOTIFICATIONS.md`; calendar runbook: `docs/SESSIONS.md`.

OCR needs no credentials: `OCR_PROVIDER` selects between `disabled` (the default —
the field-extraction UI simply never appears) and `pdf-text` (reads the text layer
of uploaded PDFs locally; no external service, no key). Scanned-image OCR would
need an external provider wired into `apps/web/src/lib/ocr`, which is not
configured by default. Evidence uploads work either way; OCR failing or being
disabled never blocks a request.

Two behaviours worth knowing:

- `NEXT_PUBLIC_*` values are frozen at build time. Changing one requires a redeploy, not a
  restart.
- `NEXT_PUBLIC_SITE_URL` must be the exact public origin (`https://starstask.app`, no
  trailing slash, no path). It does not affect OAuth, but it does affect canonical links
  and the sitemap.

Generate the salt:

```bash
node scripts/new-rate-limit-salt.mjs
```

Preflight before deploying:

```bash
node --env-file=apps/web/.env.local scripts/check-env.mjs
```

Note: the checker requires the Supabase host to end in `.supabase.co` or `.supabase.in`.
A custom Supabase domain or a local `http://127.0.0.1:54321` will fail that check — pass
the values another way if you use one.

---

## 5. Vercel

### 5.1 Project settings

| Setting          | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Framework preset | Next.js                                                                        |
| Root Directory   | `apps/web`                                                                     |
| Install Command  | default (Vercel detects `pnpm-workspace.yaml` and installs from the repo root) |
| Build Command    | default (`next build`)                                                         |
| Output Directory | default (`.next`)                                                              |
| Node.js Version  | 22.x or 24.x                                                                   |

Vercel must install from the monorepo root so `@starstask/contracts` and
`@starstask/shared` resolve through the workspace; it detects pnpm from the lockfile at the
repository root. If the install step fails to resolve the workspace packages, set the
Install Command explicitly:

```bash
cd ../.. && pnpm install --frozen-lockfile
```

or, to install only what this app needs:

```bash
pnpm install --filter @starstask/web...
```

Alternative: keep Root Directory at the repo root and set the Build Command to
`pnpm --filter @starstask/web build`. Either works; do not mix them.

### 5.2 Environment scoping

Set every variable in **Production** _and_ **Preview** if previews should work, because
`NEXT_PUBLIC_*` is baked in at build time. Use different Supabase projects for preview and
production if you do not want test data in the real catalogue.

`SUPABASE_TEST_*` and the Upstash pair belong to local/CI only; leave them unset on Vercel
unless you intentionally use Upstash.

### 5.3 Preview deployments

Two things break preview OAuth by default:

1. The preview origin is not in Supabase's redirect allowlist — add the wildcard entry.
2. Vercel Deployment Protection puts an SSO wall in front of preview URLs, so the OAuth
   callback lands on a Vercel login page instead of the app. Either disable protection for
   the preview environment or test sign-in on production only.

### 5.4 Deploy

Push the repository to GitHub, import it in Vercel, set the environment variables, deploy.
The build does not need a database connection: every page is dynamic and no query runs at
build time.

### 5.5 Cron scheduling

`apps/web/vercel.json` declares:

```json
{
  "crons": [
    { "path": "/api/cron/deadline-reminders", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/notification-events", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/session-jobs", "schedule": "*/10 * * * *" }
  ]
}
```

Vercel adds `Authorization: Bearer $CRON_SECRET` automatically when that variable is set
for the environment. The routes reject anything else with `401` and return `503` when the
relevant configuration is incomplete.

`/api/cron/session-jobs` runs two phases in one invocation: session reminders (24h and 3h)
and up to 20 due Google Calendar syncs. A failure in the reminder phase is logged and the
calendar phase still runs, so one broken queue does not stall the other.

**Plan limitation:** Vercel Hobby only offers daily cron jobs, so a 10-minute schedule is
not available there. Either upgrade to Pro, or do not rely on the Vercel cron:

- Supabase `pg_cron` + `pg_net` calling the route every 10 minutes (store the secret in
  Supabase Vault).
- An external scheduler (GitHub Actions, cron-job.org, a worker) hitting the same URL with
  the bearer token.
- A manual `curl` while verifying.

Verify the deployed schedule rather than assuming it:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/cron/deadline-reminders
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/cron/session-jobs
# expect 401 without the header; 200 with it
```

The scheduler does not depend on page visits, but it is **inactive** until one of these is
configured and observed running.

---

## 6. Post-deploy smoke test

Run these against the deployed origin.

```bash
# 1. Public shell renders without a session.
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/

# 2. Security headers are present.
curl -sSI https://<domain>/ | grep -i -E 'content-security-policy|x-frame-options|strict-transport'

# 3. robots.txt points at the sitemap.
curl -sS https://<domain>/robots.txt

# 4. Listing API answers and returns published rows only.
curl -sS 'https://<domain>/api/assignments?pageSize=1'

# 5. Unknown id is a 404, not a 500.
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/assignments/00000000-0000-0000-0000-000000000000

# 5b. Public class discovery answers without a session.
curl -sS 'https://<domain>/api/classes?pageSize=1'

# 5c. Platform admin endpoints reject anonymous callers.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST https://<domain>/api/admin/class-applications/00000000-0000-0000-0000-000000000000/decision   # expect 401

# 6. The PWA manifest and service worker are served at the documented paths.
curl -sS https://<domain>/manifest.webmanifest | head -c 200
curl -sSI https://<domain>/sw.js | grep -i -E 'content-type|service-worker-allowed|cache-control'

# 7. The cron route refuses an unauthenticated call.
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/api/cron/deadline-reminders   # expect 401

# 8. The cron route accepts the secret (503 means the push group is incomplete).
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/deadline-reminders
```

In the browser:

1. Open `/login`, click **Continue with Google**, complete consent, land back on the page
   you started from (e.g. `/submit`).
2. Publish an assignment with one PDF. It should appear on `/assignments` and on
   `/my-assignments`.
3. Download the attachment — the link must be a `…/storage/v1/object/sign/…` URL that
   expires in 15 minutes.
4. Sign out, then open the same assignment: the detail page must still load, and
   `/submit` must redirect to `/login?next=%2Fsubmit`.
5. Apply for a class from `/dashboard/applications`. Confirm it stays pending until a
   platform admin approves it from `/admin`, and that approval optionally grants the
   class admin role.
6. As the class admin, create an invitation and open it in a private window with a second
   account. Confirm membership was granted but no admin role was.
7. Submit a class assignment. Confirm it stays out of `/assignments` and shows in the
   class review queue. Approve it, then confirm it appears on `/assignments` and
   `/classes/<slug>` without a session, including its attachment.
8. Unpublish the assignment and confirm both public pages stop showing it. Try to open a
   pending attachment path directly; it must fail.
9. In a private window, sign in as a second Google account and confirm the edit/delete
   controls are absent from the first user's assignment.
10. Try `PATCH` and `DELETE` against the first user's id with the second account's session;
    both must return `404`.
11. Open `/settings/notifications`, enable notifications, and confirm the device appears in
    the list. Reload: the state must persist.
12. Save an assignment whose deadline is inside the next three hours, then trigger the cron
    route. The notification must arrive, and clicking it must open that assignment.
13. Confirm `notification_deliveries` has exactly one row for that
    `(user, assignment, reminder_type, deadline)` and that a second cron run does not send
    again.

Database checks (SQL editor):

```sql
-- No pending row is visible to anon.
set
  role anon;

select
  count(*)
from
  public.assignments
where
  status = 'pending';

-- expect 0
reset role;

-- Profiles were provisioned by the trigger.
select
  count(*)
from
  public.profiles;

-- Push tables are protected and the ledger dedupes.
select
  relname,
  relrowsecurity
from
  pg_class
where
  relname in (
    'push_subscriptions',
    'notification_preferences',
    'saved_assignments',
    'notification_deliveries'
  );

-- expect true for all four
select
  has_column_privilege (
    'authenticated',
    'public.push_subscriptions',
    'endpoint',
    'select'
  );

-- expect false
```

---

## 7. Acceptance checklist

- [ ] `supabase db push` applied every migration in `supabase/migrations/`, no drift
- [ ] Bucket `assignment-attachments` exists, `public = false`, 10 MiB limit
- [ ] Bucket `leave-evidence` exists, `public = false`, 10 MiB limit, `pdf/jpeg/png` only
- [ ] Google is the only enabled provider
- [ ] Site URL + `…/auth/callback**` allow-listed for every origin you serve
- [ ] `pnpm check:env` passes with the production values
- [ ] Build on Vercel succeeds and `/` returns 200
- [ ] Google sign-in round-trip works and returns to `next`
- [ ] Upload → publish → download → delete works end to end
- [ ] Second account cannot read a pending row or mutate another user's row
- [ ] `/robots.txt` and `/sitemap.xml` reference the production origin
- [ ] `/manifest.webmanifest` and `/sw.js` are served; the app is installable
- [ ] Push variables are set; `/settings/notifications` shows no "not configured" badge
- [ ] A device can be enabled, listed, and removed
- [ ] The cron route returns `401` without a token and `200` with it
- [ ] A cron source is actually observed running on the intended schedule
- [ ] A student can create a leave request, upload evidence, and confirm OCR fields
- [ ] A class admin can review, return for correction, and forward a package; the
      downloaded PDF opens and every request in it carries its `LR-…` reference
- [ ] A second class admin cannot list, review, or export another class's requests
- [ ] The CSV export opens in a spreadsheet and formula-injection cells are neutralised
- [ ] One test reminder is delivered and clicking it opens the assignment
- [ ] A second cron run does not duplicate the reminder

---

## 8. Rollback

**Application.** Vercel keeps every deployment; promote the previous one under
_Deployments → … → Promote to Production_. This is instant and needs no database change.

**Database.** There are no down migrations. Choose one:

1. **Compensating migration** (preferred): add `supabase/migrations/<timestamp>_revert_x.sql`
   and `supabase db push`.
2. **Restore**: Supabase dashboard → Database → Backups → restore to a point in time.
   This discards everything written after that point.

Do not run `supabase db reset` against a project that holds real data — it drops the schema
and re-applies migrations, then loads `seed.sql`.

**Storage.** Deleting an assignment deletes its DB row first and its objects second. If the
object delete fails, the objects remain under `{user_id}/{assignment_id}/` and must be
removed manually in the Storage browser.

---

## 9. Troubleshooting

| Symptom                                        | Likely cause                                                    | Fix                                                     |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| "Supabase is not configured yet" on every page | Public env vars missing at build time                           | Set them in Vercel, redeploy                            |
| Google sign-in returns `redirect_uri_mismatch` | Google client is missing the Supabase callback                  | Add `https://<ref>.supabase.co/auth/v1/callback`        |
| Sign-in lands on `?error=callback_failed`      | Callback URL not allow-listed in Supabase, or PKCE cookie lost  | Add the `**` entry; confirm cookies are not blocked     |
| Sign-in works locally, fails on preview        | Preview origin not allow-listed, or Deployment Protection       | Add the wildcard entry; disable protection for previews |
| `403` / empty list for published rows          | RLS migration not applied                                       | Re-run `supabase db push`, check `relrowsecurity`       |
| Attachment download 400                        | Bucket missing or object deleted                                | Check `storage.buckets`, then the object path           |
| Upload rejected with "does not look like"      | Extension and magic bytes disagree                              | Re-export the file; the check is intentional            |
| `429` immediately after deploying              | Salt changed while counters persisted                           | Wait for the window to expire                           |
| Sitemap empty                                  | `NEXT_PUBLIC_SITE_URL` unset, or no published rows              | Set the origin; publish something                       |
| Notifications page says "not configured"       | Push env group incomplete                                       | Set all five values, redeploy                           |
| No "Enable" button on iPhone/iPad              | Site opened in Safari, not the Home Screen app                  | Add to Home Screen, open the icon, sign in              |
| Enabling returns `409`                         | Endpoint already registered to another account                  | Disable it there or clear site data                     |
| Cron returns `401`                             | `CRON_SECRET` missing or header not sent                        | Configure the scheduler's bearer header                 |
| Cron returns `503`                             | Push env group incomplete                                       | Set VAPID + service-role key + secret                   |
| Cron still `503` with all five values set      | `VAPID_SUBJECT` is a bare address, not a `mailto:`/`https:` URI | Prefix it: `mailto:you@example.com`                     |
| Cron returns `200`, nothing arrives            | No deadline in the 24h/3h window, no active device, opt-out     | Check preferences, devices, `notification_deliveries`   |
| Cron never runs on schedule                    | Vercel Hobby only supports daily cron                           | Upgrade to Pro or use pg_cron/external scheduler        |
| A device disappears after a send               | Push service returned `404`/`410`                               | Expected; the endpoint was expired and disabled         |

---

## 10. Operational gaps

- No error tracking. Failures are logged to the platform log with a Postgres code or an
  error name; there is no Sentry/OTel integration.
- No scheduled job for orphaned storage objects when cleanup fails mid-request.
- Content reports and account suspension are not implemented.
- No automated backup verification; rely on the Supabase plan's retention.
- No cron source is configured or observed. The Vercel schedule needs Pro; alternatives are
  listed in `docs/PUSH_NOTIFICATIONS.md` §5.
- No real push delivery has been observed: there is no VAPID key pair, no deployed
  environment, and no physical iOS/Android/desktop device test.
- `notification_deliveries` has no automatic retention job; cleanup is manual SQL.
- The integration suite (`pnpm test:integration`) has never been run against a real
  project. Run it once against a disposable project before trusting the RLS claims,
  including the four push tables.
