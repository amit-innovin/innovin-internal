# Event invites to Google Calendar: design (Stage 8b, approved 18 Nov)

## Owner request (18 Nov)

Admin-created events should reach every employee's Google Calendar. Everyone has an @innovinlabs.com Google account.

## How it works

1. **One-time connection.** In the admin app, under Publish › Events, an admin taps **Connect Google Calendar**. Google asks them to allow "See, create, change and delete events on Google calendars you own" (the `calendar.events.owned` scope, the narrowest one that can send invites; plus `openid email` so the app can check the connected account is the admin's own) for their own account. Nobody else is asked for anything.
2. **Publishing.** When that admin publishes an event with **Invite everyone in Google Calendar** switched on, the app creates the event in the admin's own calendar. It adds every person in the app's people list as a guest and sets `sendUpdates=all`. Google then delivers it to each calendar as a normal invite, and people can accept or decline in Google.
3. **Changes.** Editing or cancelling the event in the app updates or cancels the Google event, and guests are notified by Google.
4. **The in-app RSVP stays as it is.** "Going" in the app and the Google accept/decline are not synced, which keeps it simple. Admins see the app count.

## What gets stored, and how

1. To act later without the admin present, the app needs that admin's Google **refresh token**.
2. It's stored in a new table `admin_google_tokens(email, token_ciphertext, iv, tag, scope, created_at)`, encrypted with AES-256-GCM. The key is derived from a dedicated secret, `CALENDAR_TOKEN_KEY`. It is never sent to the browser and never logged.
3. **Disconnect** deletes the row and revokes the token at Google. Removing someone's admin role also deletes their token.
4. If the token stops working (revoked, or the password changed), publishing still succeeds in the app. The admin sees "Google Calendar invite didn't go out. Reconnect."

## What you would need to do

1. **Enable the Google Calendar API** in the Google Cloud project that already runs Google sign-in.
2. **Allow the scope:** add the `calendar.events` scope to its OAuth consent screen. Because the app is internal to the Workspace, Google doesn't need to review it.
3. **Set the secret:** add the new `CALENDAR_TOKEN_KEY` (32 random bytes) to the deployment's settings.

## Alternatives considered

- **Domain-wide delegation** (a service account that writes straight onto everyone's calendar): no invite step for people, but it needs a Workspace super-admin and gives the app power over every calendar. That's more than this needs.
- **An "Add to calendar" button only:** no stored tokens at all, but nothing reaches calendars automatically, which is what you asked for.

## Tests

1. The e2e Google mock gains `/calendar/v3/calendars/primary/events`, which records inserts, updates and deletes.
2. **Publish:** one insert with every employee as a guest and `sendUpdates=all`.
3. **Cancel:** a delete.
4. **Storage and cleanup:** the stored token is encrypted, and Disconnect deletes it and calls revoke.
5. **Failure handling:** a failing token shows the reconnect message, and the event is still published.

## Owner approval and additions (18 Nov)

Approved with: least-privilege scope, encrypted server-side refresh token, and handling for duplicate invitations, inactive employees, and an organizer who disconnects or leaves. Disconnecting must revoke the Google authorization as well as delete the stored token.

### Credential lifecycle

1. **Connect:** authorization-code flow with PKCE (S256), `access_type=offline`, `prompt=consent`, `login_hint` set to the admin. The state is signed with `SESSION_SECRET` and tied to a short-lived httpOnly cookie, so a callback can't be replayed or started from another session. The callback refuses:
   - a Google account other than the signed-in admin's;
   - a grant missing the calendar scope (Google lets people untick it);
   - someone who is no longer an admin.
2. **Storage:** AES-256-GCM with a random 12-byte IV. The admin's email is bound in as associated data, so a row copied onto another admin won't decrypt. A key id is stored too: after a key change, old rows read as "reconnect" instead of failing silently.
3. **Use:** access tokens are fetched per sync and kept only in memory. If Google says `invalid_grant`, the row is deleted and the admin is asked to reconnect.
4. **Disconnect, losing admin, or marked as left:**
   1. hand over or orphan their upcoming invites (below);
   2. revoke at Google (`/revoke`);
   3. delete the row.

   If the revoke call fails, the row is still deleted and the admin is told to remove access at myaccount.google.com/permissions.
5. **Reconnect:** overwrites the row. The old token isn't revoked separately, because revoking can take the whole grant, new token included.

### Duplicate invitations

1. **One Google event per app event:**
   - Each app event's Google event gets a deterministic id: `sha256(eventId:generation)` as hex, which Google accepts as base32hex.
   - A retry or a double submit hits Google's 409 and becomes an update, never a second invite.
   - The generation only changes on a hand-over.
2. **Guest list:**
   - Lowercased and deduplicated.
   - Only the allowed domain.
   - The organizer is never listed twice.
3. **Changing guests:** reads the event first and keeps each guest's existing answer, so nobody is re-invited or loses their accept.

### Inactive employees

1. **Marking someone as left:** admins mark a person "Left" in People (and can undo it). The admin's own account and ADMIN_EMAILS admins can't be marked.
2. **Who gets invites:** people marked left get no new invites. They're removed from upcoming invites without an email. Their announcement "seen by" counts no longer include them.
3. **New joiners:** someone who signs in for the first time is added to upcoming invites without an email; the event still appears in their calendar. Invites go to the app's people list, because reading the Workspace directory would need a broader admin scope.

### When the organizer disconnects or leaves

1. **Another admin is connected (the earliest connected one):** each upcoming invite moves to them.
   - The app copies the event into their calendar with the same guests and answers, without emailing, then deletes the old one, also without emailing.
   - If any step fails, the copy is removed again and the invite is marked orphaned. Two copies are never left in people's calendars.
2. **Nobody else is connected:** the invites stay in people's calendars but are marked **orphaned**. The app can no longer update or cancel them in Google.
   - The Disconnect confirmation says this before it happens.
   - Needs you shows orphaned invites until the event passes.
3. **An invite that didn't go out** (no connection, or a dead token) shows in Needs you with **Send again** on the event. That reuses the same deterministic id.

### My calls (not in the request)

- **Length:** Google events are 1 hour long, since app events have no end time.
- **Guest list:** hidden from guests (`guestsCanSeeOtherGuests: false`), in keeping with welfare, not groupism.
- **Time zone:** events use `Asia/Kolkata`.
- **Cancel vs delete:** Cancel emails guests (`sendUpdates=all`); Delete removes the invite silently, matching the app's existing Delete.
- **Old sign-ins:** marking someone left doesn't end their app sign-in. Suspending their Google account does that.
