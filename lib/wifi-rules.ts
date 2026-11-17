// The Wi-Fi check's verdict (prototype: docs/design/m3/, Wi-Fi). Slow when any number is poor:
// under 10 Mbps down, under 5 Mbps up, or more than 150 ms of delay.
export type WifiNumbers = { down: number; up: number; delayMs: number };
export const wifiVerdict = (n: WifiNumbers): "slow" | "good" => (n.down < 10 || n.up < 5 || n.delayMs > 150 ? "slow" : "good");
