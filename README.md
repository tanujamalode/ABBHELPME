# ABB HELP ME

Employee wellbeing app: peer support, personalised content, wellbeing tools and anonymous feedback in one place.
React Native + Expo SDK 58 + TypeScript + Expo Router, with **Supabase** (Postgres, Auth, Storage) as the only backend.
There is no mock or sample data: everything a person sees is stored in Supabase.

## 1. Set up the backend (once)

1. Create a project at <https://supabase.com>.
2. **SQL Editor** → paste all of [`supabase/setup.sql`](supabase/setup.sql) → **Run**. It creates every table, the security rules, triggers, functions, the private `post-images` bucket and the starter communities and resources. It is safe to run again.
3. **Authentication → Providers → Email**: enabled, **Email OTP length 6**. **Anonymous sign-ins: off.**
4. **Authentication → Emails (templates)**: in *Magic Link* **and** *Confirm signup*, show the code with `{{ .Token }}` (otherwise people get a link, not a code).
5. **Authentication → SMTP**: add a custom SMTP provider. **This is required for real testers.** Supabase's built-in mailer only sends a few emails an hour and only to your own team's addresses.
6. **Project Settings → API**: copy the *Project URL* and the *anon public* key. Never put the `service_role` key in the app (a test fails the build if it appears).
7. In this folder: copy `.env.example` to `.env` and fill in the two values.

```bash
npm install
npx expo start -c          # scan the QR code with Expo Go (iPhone: use the Camera app)
```

Expo Go is enough: nothing in the app needs a custom native build, as long as your Expo Go version supports SDK 58. If the phone can't connect, use `npx expo start --tunnel`.

### Who can sign in
Only Outlook / Hotmail / Live / MSN and `abb.com` addresses (`src/lib/emailPolicy.ts`). The same list is enforced in the database by `is_member()` in `setup.sql`, so it cannot be bypassed from the app. To change it, edit both places (a unit test fails if they drift apart).

### Content you manage in the Supabase dashboard
- `resources`: edit titles, add real phone / link / email, tick `verified` and set `reviewed_at` and `source` (`ABB` or `External`) once ABB approves. They are shown with their review date and source.
- `communities`: add or reorder communities. `community_leaders`: add `(community_id, user_id)` rows so a leader's posts carry a badge.
- `chat_reports` and `reports`: moderation queues (people cannot read them back).

## 2. What is in the app

| Area | What it does |
| --- | --- |
| Sign-in | Emailed 6-digit code, no password. Profile (role, experience) saved with the account. Optional device lock (Face ID / fingerprint). |
| 7-category onboarding | Mental wellbeing, Workplace concerns, Relationships and communication, Career growth, Team and collaboration, Personal wellbeing, Workplace questions. Drives the **For you** feed, resource suggestions and people matching. |
| Home | Cappy check-in, quick actions, unread messages and notifications, suggested resources, trending questions, shortcuts to every feature. |
| Community | Questions, discussions, ideas, polls, achievements, personal support posts, photos. Voting (downvotes need a reason), accepted answers, reports, search, For you / newest / most helpful. |
| Communities | Follow or unfollow, member counts, trending, leader badges. |
| People who understand + Messages | Opt-in discovery by role, experience and interests. 1-to-1 chat under made-up names, accept or decline, reveal identity later, mute, report, block, leave, save a conversation. |
| Meditate and breathe | 1, 3, 5 or 10 minutes. Breathing patterns (4-4-6, box, 4-7-8, 5-5), animated circle, rain / forest / ocean sounds, a sleep mode that dims and fades, saved sessions, practice tracker. |
| Micro-breaks | Eye reset, stretching, breathing, movement, walking, water. Optional gentle reminders (on the phone). |
| Wellbeing Pulse | Daily check-in with factors; weekly and monthly trends; what goes with harder or brighter days (workload, sleep, team). Anonymous colleague pulse shown only when at least 5 people took part. |
| My Wellbeing Journey | Check-in history, meditation minutes, completed resets, saves, followed categories and communities, important conversations, badges. |
| Recognition | Shout-outs with badges, anonymous or named, and a wall of the ones recipients chose to share. No leaderboards. |
| Feedback to ABB | Anonymous, by category, with a monthly report (categories with fewer than 3 submissions are hidden). |
| Resources | Searchable, bookmarkable, with source (ABB / External), verified flag and last review date. |
| Cappy | Offline guide that points to resources and opens the right screen (breathing, people, recognition, feedback...). It is a keyword guide, not an AI, and sends nothing anywhere. |

