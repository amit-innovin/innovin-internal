# Stage 9: the last screens (design)

## Why

On 19 Nov the owner decided:

- The branch goes up as a draft PR, and Amit merges it after review.
- It goes up only once every screen is Material 3.

An audit found six pages still in old designs, plus stale end-to-end specs for retired screens.

## Decisions (owner, 19 Nov)

1. **Admin tools** (`/admin/tools`) is retired.
   - Publish gains **Edit** for events; editing was the only thing the admin app lacked.
   - Time-away approvals are dropped, because Zoho People decides leave.
   - The yearly leave-balance table is dropped, because Zoho People shows balances.
2. **New screens are drawn on a fresh canvas first:** https://claude.ai/artifact/NRpZBjTSvvoWB2yJNuTy7e (repo copy `docs/design/m3/`).

## What gets built (canvas boards are the reference)

| Screen | Board | Route |
|---|---|---|
| Event details | `M3EventDetails.dc.html` | `/feed/events/[id]` |
| Help | `M3Help.dc.html` | `/help` |
| Sign in | `M3SignIn.dc.html` | `/sign-in` |
| Admin event Edit dialog + optional Details field | `M3AdminApp*.dc.html` (Publish › Events) | `/admin/publish?tab=events` |

### Event details

- A detail screen: a back arrow to the Feed, then the category tag and title. There is no illustrated band.
- **When and where:** a card with the date and time, the place, and the details when there are any.
- **Answer:** "Are you going?" with **I'm going** / **Not this time**, shown only for upcoming events that aren't cancelled. The pressed state shows "You're going".
- **In Google Calendar:** the line "It's in your Google Calendar too." shows when that event's invite went out.
- **Other states:**
  - a cancelled event shows the banner "This event was cancelled";
  - a past event shows "This event has passed.";
  - a removed event shows "This event isn't here any more" with **Back to Feed**.
- **No headcount for members**, matching the Feed (`/api/feed` already strips `going` for non-admins). The event API strips it too.

### Help

- Ten questions in an accordion (one open at a time), with the copy exactly as on the board.
- The page ends with "Something else? Ask an admin, or send it through Speak up."

### Sign in

- A single card on the surface colour:
  - the office illustration;
  - "innovin", the heading "Sign in", and "Use your @innovinlabs.com Google account.";
  - **Continue with Google**.
- **Errors:** shown in an error container. The copy for `failed` and `busy` is as on the board.
- **Not set up:** a neutral note ("Sign-in isn't set up on this server yet. Ask an admin.").

### Admin Publish

- New event gets **Details (optional)**, a textarea of up to 500 characters, matching the API.
- Each live event gets **Edit**. It opens the **Edit event** dialog (title, date, time, place, details), and **Save** sends the existing update action.
- **After saving:** the snackbar says "Saved. People going were told." The Google invite follows the edit, using Stage 8b's `updateInvite`.

## Retired

All of these redirect, and their pages and now-unused components are deleted:

- `/attendance` → `/days`
- `/reading` → `/`
- `/admin/tools` → `/admin`

Duo-only components and CSS that nothing uses any more are removed. `AGENTS.md` is updated to the new canvas.

## Tests

1. **New and updated tests:**
   - e2e for each new screen and for event Edit;
   - the API stops sending `going` to members;
   - the redirects.
2. **Stale specs** (admin, roles, journey-repairs, workspace, leave, notifications, attendance, auth, access): each failing test is rewritten against the new screens when its behaviour still exists, or deleted with a note when the screen or behaviour is gone.
3. **Finish line:** the whole suite is green apart from known infrastructure flakes, which are named. Then a fresh review and the draft PR.
