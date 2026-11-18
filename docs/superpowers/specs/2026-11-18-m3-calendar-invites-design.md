# Event invites to Google Calendar: design (Stage 8b, needs owner review before building)

## Owner request (18 Nov)

Admin-created events should reach every employee's Google Calendar. Everyone has an @innovinlabs.com Google account.

## How it works

1. **One-time connection.** In the admin app, under Publish › Events, an admin taps **Connect Google Calendar**. Google asks them to allow "See, edit, share and delete events on your calendars" (the `calendar.events` scope) for their own account. Nobody else is asked for anything.
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
