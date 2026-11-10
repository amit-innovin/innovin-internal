import { futureWorkday } from "./dates";

// WFH requests that were still pending when requests were cut. The API can't create one any
// more, so global-setup writes it straight into the JSON data file.
const day = futureWorkday(3);
const row = {
  id: "legacy-wfh-pending",
  email: "legacy.wfh@innovinlabs.com",
  type: "wfh",
  leaveType: null,
  halfDay: false,
  days: 0,
  startDate: day,
  endDate: day,
  reason: "from before the cut",
  status: "pending",
  submitterRef: "anon",
  decidedBy: null,
  decidedAt: null,
  createdAt: new Date().toISOString(),
};

export const LEGACY_WFH = row;
// A second row for the cancel test, so a retried run never finds the first one already cancelled.
export const LEGACY_WFH_CANCEL = { ...row, id: "legacy-wfh-cancel", reason: "from before the cut, to cancel" };
