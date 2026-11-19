// Where a notification or push opens. Leave updates go to Days (leave is applied in Zoho People).
export const leaveHref = () => "/days";
export function boardHref(id?: string) {
  return id ? `/feed#announcement-${encodeURIComponent(id)}` : "/feed";
}
export function eventHref(id: string) { return `/feed/events/${encodeURIComponent(id)}`; }
