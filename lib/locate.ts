// Why a one-off location read failed. Only a denied permission (or no geolocation at all) means
// "location is off"; a timeout or unavailable position indoors just means a weak signal.
export type LocationFailure = "blocked" | "no-fix";

export function locationFailure(error: unknown): LocationFailure {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : null;
  return code === 2 || code === 3 ? "no-fix" : "blocked";
}
