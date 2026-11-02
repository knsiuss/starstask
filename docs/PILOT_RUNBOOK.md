# Closed Pilot Runbook — StarsTask

> **Status: not executed.** This runbook describes how to run a closed, one-class pilot. No
> Supabase project, Google OAuth client, domain, or Vercel deployment exists for this
> repository yet. Setup steps live in [DEPLOYMENT.md](./DEPLOYMENT.md); this document adds
> the pilot-specific scope, decisions, operations, and stop conditions on top of them.

## 0. Scope

A **closed pilot** means one class, one campus, a known cohort, and a fixed end date. The
goal is to prove that the platform can carry a real class for two to four weeks without
security incidents, data loss, or a core workflow that requires a developer to unblock.

In scope:

- Google sign-in, profile onboarding, and one class joined through an invitation.
- Class posts: lecturer assignments and announcements, student submissions, review, and
  publication.
- Discussion sessions with RSVP, plus check-in where the class actually meets in person.
- Absence requests with evidence, class-admin review, and PDF/CSV export.
- Notifications **only if** the push variables and a cron source are configured and tested.

Out of scope for the pilot:

- Public assignment discovery. Assignment routes require a session by design.
- New features. Correctness, security, and recovery come first.
- Account suspension and error tracking do not exist yet.
- Google Calendar sync and OCR may be available, but treat them as optional. See the
  limitations in §10 before enabling either for participants.

The pilot does not change the security model. RLS, server-side authorization, private
storage, and audit logging stay exactly as they are. If a flow only works by weakening a
policy, the flow does not ship.

Measurement and exit criteria are defined in
[PILOT_MEASUREMENT.md](./PILOT_MEASUREMENT.md).

## 1. Roles

| Role                | Person             | Responsibilities                                                                                      |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| Owner               | `________________` | Approves scope, decisions in §4, and the exit decision. Holds the Supabase and Google Cloud accounts. |
| Platform admin      | `________________` | Seeded manually; approves the class application and any representative verification.                  |
| Class admin         | `________________` | Runs the class, invites students, publishes posts, reviews submissions, forwards absence packages.    |
| Developer / on-call | `________________` | Deploys, watches logs, handles incidents, fixes P0/P1 issues during the pilot.                        |
| Participants        | `____` students    | Use the product for real class activity and give feedback through the agreed channel.                 |

One person may hold more than one role. Keep the on-call developer distinct from the class
admin if possible, so an outage has a responder who is not also teaching.

## 2. Entry criteria

Do not start with real student data until every box is true.

