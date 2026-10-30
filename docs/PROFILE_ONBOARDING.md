# Profile onboarding & class auto-matching

A Google sign-in proves who someone is; it does not tell StarsTask which student they are.
Onboarding collects the minimum identity a class workflow needs, keeps the sensitive parts
private, and tries to place the student in the class they typed.

- **Route:** `/onboarding` in the `(onboarding)` route group (outside the workspace chrome).
- **Save endpoint:** `POST /api/profile/onboarding` (multipart form data).
- **Migration:** `supabase/migrations/20261029002700_profile_onboarding.sql`.
- **Shared rules:** `packages/contracts/src/profile.ts`.

## 1. What is collected

| Field      | Required | Stored as                      | Visibility                                            |
| ---------- | -------- | ------------------------------ | ----------------------------------------------------- |
| Photo      | no       | `profiles.avatar_url`          | Public; Google photo by default, replacement optional |
| Full name  | yes      | `profiles.full_name`           | Private: no client column grant                       |
| Nickname   | yes      | `profiles.display_name`        | Public: replaces the legal name on public surfaces    |
| NIM        | yes      | `profiles.nim`                 | Private: no client column grant; masked if shown      |
| University | yes      | `profiles.university`          | Free text, collected but **not verified**             |
| Class      | no       | `profiles.declared_class_name` | Stored as typed, matched separately                   |

The nickname is written into the existing `display_name`, so assignment authors, class
listings, reviews, and the account menu keep working unchanged and show the nickname rather
than the legal name.

### NIM handling

- Stored as `text`, so `0012345` keeps its leading zeros.
- Constraint: `^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$` (deliberately not university-specific).
- Unique across the whole table through `profiles_nim_unique`, an index on
  `lower(btrim(nim))` that skips profiles without a NIM. A second account cannot claim an
  existing NIM; the API answers `409 nim_taken` with a `nim` field error. The database is
  the source of truth, so two simultaneous saves cannot both succeed. Migration
  `20261029003100_profile_nim_unique.sql` refuses to apply while duplicates exist; correct
  the wrong profile by hand first, never by deleting rows.
- No `SELECT` or `UPDATE` grant to `anon` or `authenticated`. PostgREST cannot read it, and a
  client cannot write it; the owner reaches it through `get_my_profile` /
  `update_my_profile` only.
- `maskNim()` renders `********0767`: the last four characters stay visible only when the
  value is at least eight characters long; shorter values are masked completely.
- Never put the NIM in a URL, a public API payload, a log line, an analytics event, a
  notification body, an error message, or a CSV/PDF export. If a future surface genuinely
  needs it, show the masked form unless the requester is the owner.

## 2. Completeness gate

`profiles.onboarded_at` is the single source of truth. `NULL` means incomplete.

- `/auth/callback` and `/login` redirect an incomplete profile to
  `/onboarding?next=<sanitized path>`.
- `(workspace)/layout.tsx` repeats the check server-side on every request, so direct URLs
  cannot bypass onboarding.
- `/onboarding` is outside that layout, so the redirect cannot loop. A complete profile is
  sent straight to `next`.
- A missing profile row is **not** treated as incomplete; that is a trigger/setup problem and
  redirecting would dead-end.

Identity always comes from the verified server session (`auth.getUser()`), never from local
storage, client state, or query parameters. The `next` value passes through
`safeRedirectPath()`, so onboarding cannot become an open redirect.

## 3. Class matching

Matching exists because a student should not have to hunt for an invite link to the class
they are already sitting in. It resolves the typed text against registered classes.

### Normalization

One rule, implemented twice and kept in sync: SQL `normalize_class_key(text)` and TypeScript
`normalizeClassKey(value)`.

1. Lowercase.
2. Remove every character that is not `a-z` or `0-9`.

```text
'IF-24-01'  -> 'if2401'
' if-24-01' -> 'if2401'
'IF 24 01'  -> 'if2401'
'IF_24_01'  -> 'if2401'
'IF-24-1'   -> 'if241'    (different class)
'IF-24-02'  -> 'if2402'   (different class)
' --- '     -> NULL       (nothing to match)
```

A class matches when either its `slug` or its `name` normalizes to the same key. Only
`status = 'active'` classes are considered.

