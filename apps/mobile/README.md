# StarsTask Mobile — Kotlin (Native Android)

Native Android app in Kotlin + Jetpack Compose. Backend unchanged:
same Supabase project, same RPCs, same `native_push_tokens` flow as
the previous Capacitor/Expo shells.

## Open in Android Studio

1. Open folder `apps/mobile/android` in Android Studio.
2. On first open, Studio offers to create the Gradle wrapper —
   accept (it generates `gradlew` + `gradle-wrapper.jar`).
3. Run on your device (Run ▶). Compose preview works for UI
   iteration without a device (split-pane preview in Studio).

## Supabase credentials

Copy `local.properties.example` logic: create `android/local.properties`
(gitignored) with:

```
starstask.supabase.url=https://<ref>.supabase.co
starstask.supabase.publishableKey=sb_publishable_...
```

Public anon key only — never the service role key.

Firebase: copy the existing `google-services.json` (kept outside git)
into `android/app/` for FCM + Crashlytics.

## Live preview (edit → langsung terlihat)

### 1. Compose Design Preview — tanpa device (paling cepat)

1. Buka file `.kt` di Android Studio, klik tab **Design** (kanan atas,
   di samping Code — split pane).
2. Preview me-render otomatis dan **refresh setiap kali Anda edit** —
   tidak perlu Run/build. Ada juga mode **Interactive** untuk klik
   tombol dan coba state langsung di panel preview.
3. Preview yang tersedia: `ui/theme/Theme.kt` (`ThemePreview`),
   `ui/screens/HomeScreen.kt` (`HomeComponentsPreview`,
   `StatCardTonesPreview`). Komponen yang butuh network (`HomeScreen`
   penuh) tidak di-preview — preview hanya untuk composable stateless
   (header, stat card, quick actions, dsb.).

### 2. Apply Changes — di device/emulator yang sedang jalan

1. Run app sekali dari Studio (Run ▶) ke device/emulator (adb sudah
   terpasang di SDK lokal).
2. Edit kode Compose, lalu klik **Apply Changes** di toolbar
   (atau `Run → Apply Changes`) — UI ter-update dalam hitungan detik
   tanpa rebuild penuh dan tanpa restart Activity.
3. Di Android Studio terbaru ada **Live Edit**: edit langsung saat app
   running, perubahan menempel tanpa restart sama sekali.

### 3. Yang tidak bisa hot-swap

Perubahan di luar Compose butuh build ulang normal: resource baru
(ikon, string), `AndroidManifest`, Gradle/dependencies, dan perubahan
logika non-UI. Untuk itu tetap pakai Run ▶ biasa.

## Status

Base project functional (2026-11-06): MainActivity + Compose theme
(mirroring web tokens) + Supabase client. Screens, Google OAuth,
GPS check-in, offline queue, push registration, and E2EE DM are
not ported yet — see `docs/ANDROID_PHASE0_AUDIT.md` for the plan.
