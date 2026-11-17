# Tea & snacks (Material 3, Stage 4) design

**Branch:** `m3-foundation-home`. It is never merged to main.

**Prototype:**
- `docs/design/m3/Prototype.dc.html`, the "Snacks" tab. Demo props `teaTime` and `snackState` switch between its states.
- `DesktopPrototype.dc.html`.
- `M3AdminSnacks.dc.html`, the admin board.

## Intent

Tea and snacks are for people in the office that day. They should take two taps and leave no social trace:
- Tea is the one non-anonymous thing, because the person making it needs a list.
- Snack picks and suggestions are anonymous.

## Goals

### 1. Rebuild `/snacks` in Material 3

The page is wrapped in `m3 m3-page`.

**Header:** the "snacks" PageHero, titled "Tea & snacks", with the subtitle "Everything here is anonymous except tea".

**When you're not checked in at the office:** a single gate card replaces tea and today's snacks.
- Heading: "Tea & snacks are for people in the office today"
- Line: "Check in on Home to book tea and pick a snack."
- A **Check in** button that goes to Home (owner ruling).

**Tea card:** the next round that's still relevant today.
- **Rounds:** morning at 11:00, with answers closing at 10:45, and afternoon at 4 PM, with answers closing at 3:30 PM. Admins can change both times.
- **Heading:** "Tea round at {time}"
- **Before the cut-off:**
  - "Yes, I'll have tea" and "Skip".
  - The line reads "Answer by {close}.", then "You're on the list." or "Skipping this round."
  - "Change answer" resets the round.
- **After the cut-off:** "Coming at {time}." if you said yes, otherwise "The {time} round is closed.", with no buttons.
- **Morning only:** a second line, "There's another round at 4 PM."
- **Lappy:** appears when you've said yes, as drawn.
- **Answers are per round** and stored on the server, including Skip.

**Today's snacks:**
- **Chip:** "Order goes in at {orderAt}". Admins set the time; the default is 12:00.
- **Line:** "Pick one for today. You can switch until the order goes in at {orderAt}. Nobody sees who picked what."
- **Rows:** a name, "{n} picks", and a bar relative to the leader.
- **One pick per person per day:**
  - The buttons read "Pick this", then "Switch to this".
  - Your choice shows as "Your pick", pressed. Tapping it again clears it.
- **After the order time, or once an admin marks today ordered:**
  - The chip reads "Order placed", and the line "Today's order is in. Picks open again tomorrow."
  - There are no pick buttons. Your pick shows as plain text.

**Suggestions for coming days:**
- These always show, even before check-in.
- Anonymous, with +1 toggles and a "Suggest a snack" field plus an Add button, as today.

**Desktop:** suggestions sit in a right-hand column at 1100px and wider. The rest is unchanged.

### 2. Home's tea row follows the current round

It shows the same time and states as the Snacks tea card.

### 3. Admin "Snacks & tea" page

The existing admin snacks page gains:
- **A "Times" card:** five time inputs (the two rounds, their two cut-offs, and the snack order time), plus "Save times". Saving is refused if a cut-off isn't before its round.
- **A "Today" card:**
  - Tea counts per round, with "Show names" revealing that round's names.
  - Snack pick counts.

## Non-goals and anti-goals

- No tea headcount shown to members.
- No names on snack picks or suggestions, for anyone, including admins.
- No tea or snack ordering for people working remote. The gate card replaces it.

## Constraints

- Every store change goes in both store adapters and in the contract tests.
- No new dependencies.
- Times are in IST. Cut-offs are enforced on the server.
- The server refuses a tea answer or snack pick unless the person has an office check-in for today: 403 with code `not-in-office`.

## Approaches considered

### Snack picks

- **A. A daily pick table, `snack_picks(date, voter_ref, item_id)`, one row per person per day (chosen).** Switching is an upsert, and the counts are per day. The existing vote table stays for suggestion +1s.
- **B. Reuse `snack_votes` with a date column.** This mixes two meanings (daily pick and suggestion +1) in one table, and the admin "ordered" reset clears both.

### Times

- **A. One `settings` row (key/value JSON) holding the times (chosen).** It is editable by admins without a deploy.
- **B. Environment variables.** These need a deploy for every change, and the owner asked for the time to be admin-set.

## Decided parts of the how

**Store:**
- `snack_picks(date text, voter_ref text, item_id text, PRIMARY KEY(date, voter_ref))`, with:
  - `setSnackPick(date, voterRef, itemId | null)`
  - `listSnackPicks(date)` → `{ itemId, voterRef }[]`. Voter refs never leave the server.
- `tea_rounds` gains a `round` column (`am`/`pm`) and `going` (a boolean, so Skip is stored):
  - `setTeaAnswer(date, round, email, going | null)`
  - `listTea(date)` → rows with round and going.
  - Existing rows read as round `pm` with going true. The old 4 PM round becomes the afternoon round.
- `settings(key text PRIMARY KEY, value jsonb)`, with `getSetting` and `setSetting`. The key `snackTea` holds `{ amAt, amClose, pmAt, pmClose, orderAt }`, defaulting to `11:00 / 10:45 / 16:00 / 15:30 / 12:00`.

**Pure rules** (`lib/snacks-rules.ts`), each unit-tested:
- `currentRound(now, times)` returns the round, whether it's open, and whether it's past.
- `pickOpen(now, times, orderedToday)`.
- `pickCounts`.

**Routes:**
- **`/api/tea`:**
  - GET → `{ round: { id, at, closesAt, open, past }, next: … | null, mine: true | false | null }`. Admins also get per-round counts and names.
  - POST `{ round, going: boolean | null }` → refused after the cut-off with 409 `closed`, and refused when not in the office with 403.
- **`/api/snacks`:**
  - GET adds `today: { open, orderAt, ordered, picks: { itemId, count }[], mine }`.
  - PATCH `{ id, action: "pick" | "unpick" }` follows the same gates.
  - The existing suggestion actions are unchanged.
- **`/api/admin/snack-times`:** GET and PATCH, admin only.

## Left to the builder

- How the components are split.
- Desktop rail details.
- Loading and error copy, in Home's voice.