## 3. Security and privacy model

- **Every request carries the user's JWT.** Row-level security is on for every table; signed-out callers get nothing.
- **Anonymous means anonymous.** Posts, comments and shout-outs are read through views that never expose `user_id`. Colleagues cannot tell which account wrote something, even by querying the API.
- **Private to you:** mood check-ins, saved items, votes, notifications, sessions, profile. Aggregates (colleague pulse, feedback report, community stats) use `security definer` functions that hide small groups (k-anonymity: 3 for counts, 5 for pulse).
- **Chat** tables are closed to the API. People act through functions that enforce who may do what; nobody ever sees the other person's account id or email. Discovery returns opaque codes.
- **Feedback** rows hold no account id. A separate throttle table (account + day, no content) limits spam, so a row cannot be tied to a person.
- **Abuse limits:** per-user hourly caps on posts, comments, messages and check-ins; 3 reports hide a post; 3 reports on a person remove them from discovery; votes on your own content are rejected by the database.
- **Shout-outs by email** answer the same way whether or not the address belongs to a colleague, so addresses cannot be probed.
- **Photos** go to a private bucket, resized and re-saved on the phone (which normally drops location metadata), and are shown through short-lived signed URLs. Only the owner can write to their folder.
- **On the phone:** the session lives in the OS keystore; content is checked on the device before posting or sending (personal details, confidential words, personal attacks) and nothing is sent anywhere for that check.
- **Honest limits:** people who administer the Supabase project can technically read stored data, including mood check-ins. Content checks run on the phone only (no server-side moderation yet). This needs ABB privacy, security and legal review before wide use.

## 4. Checks

```bash
npm run typecheck   # tsc
npm run lint        # eslint (expo config)
npm test            # jest: logic, personalisation, wellness maths, reminders, architecture rules
npm run test:db     # runs setup.sql on a real Postgres engine (PGlite) and checks the security rules as different users
npx expo-doctor     # dependency health
```

## 5. Code map

- `src/app/` Expo Router screens. `_layout.tsx` gates navigation on the session (`Stack.Protected`); every signed-in screen is registered there.
- `src/data/repository.ts` the single interface the UI uses for data. `supabaseRepository.ts` implements it; `memoryRepository.ts` is the in-memory reference used by unit tests.
- `src/data/supabaseClient.ts`, `auth.ts` the Supabase client (session in the keystore) and the email-code sign-in. The architecture test fails the build if network code appears anywhere else.
- `src/state/AppProvider.tsx` session, profile, lock and reminders.
- `src/lib/` pure logic: personalisation, wellness (breathing, micro-breaks, progress), pulse, reminders, recognition, moderation, assistant.
- `supabase/setup.sql` the whole database. `supabase/tests/policies.mjs` its security tests.
- `assets/capy/` the Cappy poses: transparent WebP cut-outs (800 px) of the renders in `assets/capy-source/`. To change one, drop a new render into `capy-source` and redo the cut-out; `src/components/Capy.tsx` lists the poses and their aspect ratios.
- `assets/sounds/` the rain, forest and ocean loops. They are generated, seamless WAV files; replace them with recorded audio of the same names if you prefer.

## 6. Known limitations

- Not yet tried on a physical phone against a live Supabase project by the author: run through sign-up, post, chat (two accounts), a poll with a photo, and a session before inviting testers. `docs/USER_FLOW.md` is the test script.
- Push notifications are not used. Replies and shout-outs appear in the in-app inbox and unread dots (refreshed every 30 seconds and when screens open); chat messages arrive by checking every 4 seconds while a conversation is open. Reminders are local notifications scheduled on the phone.
- Ambient sounds are synthesised placeholders for real recordings.
- The ABB logo (`assets/images/abb-logo.svg`) is traced from a reference image; replace it with the official asset before release. Cappy has no dedicated image for the `happy` and `glasses` poses, so they reuse the excited and glasses renders.
- Resource text is general guidance until ABB approves content and contacts (nothing is invented: contact fields stay empty and are marked unverified).
- Professional help in chat is a pointer to the EAP resource; there is no live professional connection.
