import type { LeaveType } from "./leave";

// owner  — can grant/revoke admin; cannot be demoted by anyone else
// admin  — the dashboard powers (approvals, publishing, order lists)
// member — the default on first sign-in
export type Role = "admin" | "member";

export type EmployeeRow = {
  email: string;
  name: string;
  picture: string;
  role: Role;
  // Date of joining (YYYY-MM-DD), admin-entered. Drives Earned Leave accrual, the one-year
  // availing gate, and Flexible Leave pro-rating. Null until someone fills it in.
  joinedOn: string | null;
  // Days hit before the app took over the 10K challenge — copied from the sheet by an admin.
  stepsOffset: number;
  // Regular office weekdays, Monday = 0. Empty until the person picks them. Stores always
  // return both fields; they are optional only so a first sign-in doesn't have to supply them.
  officeDays?: number[];
  // Exempt from the 8-office-days target (e.g. fully remote). Admin-set.
  officeExempt?: boolean;
  // Day and month only ("MM-DD"), and shown to colleagues only when the person opts in.
  birthday?: string | null;
  showBirthday?: boolean;
  createdAt: string;
  lastSeenAt: string;
  // Feed: everything created up to this moment has been seen. Only ever moves forward.
  feedSeenAt?: string | null;
};

// How a day got its mark. wifi / location: verified at the office. self: declared remote.
// late: added afterwards by the person (no location check). admin: fixed by an admin.
export type AttendanceSource = "wifi" | "location" | "self" | "late" | "admin";
export type DayMode = "office" | "remote";

// One entry per day changed after the fact, by the person or by an admin.
export type PlanOverrideRow = { email: string; date: string; planned: boolean };
export type ClosedDayRow = { date: string; reason: string; createdBy: string; createdAt: string };

export type AttendanceChangeRow = {
  id: string;
  email: string;
  date: string;
  from: DayMode | null;
  to: DayMode | null;
  by: string;
  kind: "late" | "admin";
  at: string;
};

// 10K steps challenge: one row per person per day. `hit` is the toggle; `steps` is the
// optional actual count for people who want to share it.
export type StepsRow = {
  id: string;
  email: string;
  date: string;
  hit: boolean;
  steps: number | null;
  createdAt: string;
};

export type AttendanceRow = {
  id: string;
  email: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  // Where the check-in happened, if the device shared it.
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  declaredMode?: "office" | "remote" | null;
  source?: AttendanceSource | null;
};

