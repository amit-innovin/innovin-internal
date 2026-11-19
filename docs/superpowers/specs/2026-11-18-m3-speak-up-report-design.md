# Speak up and Feed "Report": design (Material 3, Stage 6)

Branch `m3-foundation-home`. Prototype: `docs/design/m3/Prototype.dc.html`, "Speak up" (around line 433, logic `sp`).

## Owner rulings (18 Nov)

- Feed posts appear straight away and people can react. A quiet **Report** flag lets anyone tell admins about a post. Admins see how many reports a post has, never who sent them. The post stays up until an admin removes it.
- Speak up stays a private, anonymous message to admins. It is not a public wall.

## Goals

1. **`/grievances` (Speak up), rebuilt in Material 3.**
   - **Header:** a back arrow, then "Speak up".
   - **Anonymity card:** "Anonymous by design". Admins see the topic and your message. They don't see your name, email or device, and the date shows only the day, not the time.
   - **Topic chips:** Workplace, People, Facilities, Process, Something else. Choosing one is optional.
   - **Message field:** "What's going on?", with the placeholder "Write it the way you'd say it. Leave out details that would identify you if you want to stay anonymous."
   - **Button:** **Send anonymously**, disabled until there's text.
   - **Serious issues line:** "Something serious, like harassment or a safety issue? You can also go straight to HR." The canvas shows "[HR CONTACT]". The real contact is still to come from the owner, so the text says "HR" until then.
   - **Sent state:** "Sent anonymously". "Reference SU-XXXX. If an admin replies, it shows under My reports. Only this device can see your reports." Then a **Write another** button.
   - **My reports:** messages sent from this device, as now. Each row shows the topic and reference, then a status line: "Sent {day} · no reply yet", "In progress" or "Resolved". An admin reply shows under the row.
   - **Signed out:** Speak up keeps working without a session.
2. **Anonymity, kept stronger.**
   - New messages store only the day: `createdAt` is set to the day at 00:00 IST. A time can't be matched against check-ins.
   - The UI drops name, urgency and photo (they aren't in the prototype). Old rows keep their fields, but the new UI doesn't show them.
3. **Store additions.**
   - `GrievanceRow` gains `topic: string | null` and `reply: string | null`.
   - New method `setGrievanceReply(id, reply)`.
   - The admin `PATCH /api/grievances` accepts `{ id, reply }`.
   - The `mine` view returns `topic`, `status`, `reply` and the day.
4. **Feed Report.**
   - Other people's quotes, feedback, kudos and polls get a "Report" text button in the post's sheet (Earlier) and on its card.
   - It opens a confirm: "Report this post to admins? They'll see it was reported, not by whom." Then a toast: "Reported. An admin will take a look."
   - Storage: `notice_reports(notice_id, reporter_ref, at)`, one row per person per post. `reporter_ref` is the keyed hash `accountRef("report:"+email)`.
   - `POST /api/notices/report { id }`: 200 the first time, 409 after that. It answers 404 for an unknown post and 400 for your own post.
   - `GET /api/admin/reported` (admin only) returns the reported posts with their counts and nothing about who reported.

## Non-goals

- No admin UI in this stage. Replies and the reported list belong to the admin app stage.
- No public Speak up wall.
- No reactions on Speak up.

## Left to the builder

Component split, and copy for errors.