- [ ] The release commit is tagged and the working tree is clean. No uncommitted migration
      is part of the release (see [AGENTS.md](../AGENTS.md) §11).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:integration`
      pass on the release commit.
- [ ] Every migration applies from an empty local Supabase instance, and
      `pnpm db:types` produces no drift.
- [ ] The Supabase project, Google OAuth client, domain, and Vercel project exist, and
      the procedure in [DEPLOYMENT.md](./DEPLOYMENT.md) §2–§5 has been followed.
- [ ] `pnpm check:env` passes with the production values.
- [ ] The first platform admin is seeded manually; no UI or API can grant that role.
- [ ] The owner has recorded decisions in §4, including retention and legal handling.
- [ ] A feedback channel and an incident contact exist and participants have both.
- [ ] A staging dry run with two fake Google accounts has completed §6 without a P0 or P1
      finding.

## 3. Pre-flight

### 3.1 Release candidate

1. Freeze scope. Record the commit SHA and tag it, for example `pilot-1`.
2. Confirm the deployment serves that exact commit. Rollback in
   [DEPLOYMENT.md](./DEPLOYMENT.md) §8 assumes every past deployment is still available.
3. Keep the Google OAuth consent screen in **Testing** and list only the pilot accounts,
   unless the owner has deliberately published it. Add every account before sending the
   invitation; an unlisted account fails at Google, not inside StarsTask.
4. Confirm no local `.env.local`, database dump, or generated artifact is committed. Run
   the repository's secret scan if one is configured; if none is configured, say so in the
   pilot report rather than assuming the diff is clean.
5. Apply migrations to the pilot project with `supabase db push`, never by editing the
   remote schema in the dashboard.

### 3.2 Class and data setup

Use the real workflows so the pilot exercises the same code path students will use:

1. The class admin applies for a class from the applications page.
2. The platform admin approves it from `/admin`. Approve does not need to grant the class
   admin role if the applicant is already a verified representative; otherwise grant it.
3. Keep `classes.join_policy` at its default `invitation`. Do not enable open join for a
   closed pilot; a class admin can change it from Class settings, so confirm it is still
   `invitation` before inviting participants.
4. Create one invitation with a short expiry and a usage limit that matches the cohort.
   Email-restrict it when every participant has a known Google address.
5. Publish one obviously fake assignment, submit one fake student submission, review it,
   and confirm it appears only to signed-in members.
6. Archive or remove the fake content before participants arrive, or label it clearly as a
   sample so nobody mistakes it for a real deadline.

### 3.3 Dry run

Run [DEPLOYMENT.md](./DEPLOYMENT.md) §6 on the pilot origin using two disposable Google
accounts, then run the pilot-specific flow in §6 below. Do this at least 24 hours before
launch so every configuration mistake has time to surface.

## 4. Owner decision gates

These decisions are not technical defaults. Record the answer, the date, and the person
who decided. **If a decision is missing, the safe default is to keep the pilot on synthetic
data and leave the affected feature off.**

### 4.1 Retention (2.4)

| Data                            | Decision needed                                                                   | Default if undecided                                  |
| ------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Absence evidence and OCR output | Retention after forwarding; who deletes it; whether students can request deletion | Keep only for the pilot and delete at exit (§8)       |
| Check-in coordinates            | Review window, then purge `latitude`/`longitude` while keeping status/distance    | Do not enable GPS check-in with real locations        |
| Notification deliveries ledger  | Age after which terminal rows are deleted                                         | Leave the ledger in place; it holds no payloads       |
| Audit logs                      | Retention period required by the institution                                      | Keep; do not delete during the pilot                  |
| Exports (PDF/CSV/ZIP)           | Where the class admin stores them and when they are deleted                       | Store outside public folders; delete after forwarding |

There is no automatic retention job in the repository. Cleanup is manual SQL, executed by
the owner or a trusted operator, and must be logged in the pilot record without copying
personal data into the log.

### 4.2 Legal and privacy (2.5)

- [ ] Participants receive a short notice: what is collected, why, who can see it, how long
      it is kept, and how to ask for deletion.
- [ ] The owner confirms the lawful basis for processing absence evidence and, if OCR is
      enabled, that the chosen provider is acceptable. The default `pdf-text` reader runs
      locally on the uploaded PDF; no third-party OCR provider is configured.
- [ ] The owner confirms that Supabase and Google are acceptable processors for this pilot.
- [ ] Participants know that a class admin and platform admin can read class content, and
      that the developer console is limited to an allowlisted operator.
- [ ] Real medical details are not required. Students may file an absence request with the
      minimum information the class admin needs.
- [ ] Minors, if any, are handled according to campus policy before accounts are invited.

### 4.3 Observability (2.6)

- [ ] Name the person who reads the logs daily and the person who receives an incident
      report.
- [ ] Decide which signals matter: Vercel function errors, Supabase auth errors, cron
      results, notification failures, and user reports. There is no Sentry/OTel integration.
- [ ] Decide who is on the `DEVELOPER_EMAILS` allowlist. An empty or malformed list means
      nobody can open `/developer`.
- [ ] Set a response expectation for the pilot, for example: P0 acknowledged within one
      hour, P1 within one business day.
- [ ] Confirm that no one will paste request bodies, tokens, evidence, or emails into a
      ticket. Aggregate counts and correlation ids only.

### 4.4 Scope switches

Record one line per switch:

| Switch                  | Recommended for a closed pilot | Effect if enabled                                                |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Web Push reminders      | Off until tested               | Requires VAPID keys, service-role key, and a cron source         |
| Publish notifications   | Off until tested               | Requires the same push configuration                             |
| Google Calendar sync    | Off                            | Requires a second OAuth client and encryption key                |
| OCR extraction          | Optional                       | Local PDF text layer only; scans are not read                    |
| Public class directory  | Accept                         | The class name is publicly listed; joining still needs an invite |
| Open join by class name | Off                            | Keep `join_policy = 'invitation'`                                |

## 5. Launch

1. Confirm the deployment, database, and sign-in work on the pilot origin.
2. Send participants the invitation link, the sign-in instruction, and the feedback
   channel. Do not post the invitation link in a public group.
3. Ask each participant to complete sign-in and accept the invitation before the first
   real deadline. Track who has not joined using aggregate counts, not a public list.
4. Publish the first real assignment only after the class admin has completed the dry run.
5. Start the daily check in §7 on launch day, not the day after.

## 6. Pilot smoke test

Run this after [DEPLOYMENT.md](./DEPLOYMENT.md) §6, with a class admin account and a
student account that is not a class admin.

1. Student opens the invitation link, signs in with Google, finishes onboarding, and lands
   in the class. The membership row exists once, and no class admin role was granted.
2. Student submits an assignment. It stays out of the member feed until reviewed.
3. Class admin rejects it with a reason, the student corrects it, and the admin approves
   and publishes it. The published post appears to members, and the public assignment
   routes still require a session.
4. Class admin creates a session with capacity, student RSVPs, and a second account cannot
   take the last seat after it fills.
5. If check-in is enabled: a member checks in inside the radius, a member outside the
   radius is refused, and the organizer records one manual override that appears in the
   audit trail. The raw coordinates are not visible in the client.
6. Student files an absence request with a clearly fake PDF, confirms the OCR fields (if
   enabled), and the class admin returns it once for correction and then forwards it. The
   downloaded PDF opens and shows the `LR-…` reference.
7. If push is enabled: enable a device on the student account, publish a post, and confirm
   exactly one notification arrives and opens the post. Run the cron route twice and
   confirm the ledger does not duplicate a reminder.
8. Sign out and confirm protected routes redirect to `/login?next=…`. Sign in as a second
   account and confirm it cannot read or mutate the first account's pending content.
9. Open `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and `/sw.js` on the pilot
   origin. Confirm security headers are present.
