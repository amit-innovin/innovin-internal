import { futureWorkday } from "./dates";

// A WFH request that was still pending when requests were cut. The API can't create one any
// more, so global-setup writes it straight into the JSON data file.
const day = futureWorkday(3);
export const LEGACY_WFH = {
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
