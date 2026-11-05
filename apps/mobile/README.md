# StarsTask Mobile (Capacitor)

PWA first, native via Capacitor. Same codebase as web, offline-first.

## Structure

- `src/` — mobile entry (reuse web API + Supabase)
- Offline check-in queue, push via Web Push, E2EE keys in IndexedDB

## Stack

- Capacitor 6 + Vite + TypeScript
- Supabase (same project as web)
- WebCrypto E2EE (same as DM web)

## Commands (dari root repo)

```bash
pnpm --filter @starstask/mobile dev
pnpm --filter @starstask/mobile build
pnpm --filter @starstask/mobile sync  # capacitor sync ios/android
```

## Android

```bash
cd apps/mobile
pnpm install            # dari root repo: pnpm install
pnpm build              # vite build -> dist/
npx cap add android     # pertama kali saja: generate folder android/
npx cap sync android    # setelah ubah web / plugin
npx cap open android    # buka di Android Studio, lalu Run / Build APK
```

Tanpa Android Studio / SDK, APK debug bisa dibuat langsung:

```bash
cd apps/mobile/android
./gradlew assembleDebug   # Windows: gradlew.bat assembleDebug
# hasil: android/app/build/outputs/apk/debug/app-debug.apk
```

Prasyarat: JDK 17+ dan Android SDK (platform + build-tools) terpasang;
`ANDROID_HOME` menunjuk ke folder SDK. Folder `android/` hasil generate
di-commit apa adanya (sesuai template Capacitor), jadi tidak perlu
`cap add` ulang di mesin lain — cukup `cap sync` setelah build web.

Push Android memakai `@capacitor/push-notifications` (FCM). Setup
`google-services.json` + Firebase project dilakukan manual di Android
Studio; tanpa itu push native belum aktif, Web Push PWA tetap jalan.

## iOS

```bash
cd apps/mobile
npx cap add ios
# copy ios/Info.plist.snippet.xml into ios/App/App/Info.plist
npx cap sync ios
open ios/App/App.xcworkspace
# Run di iPhone / simulator, deployment target iOS 15+
```

Push iOS butuh Apple Developer account ($99/tahun) buat TestFlight/App Store.
Tanpa itu, bisa jalan di simulator + sideload Xcode.

## Status

- Scaffolding only (2026-11-05). Fitur prioritas: check-in offline,
  dashboard ringan, notifikasi push.
