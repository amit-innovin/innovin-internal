# Say hi: design (Material 3, Stage 7)

Branch `m3-foundation-home`.

Prototype: `docs/design/m3/Prototype.dc.html`:
- Home's "In office today" Wave buttons;
- the "Say hi to {name}" sheet (logic `hi`);
- the invite item on Notifications (logic `inc`);
- the opt-in (`sayHiOn`, the Notification settings sheet).

## Owner rulings (18 Nov)

- Say hi is built **opt-in**. Only people who switch it on can send or get waves and invites.
- Pushes stay generic ("Open the app to check your updates"). The message itself appears inside the app, on Notifications.

## Goals

### Opt-in

- A "Say hi" switch in Account › Notification settings, with the sub-line "Waves and invites from people in the office. Only people who turn it on can send or get them."
- When you're out, Home's "In office today" shows "Say hi is off. Turn it on to wave at people and get invites." and a **Turn on** button.

### Wave button

- It appears next to someone in "In office today" only when both of you have Say hi on and both of you are checked in at the office today.

### The sheet

- Title: "Say hi to {name}".
- Gestures: **Wave**, **High five**, **Thanks!**
- Invites: **Chai break?**, **Lunch together?**, **Walk?** An invite needs a time: **Now**, **In 30 min**, or **Pick a time**, which runs from 9:00 to 19:00 in 15-minute steps.
- The send button reads "Send {choice}" and is disabled until the choice is complete.
- Below it: "Up to 3 a day, so nobody gets flooded." and "You can turn Say hi off in Account › Notification settings."
- After sending, the person's button shows what you sent.

### Recipient

- A Notifications item: "{Name} waved", "{Name}: high five!", "{Name}: thanks!", "{Name}: chai break now?" or "{Name}: lunch together at 1:00 pm?"
- Invites carry **I'm in** and **Not today** buttons. After answering, the item reads "You said yes. {Name} can see it." or "You said not today."

### Sender

- A Notifications item when the other person answers an invite: "{Name} is in for chai" or "{Name} can't make lunch today".

### Limits, enforced by the server

- 3 sends per sender per day.
- Both people need Say hi on and an office check-in today.
- You can't send to yourself, and only one reply is allowed per invite.

## Non-goals

- No push text with names or messages.
- No history beyond today's Notifications.
- No group invites.

## Decided parts of the how

### Store

- `EmployeeRow.sayHi` (default false), set with `setSayHi`.
- `hi_messages(id, date, from_email, to_email, kind, at_time, reply, created_at)`, with these methods:
  - `addHi`
  - `listHiFrom(date, from)`
  - `listHiTo(date, to)`
  - `listHiRepliesFor(date, from)`
  - `setHiReply(id, to, reply)`, which returns false unless the caller is the recipient and the item is an unanswered invite.

### Routes

- `POST /api/hi/setting { on }`.
- `POST /api/hi { to, kind, time }`. Kinds are `wave|five|thanks|chai|lunch|walk`. Time is `now`, `30`, or an "HH:MM" from 09:00 to 19:00.
  - It returns 403 when either person is opted out or not in the office, 409 at the limit, and 400 for a bad kind, time or target.
- `POST /api/hi/reply { id, reply: "yes"|"no" }`.

### Data and UI

- `daysView` extends `around.inToday` with a list of people `{ email, name, sayHi }`. It also returns `me.sayHi` and `sent` (who you've sent to today, with labels).
- Notifications gain the kind `"hi"`, with a `reply` state and an action.
