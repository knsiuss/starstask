# Authentication — StarsTask

Google is the only provider. There is no password field, no OTP, and no email magic link
in the UI or the API.

## 1. Components

| Piece                | File                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Browser client       | `src/lib/supabase/client.ts` (`createBrowserClient`)                                             |
| Server client        | `src/lib/supabase/server.ts` (`createServerClient` + `next/headers` cookies)                     |
| Session refresh      | `src/lib/supabase/proxy.ts` + `src/proxy.ts`                                                     |
| OAuth callback       | `src/app/auth/callback/route.ts`                                                                 |
| Sign out             | `src/app/api/auth/signout/route.ts` (POST only)                                                  |
| Session read         | `src/lib/auth/session.ts` (`auth.getUser()` + profile)                                           |
| Redirect guard       | `src/lib/security/redirect.ts`                                                                   |
| Profile provisioning | `handle_new_user()` trigger in `20261029000200_functions.sql`                                    |
| Role checks          | `is_platform_admin`, `is_class_admin`, `is_class_member` in `20261029001100_class_functions.sql` |

## 2. Flow

```
/login?next=/submit
  │  safeRedirectPath("/submit")
  ▼
signInWithOAuth({ provider: "google",
                  redirectTo: "https://site/auth/callback?next=%2Fsubmit" })
  ▼
accounts.google.com  ──►  https://<project>.supabase.co/auth/v1/callback
  ▼
https://site/auth/callback?code=...&next=%2Fsubmit
  │  rate limit 30 / 5 min per IP
  │  provider error?  → /login?error=oauth_cancelled|callback_failed
  │  exchangeCodeForSession(code)   (PKCE verifier cookie)
  │  auth.getUser()  → confirm profile row exists
  ▼
redirect(nextPath)   // sanitized internal path
```

The `next` value is never trusted: `safeRedirectPath` rejects absolute URLs,
protocol-relative URLs, backslashes, control characters, values longer than 512 chars, and
anything under `/login` or `/auth`.

## 3. Session handling

- `proxy.ts` matches application routes (not static assets), calls `auth.getUser()`, and
  copies refreshed cookies onto the response. It never makes an authorization decision.
- Server Components and Route Handlers each call `getSessionUser()`, which calls
  `auth.getUser()`. This verifies the token with Supabase Auth; a forged cookie cannot
  become an identity.
- `getSessionUser()` is wrapped in React `cache`, so one request resolves the user once.
- Authorization is re-checked at the mutation: the data layer filters by `user_id` and RLS
  independently enforces the same rule.

Session expiry behaves like a signed-out visitor: protected pages redirect to `/login`
with the original path preserved; protected APIs return `401 unauthorized`.

## 4. Profile provisioning

`on_auth_user_created` fires after a row is inserted into `auth.users`:

```sql
insert into
  public.profiles (id, display_name, avatar_url)
values
  (
    new.id,
    left (v_display_name, 80),
    left (v_avatar_url, 2048)
  ) on conflict (id) do nothing;
```

- Display name falls back: `full_name` → `name` → email local-part → `StarsTask member`.
- Avatar must start with `https://`; otherwise it is stored as `NULL`.
- `security definer` with `search_path = ''` and fully qualified table names.
- No tokens, refresh tokens, or Google IDs are stored.
- Re-running it is harmless (`on conflict do nothing`).
- Deleting the auth user cascades the profile.

If the trigger is missing, sign-in still succeeds but `/auth/callback` logs
`[auth] profile missing after sign-in` and cards fall back to the default display name.

## 5. Sign out

`POST /api/auth/signout` calls `supabase.auth.signOut()`, clears the session cookies, and
redirects to `/`. `GET` returns `405` so a prefetch, image tag, or link cannot log a user
out.

## 5b. Roles after sign-in

Every Google account signs in as an ordinary user. Signing in never grants a
role.

- **Class Admin** is granted by a Platform Admin through `assign_class_admin` (or
  during application approval). It is always paired with membership.
- **Platform Admin** is seeded manually in `platform_admins`; there is no API or
  UI path. See [docs/CLASSES.md](./CLASSES.md#14-manual-setup).
- Invitation links grant membership only.

The session user's id comes from `auth.getUser()`; no role claim from the client
or from user metadata is trusted. Every role check reads the database predicates
under the caller's session.

## 6. Manual setup (not performed by this repository)

### Google Cloud

1. Create/select a project at <https://console.cloud.google.com>.
2. Configure the OAuth consent screen (External; app name, support email, developer email).
3. Create credentials → OAuth client ID → **Web application**.
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://<preview-domain>` (add per preview if you need OAuth there)
   - `https://<production-domain>`
5. Authorized redirect URI — exactly the Supabase callback, **not** the app callback:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
6. Copy the client ID and client secret.

### Supabase

1. Authentication → Providers → Google → enable.
2. Paste the client ID and secret.
3. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` locally, production origin in production.
   - Redirect URLs (wildcards are allowed):
     - `http://localhost:3000/auth/callback**`
     - `https://<production-domain>/auth/callback**`
     - `https://*-<team>.vercel.app/auth/callback**` if preview sign-in is required
4. Confirm the Google provider is the only enabled provider.

The `**` suffix matters: the app appends `?next=...` to the callback URL, so an exact
`/auth/callback` entry alone would be rejected.

### Local CLI

`supabase/config.toml` already wires Google through env substitution:

```bash
export SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
export SUPABASE_AUTH_GOOGLE_SECRET=...
supabase start
```

## 7. Error states

| Situation              | Behaviour                                                                   |
| ---------------------- | --------------------------------------------------------------------------- |
| User cancels on Google | `?error=oauth_cancelled` → friendly message, retry available                |
| Invalid/expired code   | `?error=callback_failed` → generic message, code only logged                |
| Provider error         | Same as above                                                               |
| Callback rate-limited  | `?error=rate_limited`                                                       |
| Supabase env missing   | Login page shows the setup notice; callback redirects with `not_configured` |
| Session expired        | Treated as signed out                                                       |
| Profile missing        | Sign-in succeeds, server logs a marker                                      |

No access token, refresh token, authorization code, or client secret is written to a URL
that the browser keeps, a log line, or a `NEXT_PUBLIC_` variable.

## 8. What has been verified

- Static and unit-level: redirect sanitization (15 tests), route compilation, build.
- Not verified: a live Google round-trip, because no Supabase project or Google client
  exists in this environment.