export type AwayType = "leave" | "wfh";
export type AwayStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AwayRow = {
  id: string;
  email: string;
  type: AwayType;
  // Which leave bucket this draws from (null for WFH, and for rows predating leave types).
  leaveType: LeaveType | null;
  halfDay: boolean;
  // Working days charged, frozen at submission so a later holiday-calendar change can't
  // retroactively alter someone's history.
  days: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason: string;
  status: AwayStatus;
  submitterRef: string;
  // Who approved/rejected it, for an audit trail. Null while pending, or when
  // decided via the break-glass PIN (which carries no identity).
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

// A person's leave balances as recorded in Zoho People, typed in by an admin. Zoho is the
// system of record. asOf is freshness only; reconciledRequestIds explicitly identifies
// app approvals reflected in the copied amounts. Other approvals remain estimated deductions.
export type LeaveBalanceRow = {
  email: string;
  year: number;
  available: Partial<Record<"cl" | "sl" | "el" | "fl", number>>;
  asOf: string;
  updatedBy: string | null;
  reconciledRequestIds?: string[];
};

// A browser's push subscription. `email` is set when the device is signed in, which is what
// lets a leave decision reach the right person; broadcasts go to every row.
//
// Deliberately never linked to a grievance: push is server-initiated with no request context,
// so delivering a grievance update would require storing exactly the grievance→device join that
// anonymity forbids. Grievance updates appear in the in-app feed only.
export type PushSubscriptionRow = {
  sessionRef?: string | null;
  sessionExpiresAt?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  email: string | null;
  createdAt: string;
};

export type EventCategory = "sports" | "arts" | "culture" | "learning" | "social" | "company";

export type EventRow = {
  updatedAt?: string;
  cancelledAt?: string;
  id: string;
  title: string;
  body: string;
  category: EventCategory;
  startsAt: string; // ISO
  location: string;
  createdBy: string; // admin email or "admin"
  createdAt: string;
};

export type RsvpRow = {
  eventId: string;
  submitterRef: string;
  email: string | null; // verified Google email when signed in
  createdAt: string;
};

export type GrievanceStatus = "open" | "in_progress" | "resolved";

export type GrievanceRow = {
  id: string;
  body: string;
  displayName: string | null;
  image: string | null;
  // "can't wait" — admins see these first and get a push. Still anonymous either way.
  urgent: boolean;
  submitterRef: string;
  status: GrievanceStatus;
  updatedAt?: string;
  createdAt: string;
};

export type WifiRow = {
  id: string;
  quality: "good" | "poor";
  note: string;
  downMbps: number | null;
  upMbps: number | null;
  createdAt: string;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
  // Important: shown once to everyone as a sheet and acknowledged, until pinnedUntil (a date).
  important?: boolean;
  authorName?: string | null;
  pinnedUntil?: string | null;
};

export type WorkspaceProfile = {
  email: string;
  designation: string;
  department: string;
  project: string;
  floor: string;
  desk: string;
  focus: string;
  mode: "office" | "remote" | null;
  presenceDate: string;
};

export type NoticeRow = {
  id: string;
  // Feed posts anyone can make. Kudos and polls are notices too, so they share reactions.
  kind: "quote" | "feedback" | "kudos" | "poll";
  title: string;
  body: string;
  attribution: string;
  color: "yellow" | "peach" | "blue" | "green" | "purple";
  anonymous: boolean;
  authorEmail: string | null;
  authorName: string | null;
  createdAt: string;
  // A photo on a note (compressed data URL).
  image?: string | null;
  // Kudos: who it is for.
  toEmail?: string | null;
  toName?: string | null;
  // Poll: the choices and when voting stops.
  options?: string[];
  closesAt?: string | null;
};
export type NoticeReaction = { noticeId: string; email: string; emoji: string };
export type PollVote = { noticeId: string; email: string; option: number };
export type TeaRow = { date: string; email: string; createdAt: string; round?: TeaRound; going?: boolean };
export type TeaRound = "am" | "pm";
// One person's answer for one tea round. Rows from before rounds existed read as an afternoon yes.
export type TeaAnswer = { date: string; round: TeaRound; email: string; going: boolean; createdAt: string };
// "suggested" by anyone (anonymously) → "shelf" when an admin adds it → "dismissed".
export type SnackItem = { id: string; name: string; note: string; status: "suggested" | "shelf" | "dismissed"; orderedAt: string | null; createdAt: string };
// voterRef is a keyed hash of the voter, so one vote per person without storing who.
export type SnackVote = { itemId: string; voterRef: string };
export type BookRow = { id: string; title: string; author: string; createdAt: string };
export type ReadingRow = { email: string; bookId: string; status: "want" | "reading" | "done"; page: number; pages: number; updatedAt: string };


export interface Store {
  addNotice(row: NoticeRow): Promise<NoticeRow>;
  listNotices(limit: number): Promise<NoticeRow[]>;
  deleteNotice(id: string): Promise<boolean>;
  toggleNoticeReaction(id: string, email: string, emoji: string): Promise<boolean>;
  listNoticeReactions(ids: string[]): Promise<NoticeReaction[]>;
  getWorkspaceProfile(email: string): Promise<WorkspaceProfile | null>;
  listWorkspaceProfiles(): Promise<WorkspaceProfile[]>;
  saveWorkspaceProfile(email: string, patch: Partial<Omit<WorkspaceProfile, "email">>): Promise<WorkspaceProfile>;
  // Returns the open session if one exists, otherwise inserts a new one.
  checkIn(row: AttendanceRow): Promise<AttendanceRow>;
  // Closes the open session; null when there isn't one.
  checkOut(email: string, date: string, at: string): Promise<AttendanceRow | null>;
  votePoll(noticeId: string, email: string, option: number | null): Promise<boolean>;
  listPollVotes(noticeIds: string[]): Promise<PollVote[]>;
  setTea(date: string, email: string, going: boolean): Promise<void>;
  listTea(date: string): Promise<TeaRow[]>;
  setTeaAnswer(date: string, round: TeaRound, email: string, going: boolean | null): Promise<void>;
  listTeaAnswers(date: string): Promise<TeaAnswer[]>;
  // Today's snack: one pick per person per day, by anonymous voter ref. null clears it.
  setSnackPick(date: string, voterRef: string, itemId: string | null): Promise<void>;
  listSnackPicks(date: string): Promise<{ itemId: string; voterRef: string }[]>;
  getSetting<T = unknown>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
  addSnack(row: SnackItem): Promise<SnackItem>;
  getSnack(id: string): Promise<SnackItem | null>;
  listSnacks(): Promise<SnackItem[]>;
  setSnackStatus(id: string, status: SnackItem["status"], orderedAt: string | null): Promise<boolean>;
  // The voter's new state (true = voted), or null when the item doesn't exist.
  toggleSnackVote(itemId: string, voterRef: string): Promise<boolean | null>;
  listSnackVotes(): Promise<SnackVote[]>;
  clearSnackVotes(itemId: string): Promise<void>;
  addBook(row: BookRow): Promise<BookRow>;
  listBooks(): Promise<BookRow[]>;
  setReading(row: ReadingRow): Promise<ReadingRow>;
  clearReading(email: string, bookId: string): Promise<void>;
  listReadings(): Promise<ReadingRow[]>;
  setBirthday(email: string, birthday: string | null, show: boolean): Promise<boolean>;
  // One tap = the day's mark. Creates or replaces that person's row for the date (mode, source,
  // position, time) and clears any old check-out.
  markDay(row: AttendanceRow): Promise<AttendanceRow>;
  // Removes the day's mark; false when there was none.
  clearDay(email: string, date: string): Promise<boolean>;
  addAttendanceChange(row: AttendanceChangeRow): Promise<AttendanceChangeRow>;
  listAttendanceChanges(email: string, limit: number): Promise<AttendanceChangeRow[]>;
  setOfficeDays(email: string, days: number[]): Promise<boolean>;
  // One date added to or taken out of someone's usual office days; null removes the override.
  setPlanOverride(email: string, date: string, planned: boolean | null): Promise<void>;
  listPlanOverrides(email: string, from: string, to: string): Promise<PlanOverrideRow[]>;
  listPlanOverridesOn(date: string): Promise<PlanOverrideRow[]>;
  // Admin-set office closures. addClosedDay is false when the date is already closed.
  listClosedDays(from: string, to: string): Promise<ClosedDayRow[]>;
  addClosedDay(row: ClosedDayRow): Promise<boolean>;
  removeClosedDay(date: string): Promise<boolean>;
  // Admin-set: no 8-office-day target for this person (e.g. fully remote).
  setOfficeExempt(email: string, exempt: boolean): Promise<boolean>;
  // The currently open session, or null.
  getAttendance(email: string, date: string): Promise<AttendanceRow | null>;
  // One person's day rows across a date range (inclusive), for the attendance calendar.
  listAttendanceRange(email: string, fromDate: string, toDate: string): Promise<AttendanceRow[]>;
  listAttendance(date: string): Promise<AttendanceRow[]>;
  // 10K challenge: one row per person per day — today is the only writable day.
  setSteps(row: StepsRow): Promise<StepsRow>;
  listSteps(): Promise<StepsRow[]>;
  listStepsByEmail(email: string, limit: number): Promise<StepsRow[]>;
  addGrievance(row: GrievanceRow): Promise<GrievanceRow>;
  setGrievanceStatus(id: string, status: GrievanceStatus): Promise<boolean>;
  listGrievances(): Promise<GrievanceRow[]>;
  // "My submissions" lookup — ids come from the device's own cookie, never a stored ref.
  listGrievancesByIds(ids: string[], limit: number): Promise<GrievanceRow[]>;
  addWifi(row: WifiRow): Promise<WifiRow>;
  listWifi(limit: number): Promise<WifiRow[]>;
  addAnnouncement(row: AnnouncementRow): Promise<AnnouncementRow>;
  getAnnouncement(id: string): Promise<AnnouncementRow | null>;
  deleteAnnouncement(id: string): Promise<void>;
  listAnnouncements(limit: number): Promise<AnnouncementRow[]>;
  ackAnnouncement(id: string, email: string): Promise<void>;
  listAckedAnnouncementIds(email: string): Promise<string[]>;
  countAnnouncementAcks(ids: string[]): Promise<Record<string, number>>;
  setFeedSeenAt(email: string, at: string): Promise<void>;
  addAway(row: AwayRow): Promise<AwayRow>;
  setAwayStatus(id: string, status: AwayStatus, decidedBy: string | null, decidedAt: string, expected: AwayStatus): Promise<boolean>;
  getAway(id: string): Promise<AwayRow | null>;
  listPendingAway(): Promise<AwayRow[]>;
  listAway(limit: number): Promise<AwayRow[]>;
  listAwayByRef(ref: string, limit: number): Promise<AwayRow[]>;
  // A verified employee's requests across all their devices.
  listAwayByEmail(email: string, limit: number): Promise<AwayRow[]>;
  addEvent(row: EventRow): Promise<EventRow>;
  getEvent(id: string): Promise<EventRow | null>;
  updateEvent(id: string, expected: string, patch: Pick<EventRow,"title"|"body"|"category"|"startsAt"|"location"> & {cancelledAt?:string}, updatedAt: string): Promise<EventRow | null>;
  deleteEvent(id: string, expected?: string): Promise<boolean>;
  // Upcoming events (startsAt >= fromIso), soonest first.
  listEvents(fromIso: string, limit: number): Promise<EventRow[]>;
  // Signed-in RSVPs follow email ownership; guest RSVPs follow their browser capability.
  setRsvp(eventId: string, ref: string, email: string | null, going: boolean): Promise<boolean>;
  listRsvps(eventId: string): Promise<RsvpRow[]>;
  rsvpCounts(eventIds: string[]): Promise<Record<string, number>>;
  myRsvpEventIds(ref: string, email?: string): Promise<string[]>;
  // Creates the employee on first sign-in; refreshes name/picture/lastSeenAt afterwards.
  upsertEmployee(row: EmployeeRow): Promise<EmployeeRow>;
  getEmployee(email: string): Promise<EmployeeRow | null>;
  listEmployees(): Promise<EmployeeRow[]>;
  setRole(email: string, role: Role): Promise<boolean>;
  setJoinedOn(email: string, joinedOn: string | null): Promise<boolean>;
  // Days hit before the app took over tracking — admin-entered from the old sheet.
  setStepsOffset(email: string, days: number): Promise<boolean>;
  setLeaveBalance(row: LeaveBalanceRow): Promise<LeaveBalanceRow>;
  listLeaveBalances(year: number): Promise<LeaveBalanceRow[]>;
  savePushSubscription(row: PushSubscriptionRow): Promise<PushSubscriptionRow>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  revokePushSession(sessionRef: string): Promise<void>;
  // `email` narrows to one person's devices; omit it to broadcast.
  listPushSubscriptions(email?: string): Promise<PushSubscriptionRow[]>;
}
