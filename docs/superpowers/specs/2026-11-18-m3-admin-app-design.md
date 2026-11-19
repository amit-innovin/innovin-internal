# Admin app (Material 3, Stage 8a): design

**Branch:** `m3-foundation-home`.

**Prototype:**
- `docs/design/m3/M3AdminApp.dc.html` (desktop)
- `docs/design/m3/M3AdminAppPhone.dc.html` (phone)

Both versions include the 18 Nov feedback pass.

## Owner rulings

- **Own app:** the admin side is its own app with its own shell, built on the same Material 3 system. People reach it from Account › Admin, and it has an "Open the member app" link.
- **"Needs you" comes first** on the admin home.
- **No vanity numbers or explainer copy.** A number only appears when it drives an action.
- **Every announcement** shows once as a dialog. The Important toggle goes; the optional pin date stays.
- **Leave** stays in Zoho. Speak up, snack picks and Wi-Fi reports stay anonymous.
- **Birthdays** are entered by admins.
- **Google Calendar invites** for events come in Stage 8b. 8a only draws the switch, which stays off until 8b.

## Goals

1. **Admin shell** at `/admin/*`:
   - **Desktop:** a sidebar with the "innovin admin" wordmark and the pages Today, People, Speak up, Publish, Office and Wi-Fi reports, plus "Open the member app".
   - **Phone:** a top bar with a "Member app" button, and a bottom bar with Today, People, Speak up, Publish and More. More holds Office, Wi-Fi reports and the member app link.
   - **No member navigation or Speak up button** appears inside the admin app.
2. **Today (`/admin`):**
   - **"Needs you" rows**, each with a chevron that links to its page:
     - new Speak up messages;
     - reported Feed posts;
     - each announcement not yet seen by everyone ("{title} — seen by N of M");
     - slow Wi-Fi reports today;
     - people behind on their 8 office days;
     - "Snack order goes in at {time}" until it's marked ordered.
   - **Empty state:** "Nothing needs you right now."
   - **Below that, one compact card:** in office / not in office / on leave, and the tea round count with Show names.
3. **People:**
   - **Layout:** a searchable list showing name, usual days, x/8 and a status chip. The person panel only appears once someone is picked (no empty-state text).
   - **The panel holds:** the month calendar; Fix a day (In office or Not in office, past dates only); exempt from the 8 days; make or remove admin; and birthday (day and month, plus "Show on their birthday").
4. **Speak up:**
   - **Reported posts first:** each post, its report count, and "Keep" (clears the reports) or "Remove post".
   - **Then messages:** topic, message and day, a status (New / In progress / Resolved), and a note the sender sees.
5. **Publish:**
   - **Announcements:** title, body, and an optional "Pin to the top of the Feed until" date. The list shows "Seen by N of M" and Delete.
   - **Events:** title, date and time, place and category. The list shows "N going", Cancel and Delete. The "Invite everyone in Google Calendar" switch is drawn but disabled until 8b.
6. **Office**, in three tabs:
   - **Closed days.**
   - **Tea & snack times**, the existing settings.
   - **Snack shelf:** Today's order (plain quantities sorted by picks, "Goes in at {time}", then "Mark ordered", after which it reads "Ordered at {time}"), followed by a tabbed card "Suggestions · N" (Add to shelf / Dismiss) and "Shelf · N" (Remove, plus Add a snack).
7. **Wi-Fi reports:** a list showing day, area, down and up speeds, and note, with one line "Most reported this week: {area}".
8. **Every announcement as a dialog:** the member sheet shows any announcement the person hasn't acknowledged. That covers announcements from the last 14 days, or until their pin date if one is set. `important` is no longer an input.
9. **Member side, vanity removals:**
   - Feed event cards drop "{n} going". The admin list keeps it.
   - Today's snacks drop per-item pick counts and bars.
   - The Wi-Fi "sent" state drops "N other people reported…".

## Non-goals

- Google Calendar (8b).
- Leave approvals.
- Admin push.

## Decided parts of the how

**Routes and data:**
- New admin pages live under `app/(admin)/admin/(m3)/` with their own layout and `components/admin-app/*`.
- The old `/admin/today` and `/admin/snacks` redirect into the new pages. `/admin/tools` stays as the legacy screen.

**Store:**
- `clearNoticeReports(noticeId)`.
- The admin birthday comes through `PATCH /api/people { email, birthday, showBirthday }`, which reuses `setBirthday`.

**Announcements:**
- `needsYou` gets the new items.
- `/api/announcements/important` becomes "unacknowledged announcement". Its rule is: created within the last 14 days, or `pinnedUntil >= today`.
