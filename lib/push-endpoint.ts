// Subscriptions are client input. Limit server-side delivery to browser push services,
// including old stored subscriptions, so registration cannot enable arbitrary requests.
export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (endpoint.length > 4096 || url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    return ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname)
      || url.hostname.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}
