# ABB HELP ME: user flow and test script

Journey: **Connect → Ask → Share → Recharge → Improve**.

## 1. Entry
Launch → no session → **Welcome** → Get started / Log in → email → 6-digit code → (new account) profile: name, role, experience, device lock → **choose support categories (at least one of seven)** → Home.
Returning with a session: Welcome → Unlock (Face ID / fingerprint if the profile asks) → Home. Session expiry or sign-out returns to Welcome.

## 2. Navigation
Bottom tabs: **Home | Community | (Ask Cappy) | Resources | Well-being**.
- Home header: Messages (unread dot), Notifications (unread dot), profile avatar (→ My Profile).
- Home: Cappy hero, search, mood and contribution tiles, "How can we help you today?" (6 composers), **Connect, recharge, grow** (Messages, People who understand, Meditate, Micro-breaks, Recognition, Communities, My Journey, Feedback), Suggested for you, support card, trending, recognition.
- My Profile (`/more`): Connect, Recharge, Your activity (My posts, **My Saves**, Mood trends, Insights, Contribution), Settings (role, categories, app lock, notifications, privacy), Support, sign out, delete account.

## 3. Screens
| Route | Purpose |
| --- | --- |
| `/welcome`, `/onboarding/topics` | sign-in, profile, seven categories |
| `/(tabs)/community` | feed: For you / All / Personal / Work / HR-IT / Discussions & ideas / Polls / Achievements |
| `/compose` | question, discussion, idea, poll (2 to 6 options), achievement, personal support; community; up to 4 photos |
| `/post/[id]` | post, photos, poll, answers, votes, accept, save, report |
| `/communities`, `/communities/[id]` | follow, trending, community feed |
| `/people` | opt in to be found; matches by role, experience, interests; send a request |
| `/messages`, `/chat/[id]` | requests (accept / decline), conversations, unread; chat with mute, reveal, save, report, block, leave |
| `/meditate` | breathe / meditate / sleep, 1 to 10 min, patterns, sounds, saved sessions, practice tracker |
| `/microbreaks`, `/microbreak/[id]` | guided short resets |
| `/(tabs)/wellbeing`, `/mood` | check-in with factors, weekly and monthly trends, what shapes your days |
| `/journey` | My Wellbeing Journey |
| `/recognition` | give, received (badges), wall |
| `/feedback` | send anonymously; monthly report |
| `/(tabs)/resources`, `/resource/[id]` | search, filters, source, verified flag, review date |
| `/saved` | My Saves: posts, resources, sessions, conversations |
| `/insights` | personal recap, anonymous colleague pulse, community topics |
| `/notifications` | inbox (answers, accepted answers, shout-outs) and reminder settings |
| `/assistant` | Cappy: finds resources and opens the right screen; urgent phrases show emergency guidance first |

## 4. Manual test script (two accounts, A and B)
1. A signs up, picks categories, posts a question with a photo; B sees it in For you / All.
2. B answers; A gets a notification and an unread dot; A accepts; B is notified.
3. A posts a poll: A sees results at once; B sees "Vote to see the results", votes, then sees them.
4. Both turn on **Let colleagues find me**. A sends B a request; B accepts with role hidden; they chat; A reveals identity; B sees the name; B blocks A and the chat disappears for B.
5. A gives B a shout-out by email; B receives a notification, shares it to the wall.
6. Send three feedback items on one topic (a topic appears in the monthly report once it has at least 3 submissions).
7. A runs a 1-minute breathing session with rain sound and a micro-break; the Journey shows both.
8. A turns on hydration reminders; a notification arrives at the next scheduled hour.
9. A deletes the account; B can no longer see A's posts, and the chat is gone.

## 5. Truthfulness rules (shown in the UI)
- Posts say who sees them; names and emails are never shown.
- Mood check-ins are not monitored and never trigger an alert; colleague pulse is anonymous and hidden below 5 people.
- Peer chat is not professional help; the EAP resource is one tap away.
- Resources show source and last review date; unreviewed ones say so.
- External links, phone numbers and email open only after a confirmation.
- Cappy is not a person, counsellor or AI.
