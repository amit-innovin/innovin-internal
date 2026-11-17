# Account, Notifications, Wi-Fi and Steps: design (Material 3, Stage 5)

**Branch:** `m3-foundation-home`. It is never merged to main.

**Prototype:** `docs/design/m3/Prototype.dc.html` covers Account (~272), Steps (~287), Wi-Fi (~368) and Notifications (~454); `DesktopPrototype.dc.html` has the desktop versions.

**Canvas notes:** `plainAudit`, `speakWifiWhy`, `playWhy`, `metricsRule` and `heroes`.

## Owner rulings (18 Nov)

- **Steps league:** keep it as drawn (the "N steps to pass X" line and once-a-day Nudge buttons), but **opt-in**. People join and leave from Steps. Only people who joined are listed, and only they can nudge or be nudged.
- **Account:** keep it as drawn: Notification settings, Help and Sign out. Admins get one extra "Admin" row ("Opens the admin app").
  - Members no longer edit their birthday; admins enter birthdays.
  - The admin area becomes its own app with its own interface, in a later stage of its own. It is not part of this one.
- **Notifications:** only things that involve you. Nothing like "X gave Y kudos".

## Goals

### 1. Account (`/account`)

**Header.** The "account" PageHero shows your name and avatar, plus a chip "Usually in {Mon & Wed}". The chip is left out when you have no usual days.

**Rows** (a list card):
- **"Notification settings"** (subtitle "Tea round, events, kudos"). It opens a sheet with the existing push on/off switch.
  - There is one switch for everything, because per-category settings don't exist yet.
  - The sheet carries the line "Grievance updates are never sent as notifications."
- **"Help"** goes to `/help`.
- **"Admin"** (admins only) goes to `/admin`.
- **"Sign out"**, in red.

**Removed:** the office-days card (moved to Days), the birthday editor, Speak up, Wi-Fi, switch account, and the admin card.

### 2. Notifications (`/notifications`)

**Layout.** A plain screen: a back arrow on phones and the title "Notifications". It has no filters and no "Mark all read".

**Read state.** Opening the page marks everything read, using the existing cookie.

**Items** (icon, title, sub-line, a link to their screen):
- **Tea:** "Tea round closes at {close}", linking to Snacks. Shown only while you're checked in at the office, the current round is open, and you haven't answered.
- **Kudos:** "{From} gave you kudos", linking to Feed. Only kudos you received.
- **Events:** "{Name} posted an event", with the event title as the sub-line, linking to Feed.
- **Leave decisions:** "Your leave on {date} was {approved | rejected}", linking to Days.
- **Announcements and grievance replies:** kept as today. Grievance replies stay visible only on the device that sent the grievance.

### 3. Wi-Fi check (`/wifi`)

**Entry and layout.** Opened from Home's header button. A plain screen whose back arrow goes to Home.

**Intro:** "Tests the connection you're on right now: download, upload and delay. It takes about 10 seconds."

**Context line:** "You're checked in, so you can report a problem to admins." / "You're not checked in. The check still runs, but reports are for the office Wi-Fi only."

**Running** (about 8 seconds):
- The line "Testing download, upload and delay…".
- A catch-the-packets game: a 44px button that jumps every 800ms, with "{n} caught" announced to screen readers.
- The footnote "Just for fun. The test runs either way."

**Measurements:**
- **Download:** the existing fast.com path, falling back to our own payload.
- **Upload:** time a POST of a fixed payload to a new `/api/wifi/upload` sink.
- **Delay:** the median of 5 small requests.

**Verdict:**
- **Slow** when download is under 10 Mbps, upload is under 5 Mbps, or delay is over 150 ms. Otherwise **Good**. (These thresholds are my call.)
- Titles: "The connection is slow right now" / "The connection looks good".
- Body: "You caught {n} packets while you waited." plus the three numbers.

**Report** (when checked in and slow, or after tapping "Report anyway" on a good result):
- **Form:** area chips (Desk area / Meeting room / Pantry / Balcony), "Anything else? (optional)", and "Send report".
- **Not checked in and slow:** the form is replaced by "Check in to report office Wi-Fi problems."
- **Sent:** "Sent to admins with your result", "{n} other people reported slow Wi-Fi today" (a count only), and "Run again".

**Server.** `POST /api/wifi` requires a session and an office check-in today. The report row still stores **no identity**, as now. The area is stored in a new `area` field.

### 4. 10K steps (`/steps`)

**Today card:**
- "{n} / 10,000" with a progress bar.
- "Add steps from your phone's step counter", an input ("e.g. 2500") and an **Add** button.
- Add increases today's total; it doesn't replace it.
- At 10,000 or more, a Lappy card: "10,000 today" / "That's your goal for the day. Anything more is a bonus."

**"Last 7 days" chart.** Days with no steps count as 0. Solid bars mark days at or over 10K, and the label reads "Goal line: 10,000".

**Step league** (opt-in):
- **When you're in:**
  - A "Last 7 days" / "Today" toggle.
  - The line "{n} steps to pass {Name} this week" or "You're leading. Enjoy the view."
  - Rows: rank, avatar, name, steps, and a bar. Everyone except you has a Nudge button, which becomes Nudged.
  - The footnote "A nudge sends one friendly "time for a walk?" and only to people in the league, at most once a day each. You joined the league; leave it any time here." and a "Leave the league" button.
- **When you're out:** a card saying "See how your week compares with others who joined, and send a friendly nudge. Only people who join are listed, and you can leave any time." with a "Join the league" button.
- **Nudges:** each pair (sender → recipient) once a day.
  - The push reads "Time for a walk? {First name} nudged you."
  - Nudging is refused unless both people are in the league.
- **Home's steps tile** shows your league rank only when you're in the league.

## Non-goals and anti-goals

- No streaks, crowns or podiums. The current Steps page has them; they go.
- No per-category notification settings.
- No member birthday editing.
- No admin app in this stage.

## Constraints

- Every store change goes in both adapters and the contract tests.
- No new dependencies.
- Pushes never carry grievance content.

## Decided parts of the how

**Store:**
- `EmployeeRow.stepsLeague: boolean`, default **false**. Everyone starts out of the league; joining is explicit. Set it with `setStepsLeague(email, on)`.
- Nudges: `addNudge(date, from, to)`, which returns false if that nudge already exists. Table `nudges(date, from_email, to_email, PRIMARY KEY(date, from_email, to_email))`.
- `WifiRow.area: string | null`.

**Steps:**
- `POST /api/steps { add: n }` adds to today's total (1 to 50,000). `{ steps }` still sets the total, for older callers.
- `POST /api/steps/league { on }` joins or leaves.
- `POST /api/steps/nudge { email }`: 409 if already sent today, 403 unless both people are in the league.
- The league data in `lib/member-features.ts` lists only league members.

**Wi-Fi:** `/api/wifi/upload` (POST, discards the body) and `/api/wifi/ping` (GET, 204).

## Left to the builder

- How components are split.
- How the packet game moves.
- Exact chart drawing.
