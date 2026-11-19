// The Wi-Fi check's verdict (prototype: docs/design/m3/, Wi-Fi). Delay and upload are measured to
// our own server, which is far from the office, so they mostly measure distance: the verdict rests
// on download (under 10 Mbps is slow) and only an extreme delay (over 600 ms). Upload is shown, not judged.
export type WifiNumbers = { down: number; up: number; delayMs: number };
export const wifiVerdict = (n: WifiNumbers): "slow" | "good" => (n.down < 10 || n.delayMs > 600 ? "slow" : "good");