10. Confirm the cron routes return `401` without the bearer token.

## 7. Daily operations

A ten-minute check is enough when nothing is on fire.

| Check                 | Source                                             | Healthy signal                                          |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Deployment health     | Vercel deployment and function logs                | No new 5xx burst; the serving commit is the pilot tag   |
| Sign-in               | Supabase auth logs and `/developer` if allowlisted | No repeated `callback_failed`; failures are isolated    |
| Database              | Supabase database health and slow queries          | No sustained CPU, disk, or connection pressure          |
| Cron (if enabled)     | Scheduler history and route logs                   | Expected runs, `200`, no growing retry backlog          |
| Notifications (if on) | `notification_deliveries` aggregate counts         | Failures are marginal and not repeating by category     |
| Backups               | Supabase plan and backup status                    | A recent backup exists; restore procedure is known      |
| Feedback              | Agreed channel                                     | Every report is triaged into the evidence ledger        |
| Privacy spot-check    | Tickets, logs reviewed that day                    | No PII pasted; if found, report location, not the value |

Weekly, review the same signals as trends rather than single points, and update
[PILOT_MEASUREMENT.md](./PILOT_MEASUREMENT.md) with the week's evidence.

## 8. Incident handling

### 8.1 Severity

| Severity | Definition                                                                       | Response                                                        |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| P0       | Suspected data breach, cross-class access, auth bypass, or confirmed data loss   | Stop the pilot, preserve evidence, notify the owner immediately |
| P1       | A core flow is broken for everyone (sign-in, publish, submit, forward, check-in) | Fix or roll back the same day; tell participants what to do     |
| P2       | A flow is broken for some users or has a safe workaround                         | Queue for the next fix window; document the workaround          |
| P3       | Cosmetic, copy, or minor usability issue                                         | Backlog; do not interrupt the pilot                             |

### 8.2 First actions

1. Record the time, the affected flow, and the observed symptom. Do not copy personal data
   into the incident log.
2. Reproduce with a disposable account if the issue is not clearly data-related.
3. For authorization or exposure doubts, treat it as P0 and stop writes before
   investigating.
4. Preserve logs and the deployment identity. Do not delete rows or rotate secrets until
   the owner agrees, except when rotation is needed to stop ongoing exposure.
5. Roll back the application with the previous Vercel deployment when a recent release is
   the likely cause. Database rollback is slower and can lose data; see
   [DEPLOYMENT.md](./DEPLOYMENT.md) §8.