### Outcomes

`join_class_by_name(p_class_name)` returns one of:

| Result              | Meaning                                                          | Membership |
| ------------------- | ---------------------------------------------------------------- | ---------- |
| `joined`            | Exactly one active match, `join_policy = 'open'`                 | Created    |
| `already_member`    | The caller is already in that class                              | Unchanged  |
| `blocked_by_policy` | Exactly one match, but the class is invitation-only              | None       |
| `ambiguous`         | More than one active match; candidates returned, no class chosen | None       |
| `no_match`          | Zero matches, or the input normalized to nothing                 | None       |

Order of checks inside the function: normalize → find active matches → return `no_match` →
return `ambiguous` → existing membership → `join_policy` → insert.

- `already_member` is checked **before** the policy so a retry is a harmless no-op.
- The insert is `on conflict (class_id, user_id) do nothing`; the primary key is the
  duplicate guard.
- A successful insert uses `joined_via = 'name_match'` and records
  `class_member_joined_by_name` in `audit_logs`.
- The function never writes `class_admins`. A match cannot grant a role, and it cannot bypass
  invitation, approval, or access rules — it only creates ordinary membership in `open`
  classes.

### Enabling auto-join for a class

Every class defaults to `join_policy = 'invitation'`, so existing behaviour is unchanged.
Opt in per class with SQL (there is no admin UI yet):

```sql
update public.classes
set
  join_policy = 'open'
where
  slug = 'if-24-01';
```

Only do this for classes where any verified student may join by name. Private or
approval-based classes must stay `'invitation'`.

## 4. Save flow

```text
POST /api/profile/onboarding (multipart)
  ├─ session?              no → 401
  ├─ rate limit            20 / 5 min per user
  ├─ content-length        > 2 MB + 64 KB → 413
  ├─ Zod parse             → 422 with fieldErrors
  ├─ optional avatar       validate bytes (PNG/JPEG, ≤2 MB, signature) → upload
  ├─ update_my_profile     validate again, write, set onboarded_at once
  └─ join_class_by_name    only when a class was typed
```

The profile is written before the class attempt: an unmatched or blocked class must not cost
the student the rest of their answers. The typed text is always persisted in
`declared_class_name`, so nothing is lost and nothing is fabricated.

The avatar is uploaded to the public `avatars` bucket under `{user_id}/{uuid}.{ext}`, then
`set_my_avatar_url` points the profile at it. If the pointer update fails, the uploaded
object is removed so no orphan remains. The file is validated server-side by extension and
magic bytes; the browser's declared MIME type is ignored.

## 5. UI states

The form shows: loading while saving, per-field validation errors, a saving button state, a
success panel, and one class result — joined, already a member, no match, ambiguous, or
blocked by policy. Session expiry, network failure, and database failure surface as a
retryable message. A profile can be complete without a class; the result says so plainly
rather than implying membership.

## 6. Manual setup

1. Apply the migration: `supabase db push` (or run the SQL file).
2. No bucket creation is needed; the migration inserts `avatars`.
3. Set `join_policy = 'open'` only on classes that should be auto-joinable.
4. Existing users have `onboarded_at = NULL` and will be asked to complete onboarding on
   their next visit. That is intentional.

## 7. Verification queries

```sql
-- Private columns must not be granted to clients.
select
  grantee,
  privilege_type,
  column_name
from
  information_schema.column_privileges
where
  table_schema = 'public'
  and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by
  grantee,
  column_name;

-- expect full_name and nim to be absent
-- Matching works and does not over-merge.
select
  public.normalize_class_key ('IF-24-01'),
  public.normalize_class_key (' if-24-1 ');

-- Which classes may be joined by name?
select
  slug,
  name,
  join_policy
from
  public.classes
where
  join_policy = 'open';
```

## 8. Known limitations

- `join_policy` has no admin UI; changing it is a manual SQL step.
- University is free text and is not checked against a registry. Do not describe a profile as
  verified.
- A class-level match is by slug or name only. There is no fuzzy matching, so a typo lands in
  `no_match` rather than guessing.
- `normalizeClassKey` and `normalize_class_key` must be changed together; the unit tests pin
  the shared behaviour but cannot prove the two implementations agree.
