# ABB HELP ME — User Flow & Screen Map (Frontend Phase)

Scope: React Native (Expo SDK 57, Expo Router). Local-only data behind a repository
interface; a backend will replace the repository implementation in a later phase.

## 1. Entry flow
Launch -> [Profile exists?]
- No  -> S1 Welcome -> "Get Started" -> Create local profile: step 1 details (work email, display name, role, experience at ABB, optional device lock) -> step 2 one-time code sent to the work email (MOCK: fixed demo code 123456, 5-minute expiry, 3 tries, 30 s resend; the email is never stored) -> "Verified · demo" badge -> S2 Choose topics (at least 3) -> S3 Home
- Yes -> S1 Welcome (unlock) -> device auth / PIN -> S3 Home
S2 is shown only until at least 3 topics are saved; editable later in Profile & settings > Topic Preferences.

## 2. Navigation map
Bottom tabs: Home | Community | (Ask) | Resources | Well-being
- Ask: raised centre button -> Help Assistant (/assistant). Offline keyword matcher over bundled resources; urgent phrases show emergency guidance first. Chats are not saved.
- My Profile (/more) opens from the avatar on Home: identity card, three stat tiles (contribution, this week, posts), and a Settings menu (Account, Security & privacy incl. app lock, Notifications, Your activity, Support, sign out, delete data). Also reachable: Role & experience (/profile), Contribution (/contribution), Mood trends (/mood).
- Home: the header runs edge-to-edge from the top of the screen with a compact Capy check-in prompt; below it two stat tiles: this week's mood and the contribution score.
- Community: sort Most helpful | Newest. Every post and answer has an upvote and a downvote; a downvote asks for a reason first. The question's author can accept one answer.
- Compose and replies: on-device moderation check before saving; per-post "Show my role & experience" (on by default except personal posts).
- Home: quick actions -> Composer (Personal Support) / Composer (Work Problem|Question|HR|IT|Other)
        Trending preview -> Question Detail; Achievement preview -> Community (Achievements filter)
        "Need someone to talk to?" -> Resources > Support (leave-app confirmation)
        Search -> results over local resources + posts
- Community: filters All | Personal | Work | HR/IT | Achievements -> Question Detail; "+" -> Composer
- Resources: filters All | Policies | Support | FAQs -> resource row -> Resource Detail -> leave-app confirm
- Well-being: mood check-in (skippable) + resource categories
- More: Profile header, My Posts, Saved, Notifications, Topic Preferences, Insights (My recap),
        Privacy & Local Storage, Help & Support, Sign Out, Delete Local Data

## Mascot: Capy
Capy appears where the user acts or waits, and reacts to what they do:
- Welcome (laptop pose), sign-up (waves, then wears the outfit for the chosen role), topic picking (counts down, then cheers).
- Home hero card: line and pose depend on today's check-in (coffee/hi when none, cheerful, steady, or support on a low day).
- Well-being: reacts to the selected mood and again after saving; low moods offer support options.
- Centre tab button and chat: Capy's face; "thinking" while replying; support pose on urgent replies.
- Empty, loading and error states; celebration after posting; moderation review; contribution tier; profile (role outfit).
Voice rules: short, warm, never guilt about missed check-ins, never claims to be a person, counsellor or AI.

## 3. Screens (route -> purpose)
1. /welcome            Welcome + local sign in/unlock
2. /onboarding/topics  Pick at least 3 topics
3. /(tabs)/index       Home
4. /compose            Personal Support composer (also other categories via ?type=)
5. /(tabs)/community   Feed + filters incl. Achievements
6. /post/[id]          Work Question detail (+ sample verified answer)
7. /(tabs)/resources, /(tabs)/wellbeing   Resources + mood check-in
8. /assistant          Help Assistant (offline preview)
9. /(tabs)/more, /insights, /my-posts, /saved, /notifications, /topics, /privacy, /help

## 4. Key states per screen
Loading, empty, validation error, success confirmation, destructive-confirm (delete post, sign out, delete all data).

## 5. Truthfulness rules (shown in UI)
- Local posts: "On this device only". Seed content: "Sample content". Sample answers: "Sample verified answer — not reviewed by ABB HR/IT".
- Mood check-ins: not monitored, never trigger support. App is not monitored.
- External links/phone/mail: confirm before leaving the app.
- Recap: "Personal recap on this device." Any dashboard visuals: "Sample data".

## 6. Backend-ready seam
All data access via `src/data/repository.ts` (interface). Phase 2 adds `ApiRepository` implementing the same interface (auth, sync, moderation, aggregate reports) without UI changes.