6. After the pilot, write a short post-incident note: trigger, impact, what was exposed,
   what changed, and what remains open. Never include the exposed values themselves.

### 8.3 Secret or session exposure

Rotate the affected value in the hosting environment and redeploy. Rotating a secret
invalidates the old value; it does not repair data that was already exposed.

| Value                         | What rotation affects                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`   | Cron, attachment removal, calendar sync, developer console     |
| `CRON_SECRET`                 | Every scheduler call; update the scheduler in the same step    |
| Google OAuth client secret    | Sign-in and, separately, calendar sync                         |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Stored calendar tokens become unreadable; users must reconnect |
| `VAPID_PRIVATE_KEY`           | Existing push subscriptions stop receiving; users re-enable    |
| `RATE_LIMIT_SALT`             | Rate-limit buckets reset for the current window                |
| Supabase JWT secret           | Every session is invalidated; everyone signs in again          |

For a compromised account, remove its class membership and calendar connection, then
rotate only what the investigation shows was exposed. The repository has no account
suspension UI; removing rows is a manual, owner-approved operation.

### 8.4 Stop conditions

Stop the pilot and move to read-only or offline class communication if any of these occur:

- Confirmed or strongly suspected cross-class disclosure or an authorization bypass.
- A secret is exposed in a place that can be read by participants or the public.
- Data loss that cannot be reconstructed from backups within the pilot window.
- A core workflow is unusable for more than one class day with no workaround.

## 9. Data handling during the pilot

- Use synthetic content for smoke tests: fake names, fake deadlines, fake PDFs.
- Collect the minimum real data needed. Do not ask students to upload more evidence than
  the class admin needs to forward an absence request.
- Do not put screenshots with names, emails, student IDs, evidence, or chat content into
  tickets, reports, or documentation. Redact before sharing.
- Do not send private data to analytics, session replay, or third-party OCR. None is
  integrated, and the pilot does not add one.
- Exports stay with the class admin and are deleted after forwarding, unless the owner's
  retention decision says otherwise.
- If a participant asks for deletion, the owner handles it manually and records that it was
  done, without keeping a copy of the deleted content.
- At pilot exit, remove test rows and invitations, disconnect calendar tokens, and delete
  evidence according to the retention decision. Audit logs stay unless the owner decides
  otherwise.

## 10. Limitations to disclose

Tell participants these before they rely on the product:

- Push notifications are Web Push only. On iPhone and iPad the site must be added to the
  Home Screen first; Safari alone cannot receive them.
- OCR reads only the text layer of a PDF. A scan is accepted but not read.
- Check-in coordinates come from the browser and can be spoofed. A check-in is evidence of
  proximity, not proof of attendance; a suspicious record is a conversation, not a sanction.
- Student ID and university are self-declared and not verified.
- There is no account suspension UI.
- There is no error-tracking integration; failures are diagnosed from platform logs.
- There is no automatic retention job for evidence, check-in coordinates, or the
  notification ledger.
- Pending class attachments are readable by every class admin of that class. Reviewer
  assignment is not modelled.

## 11. Exit

The owner decides **continue**, **fix and repeat**, or **stop** using the scorecard in
[PILOT_MEASUREMENT.md](./PILOT_MEASUREMENT.md) §7. Before announcing the outcome:

- [ ] Export aggregate metrics and attach the evidence ledger.
- [ ] Run the exit survey and record the response count.
- [ ] Revoke outstanding invitation links.
- [ ] Remove test data and, per the retention decision, pilot evidence.
- [ ] Disconnect calendar tokens and remove push devices that belong to test accounts.
- [ ] Record open P0/P1 items, or confirm there are none.
- [ ] Record which limitations in §10 remain true.
- [ ] Store the pilot record somewhere the owner controls, without personal data.

## 12. Sign-off

| Item                                  | Owner | Date |
| ------------------------------------- | ----- | ---- |
| Scope and cohort fixed                |       |      |
| Retention decision (2.4) recorded     |       |      |
| Legal/privacy decision (2.5) recorded |       |      |
| Observability decision (2.6) recorded |       |      |
| Release commit tagged and deployed    |       |      |
| Dry run passed                        |       |      |
| Participants notified and invited     |       |      |
| Pilot launched                        |       |      |
| Pilot exit decision recorded          |       |      |
