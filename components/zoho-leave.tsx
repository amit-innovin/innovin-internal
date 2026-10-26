import { fmtShortDate, fmtTime } from "@/lib/format";
import { LEAVE_LABELS } from "@/lib/leave";
import type { ZohoLeaveResult } from "@/lib/zoho-people";

export function ZohoLeave({ result, today }: { result: ZohoLeaveResult; today: string }) {
  const { data } = result;
  if (!data) return <p className="studio-notice" role="status">{result.message}</p>;
  const upcoming = data.approved.filter(row => row.to >= today);
  return <div className="zoho-leave-summary">
    <p className="zoho-sync-status" role="status"><strong>{result.state === "stale" ? "Zoho data needs a refresh" : "From Zoho People"}</strong><span>Last read {fmtShortDate(data.fetchedAt)} at {fmtTime(data.fetchedAt)}</span></p>
    <p className="mt-2 text-xs text-muted-foreground">{result.message}</p>
    <ul className="mt-3 divide-y">{data.balances.map(row => <li key={row.type} className="flex items-center justify-between gap-4 py-3"><span>{LEAVE_LABELS[row.type]} Leave</span><strong>{row.remaining === null ? "Unavailable" : `${row.remaining} days available`}</strong></li>)}</ul>
    <h3 className="mt-5 text-sm font-semibold">Upcoming approved leave in Zoho</h3>
    {upcoming.length ? <ul className="mt-2 divide-y">{upcoming.slice(0, 12).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{row.type}<small className="block text-muted-foreground">{fmtShortDate(`${row.from}T12:00:00+05:30`)} - {fmtShortDate(`${row.to}T12:00:00+05:30`)}</small></span><span>{row.days} {row.days === 1 ? "day" : "days"}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No upcoming day-based approved leave returned for this year.</p>}
    {upcoming.length > 12 && <p className="text-xs text-muted-foreground">Showing the next 12 approved requests. Open Zoho People for the full history.</p>}
    <p className="mt-4 text-xs text-muted-foreground">This view is read-only. Requests made here remain separate from Zoho until submission integration is connected.</p>
  </div>;
}
