# StarsTask Mobile — Kotlin (Native Android)

Status: Expo app removed 2026-11-06 (see `docs/ANDROID_PHASE0_AUDIT.md`).
Replacement: native Kotlin Android app, generated in Android Studio.

## Create the project (Android Studio)

1. New Project → **Empty Views Activity**
2. Name: `StarsTask`, Package: `id.starstask.mobile`
   (keep the old Capacitor package id — it is already registered in
   Firebase `google-services.json`)
3. Location: `apps/mobile` (use the existing folder; Studio creates
   `android/` — the Capacitor-era folder was deleted with Expo)
4. Language: **Kotlin**, Build language: **Kotlin DSL**
5. Minimum SDK: API 24 (matches the previous app)

## After generation

- Copy the existing `google-services.json` (kept locally, gitignored)
  into `android/app/` for FCM + Crashlytics.
- Add the Google OAuth redirect scheme `starstask://auth/callback`
  to the manifest activity.
- Backend is unchanged: same Supabase project, same RPCs
  (`check_in_attendance_meeting`, dashboard reads), same
  `POST /api/push/native-token` registration, same
  `native_push_tokens` table.
- E2EE DM is not ported yet — WebCrypto has no Kotlin equivalent;
  a future port needs a crypto library + security review.

## What was removed

- `apps/mobile` Expo app (app.json, app/, src/lib, android/, ios/)
- `@capacitor/*` and Expo dependencies from the workspace
- `starstask-preview.apk` (Expo preview build) stays local-only
