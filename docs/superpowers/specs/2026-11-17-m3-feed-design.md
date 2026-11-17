# Feed (Material 3, Stage 3): design

Branch: `m3-foundation-home`. This branch is never merged to main.

Prototype: `docs/design/m3/Prototype.dc.html`, the "Feed" tab, lines ~122-192, and its logic. Desktop: `DesktopPrototype.dc.html` ~121-152. The rationale is in the canvas notes `whyCatchup`, `catchupRevised` and `importantWhy`. The older `whyFeed` / M3Feed board is superseded.

## Intent

The Feed is how people catch up on what happened at the office without scrolling forever. Since your last visit, you see one post at a time. Anything waiting for an answer stays in "Still open" until you deal with it. After that you're done: "You're all caught up". Important announcements reach everyone once and are acknowledged. The app exists for employee welfare: no points, no streaks, no who-is-with-whom.

## Goals

1. **Rebuild `/feed`** in Material 3, wrapped in `m3 m3-page`.
   - **Hero.** The "feed" `PageHero` with the title "Feed". The subtitle is "{n} of {N} new since yesterday", or "Nothing new since yesterday". The tonal "Post" button opens the composer.
   - **Catch-up stack, phone.** It shows unread posts oldest first, one card at a time, with segmented progress above.
     - Back and Next buttons ("Previous post" / "Next post") and a "{i} / {N}" counter.
     - Swiping left goes to the next post and swiping right goes back, with a threshold of about 110px. A tap on a button inside a card never swipes.
     - The hint line reads "Swipe left for the next post, right to go back".
     - Reaching a card marks it seen.
   - **Desktop, ≥1100px.** There is no stack. The label "NEW SINCE YESTERDAY · N" is followed by every new post as a full card, then a "You're all caught up" separator.
   - **Caught up.** A check icon, then "You're all caught up". Below it, either "You've seen everything new. {n things are | 1 thing is} still waiting for an answer." or "You've seen and answered everything new. Older posts are below." An outlined "Start over" button replays today's posts.
   - **Still open.** Events you haven't answered that haven't started yet, and open polls you haven't voted in. Each has its inline action. A row leaves the list once answered. The empty state reads "Nothing waiting. Nice."
   - **Earlier.** Older posts as rows: title, kind and when. A row opens the full post in a sheet. Your own recent posts read "You gave kudos to X", "Your poll: …", "You shared a quote" or "You shared feedback". An acknowledged important announcement stays pinned here until its pin date, with "you've seen it".
   - **Nav badge.** Feed in the bottom bar and the sidebar shows the unread count.
2. **Post kinds as cards.** Each card has a kind chip, an author with an avatar (Lappy for system posts), the time, the title, the body and one inline action.
   - **Announcement:** "{Name} · Admin", plus "For everyone". No action.
   - **Event:** "I'm in", which toggles to "Going", with "{n} going". Counts only, no names.
   - **Poll:** two or more option buttons. Results are hidden until you vote ("Results show after you vote · closes {day}"). After voting the bars show percentages and "{n} votes".
   - **Kudos:** "Kudos to {To}" with "From {From}". Both names show (owner ruling). "Appreciate" toggles to "Appreciated". It maps to one existing reaction; counts only, never names.
   - **Quote / Feedback:** the text, with an optional "who said it".
   - **Birthday (system, Lappy):** "It's {Name}'s birthday", with "Send a wish", which opens the composer prefilled as kudos. The card never says where the person is (owner ruling).
   - **Photo posts** that already exist still render. New ones aren't offered.
