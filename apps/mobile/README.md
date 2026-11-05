# StarsTask Mobile (Expo)

React Native (Expo) app sharing the same Supabase project as web.
Capacitor was removed (see `docs/ANDROID_PHASE0_AUDIT.md`); the shell
features were ported to native APIs:

- Auth: Google via system browser + PKCE deep link (`starstask://`)
- Check-in: GPS (`expo-location`) with offline queue (AsyncStorage)
- Push: FCM via `expo-notifications`, token → web API
- Attachments: document picker → Supabase Storage
- E2EE DM: not present in mobile yet (WebCrypto is unavailable in
  Hermes; a future port must reuse the web wire format)

## Commands (dari root repo)

```bash
pnpm --filter @starstask/mobile install
pnpm --filter @starstask/mobile start        # Expo dev server
pnpm --filter @starstask/mobile android      # dev build via EAS/local
```

Native builds go through EAS (`eas build`) once the project id in
`app.json` is set; `google-services.json` is referenced from app.json
for the Android FCM plugin.

## Status

Expo shell functional (2026-11-06): sign-in, dashboard, check-in,
offline queue, push registration, attachment upload. No E2EE chat,
no live updates (OTA is EAS Update, configured when the project id
exists), no automated tests yet.
