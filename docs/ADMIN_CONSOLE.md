# Platform admin console — StarsTask

The platform console at `/admin` is the administrative surface for classes,
published assignments, and class representative verification. It is separate
from the Class Admin experience at `/dashboard/classes/[slug]`.

## 1. Routes

| Route                       | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `/admin`                    | Overview: counters, pending applications, verifications, audit |
| `/admin/users`              | Read-only registered-account directory                         |
| `/admin/applications`       | Class application list with status and name filters            |
| `/admin/applications/[id]`  | Application detail and platform decision                       |
| `/admin/classes`            | Class directory with member and admin aggregates               |
| `/admin/classes/[slug]`     | Class members, class admin assignment, status, audit           |
| `/admin/assignments`        | Class submissions with review/publication state                |
| `/admin/verifications`      | Class representative verification queue                        |
| `/admin/verifications/[id]` | Evidence, decision history, and review decision                |
| `/admin/reports`            | Reader-submitted assignment corrections                        |

There is no Sessions or Settings entry. Those pages do not exist, so the
navigation does not offer them.

## 2. Authorization

Every admin route is protected on the server in two places:

1. `app/(console)/admin/layout.tsx` requires a session and the Platform Admin
   role before rendering the console shell. The console lives in its own route
   group, separate from the student workspace.
2. Each page calls `requirePlatformAdmin()` from `src/lib/auth/admin.ts`. The
   helper redirects unauthenticated visitors through the normal login flow and
   returns 404 for signed-in non-admins.

The role comes from `public.is_platform_admin()`, a `SECURITY DEFINER` function
that reads `platform_admins` for `auth.uid()`. Navigation visibility is cosmetic
only. RLS still decides which rows the caller's own Supabase client can read,
and every mutation runs through the existing RPC or route handler that repeats
the check.

Platform Admin and Class Admin remain separate: a class admin does not gain
access to `/admin`, and a platform admin does not gain a class-scoped identity
outside the class-management functions.

## 3. Overview counters

`public.get_platform_admin_overview()` returns all counters in one round trip.
The labels in the UI state exactly what is counted:

| Counter               | Definition                                                     |
| --------------------- | -------------------------------------------------------------- |
| Registered users      | Rows in `profiles`, provisioned for a signed-up auth account   |
| Onboarded users       | Profiles with `onboarded_at` set                               |
| Platform admins       | Rows in `platform_admins` (never readable by clients directly) |
| Active classes        | Classes with `status = 'active'`                               |
| Archived classes      | Classes with `status = 'archived'`                             |
| Published assignments | Every assignment with `status = 'published'`                   |
| Unpublished/archived  | Assignments with `status in ('unpublished', 'archived')`       |
| Pending applications  | Class applications with `status = 'pending'`                   |
| Pending reviews       | Class submissions with `status = 'pending_review'`             |
| Pending verifications | Submitted verification requests with `status = 'pending'`      |

“Pending actions” is the sum of pending applications, pending verifications, and
pending class submissions. No number is cached or hardcoded, and no chart is
shown because the schema has no time-series event source that would make one
honest.

## 4. User directory

`/admin/users` lists safe profile fields only: public display name, avatar,
sign-up timestamp, onboarding completion, class membership counts, and whether
the account is a platform admin. `full_name` and `nim` are deliberately not
returned, matching the column grants in `20261029000300_rls.sql`.

The page is read-only. Platform Admin grants and account lifecycle changes are
trusted, audited operations outside this console; adding a button here would
imply a write path that does not exist.

Search, access filter, onboarding filter, and paging are validated by
`adminUsersQuerySchema`. Page size is capped at 50 and page numbers at 500.

## 5. Class and assignment management

The class directory calls `public.list_platform_classes()`, which returns one
page of classes with `member_count`, `admin_count`, and the class admins' public
display names. The aggregates run in the database so the app never loads every
membership row to count it.

Class management actions reuse the existing server-authorized functions:

- `assign_class_admin` / `revoke_class_admin`
- `set_class_status`
- member removal and metadata updates through the existing forms

Assignment management lists class-scoped assignments only and links to the
existing review page at
`/dashboard/classes/[slug]/review/[id]`. That page already accepts a platform
admin through `can_manage_class()`, so approval, rejection, unpublish, archive,
restore, and attachment removal use the same validated workflow instead of a
second moderation implementation.

## 6. Read models

Added by `supabase/migrations/20261029003000_platform_admin_queries.sql`:

| Function                      | Returns                                            |
| ----------------------------- | -------------------------------------------------- |
| `list_platform_users`         | Paginated safe profile fields and counts           |
| `list_platform_classes`       | Paginated classes with membership/admin aggregates |
| `get_platform_admin_overview` | One authoritative row of platform counters         |

All three are `SECURITY DEFINER`, pin `search_path`, re-check
`is_platform_admin()`, revoke `PUBLIC` execute, and grant execute only to
`authenticated`. They return no emails, tokens, legal names, student IDs, or
private submissions.

## 7. States and failure handling

- `admin/loading.tsx` renders the shell skeleton while a page queries.
- `admin/error.tsx` shows a retry action and a link back to the overview; it
  logs only the error digest, never query details.
- Invalid or hand-edited query parameters render a validation alert with a
  reset link instead of querying with bad input.
- Empty tables distinguish “no records yet” from “no records match these
  filters”.
- Mutations show their own pending, success, and error states in the existing
  client forms and refresh the affected route.

## 8. Required setup

Apply the migrations before using the console:

```bash
supabase db push
```

The overview depends on `20261029003000_platform_admin_queries.sql`. The class
and verification queues also require their earlier class migrations. A schema
that stops before those migrations makes the console's data queries fail; the
error boundary reports that the view could not load rather than showing zeroes.

The first platform admin must be seeded manually, as described in
`docs/CLASSES.md`.