3. **Composer** (bottom sheet; centred dialog on desktop): "New post", with four kinds.
   - **Kudos.** "Thank someone in public. No points." Fields: a "To" people picker (search; alphabetical, never ordered by who you thank most) and "What did they do?"
   - **Poll.** "Ask a quick question with options." Fields: "Your question", "Option 1" and "Option 2". The poll closes automatically after 3 days.
   - **Quote.** "Share a line that stuck with you." Fields: "The quote" and "Who said it? (optional)".
   - **Feedback.** "Public, with your name. For anonymous, use Speak up." Field: "Your feedback".
   - Footer: "Events and announcements are posted by admins." Buttons: Back / Post, with Post disabled until the form is valid.
4. **Important announcements.**
   - **Who sees it.** An admin can mark an announcement Important and give it a pinned-until date. Every member then sees it once, on any page, as a bottom sheet (a centred dialog on desktop): "IMPORTANT · {NAME}, ADMIN", the title, the body, and "Got it".
   - **Acknowledgement.** "Got it" is stored per person. The sheet never shows again for that person, and the announcement never enters the catch-up stack.
   - **Admin view.** Admins see "Seen by {n} of {total}" on the announcement in the admin area. It's a count, never a list of names.
5. **Seen tracking.**
   - Each person has a feed "seen up to" timestamp.
   - A post is new when it was created after that time and within the last 7 days. For someone who has never opened the Feed, the timestamp starts at the beginning of yesterday (IST).
   - Seeing a card moves the timestamp up to that card's creation time; it never moves back.
   - "Start over" only replays on the client and doesn't move the timestamp back.

## Non-goals and anti-goals

- No anonymous posts, photos or colours in the composer. Anonymous posting belongs in Speak up.
- No lists of who reacted or who RSVP'd: counts only.
- No birthday presence line, and no suggestions of whom to wish or thank.
- No RSVP close time. "Still open" uses the event start.
- No "See in Days" link from the important sheet. Nothing links an announcement to a closed day.

## Constraints

- Store changes go in `lib/types.ts`, `lib/jsonstore.ts`, `lib/pgstore.ts` and `tests/store/contract.ts`.
- No new dependencies. Swiping uses pointer events.
- Push must never carry grievance content. This stage only reuses the existing kudos push.
- Query hooks and mutations live in `lib/queries.ts`.

## Approaches considered (seen tracking)

- **A. One watermark per person (chosen).** Posts are shown oldest first, so "seen up to time T" is exact. It needs one column and one write per card.
- **B. A seen row per post per person.** It's precise but grows as people × posts, and nothing here needs more than the watermark.
- **C. Client-only (localStorage).** It's lost on another device, and the nav badge would disagree across devices.

## Decided parts of the how

**Store**

- `EmployeeRow.feedSeenAt: string | null`.
- `setFeedSeenAt(email, at)`, which only moves the timestamp forward.
- `AnnouncementRow` gains `important: boolean`, `authorName: string | null` and `pinnedUntil: string | null` (a date).
- `announcement_acks(announcement_id, email, at)`, with `ackAnnouncement(id, email)`, `listAckedAnnouncementIds(email)` and `countAnnouncementAcks(ids)`.

**Feed data**

- `feedFor` returns `seenAt`, `newIds` (oldest first, important announcements excluded) and `openItems`.
- Each post gets a `mine` flag computed on the server. Author emails are never sent.
- Poll results are hidden (`pct`/`votes` null) until the viewer has voted or the poll is closed.

**Routes**

| Route | Purpose |
|---|---|
| `POST /api/feed/seen {at}` | Moves the watermark forward |
| `GET /api/announcements/important` | Returns the oldest pinned, unacknowledged important announcement for the viewer |
| `POST /api/announcements/ack {id}` | Acknowledges it |

`POST /api/events` becomes admin-only. The admin announcement composer gains the Important toggle and the pinned-until date.

**Shell**

- The Feed nav item shows the unread count from a light `GET /api/feed?count=1` (or from `useFeed`).
- The important sheet is mounted once in the M3 shell.

## Left to the builder

- Component split under `components/feed/`.
- Exact card spacing from the prototype.
- How the swipe gesture is implemented.
- Loading and error copy, in Home's voice.
