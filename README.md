# ABB HELP ME (frontend prototype)

Employee support and well-being app. React Native + Expo SDK 58 + TypeScript + Expo Router.
**Phase 1 (this repo): frontend, local-only.** A backend comes in a later phase.

See `docs/USER_FLOW.md` for the screen map and flow.
A concept pitch deck is in `docs/pitch/` (`.pptx` and `.pdf`).

## Run it (Windows / VS Code)

```bash
npm install            # delete node_modules first if one exists
npx expo start         # scan the QR code with Expo Go for a quick look
```

Expo Go **cannot** open the encrypted database (SQLCipher needs native code). To test real storage, make a development build:

```bash
npx expo prebuild
npx expo run:android   # needs Android Studio / an emulator or a USB-connected phone
```

The web preview (`npx expo start --web`) works for layout checks but uses an in-memory store (nothing is saved or encrypted).

## Checks

```bash
npm run typecheck   # tsc
npm run lint        # eslint (expo config)
npm test            # jest: 53 logic tests
```

## Architecture

- `src/app/` Expo Router screens. Auth/onboarding gating is done with `Stack.Protected` in `_layout.tsx`.
- `src/data/repository.ts` the **only** interface the UI uses for data. `SqliteRepository` (SQLCipher) is the app implementation; `MemoryRepository` is used by tests and the web preview. A future `ApiRepository` can replace them without UI changes.
- `src/data/db.ts` generates a random 256-bit key on first run, stores it in the OS keystore (`expo-secure-store`, this-device-only), and opens the database with `PRAGMA key`.
- `src/data/schema.ts` versioned, append-only migrations (`PRAGMA user_version`).
- `src/data/seed.ts` bundled **sample** posts, answers and resources. They are always flagged `sample` and never written to the user's tables.
- `src/data/resourceConfig.ts` where approved ABB contact details go (none are bundled).

## Shared community data (Supabase, optional)

Without the `.env` variables the app stays fully local and uses the demo sign-in (code 123456). To connect:

1. `.env`: set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
2. Supabase SQL editor: run `supabase/schema.sql`, then `supabase/002_email_auth.sql`.
3. **Authentication > Sign In / Providers**: Email on; **Anonymous sign-ins off**; Email OTP length **6**.
4. **Authentication > Emails**: in the *Magic Link* and *Confirm signup* templates, show the code with `{{ .Token }}` (otherwise users get a link, not a code).
5. Before real use, add custom SMTP (**Authentication > Emails > SMTP**); Supabase's built-in mailer only sends a few emails per hour.

**Sign-in.** Users register or log in with an Outlook / Hotmail / Live / MSN or `abb.com` email (`src/lib/emailPolicy.ts`). Supabase emails a 6-digit code; verifying it (`src/data/auth.ts`) creates a session whose JWT authorises every request. The session is kept in the device keystore and refreshed while the app is open. Row-level security (`is_member()` in `002_email_auth.sql`) enforces the same email rule on the server. Navigation (`src/app/_layout.tsx`) follows the session: sign-out or an expired session returns to the welcome screen. Role, experience and display name are saved with the account so a new device restores the profile; if a different account signs in on a shared device, the previous account's private data is removed first (`src/data/owner.ts`).

**Data.** `src/data/cloudRepository.ts` wraps the local repository. Work questions, achievements, answers, votes, accepted answers and reports go to Supabase (members read all, write only their own). Profile, personal notes, mood check-ins, bookmarks and preferences never leave the device. "Delete account and data" deletes the account, its shared content and this device's data (it needs a connection).

## What is deliberately NOT here

Push notifications, analytics, AI integration, and any cloud use outside `cloudRepository.ts` / `supabaseClient.ts` / `auth.ts`. A test fails the build if network APIs appear elsewhere or analytics/AI packages are added.

## Known limitations

- Prototype: needs ABB privacy, security, legal and support-process review before real employee use.
- Capy, the mascot: poses in `assets/capy/` are cut from the Capy character sheet (about 100–270 px per pose on the sheet, upscaled 2×), so they are soft on high-density screens. Replace any file with a high-resolution export of the same name; `src/components/Capy.tsx` lists the poses and `src/lib/capy.ts` holds Capy's lines.
- The ABB logo in `assets/images/abb-logo.svg` is traced from a reference image; swap in the official vector asset before release.
- Phase 1b community features are local-only: votes, accepted answers and the contribution score only reflect this device. Shared voting, real employee verification (`src/lib/verification.ts`) and server-side AI moderation (`ModerationService` in `src/lib/moderation.ts`) need the Phase 2 backend.
- Mock data (`src/constants/demo.ts`, `DEMO_MODE`): finishing onboarding seeds two weeks of mood check-ins, a few posts, answers, votes and bookmarks, and the UI labels it as sample data. Set `DEMO_MODE = false` for real use.
- "Verified email" means the person controls that inbox, not that they work at ABB: Outlook personal addresses are allowed too. Without Supabase configured, the code is a mock ("Verified · demo", always 123456).
- The Help Assistant (centre tab button) is an offline keyword matcher, not AI. A real AI service needs a backend and ABB privacy approval; plug it in via `AssistantEngine` in `src/lib/assistant.ts`.
- Resources are sample entries marked Unverified. No contact numbers (EAP, emergency) are invented.
- Notification preferences are stored but no reminders are delivered yet.
- Device unlock uses biometrics / device PIN when available; if the device has none enrolled, the local profile opens without a lock.
- UI has been type-checked, linted and bundled, but not yet visually checked on a device.
