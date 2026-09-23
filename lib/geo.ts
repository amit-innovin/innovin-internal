// Office geofence for attendance. OFFICE_LAT/OFFICE_LNG mark the office; OFFICE_RADIUS_M is
// the radius in metres that still counts as "in office" (default 300m — GPS indoors is coarse).
export type LocationTag = "office" | "remote" | "unknown";

export function officeLocation() {
  const lat = Number(process.env.OFFICE_LAT);
  const lng = Number(process.env.OFFICE_LNG);
  const radiusM = Number(process.env.OFFICE_RADIUS_M ?? 300);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, radiusM: Number.isFinite(radiusM) && radiusM > 0 && radiusM <= 50_000 ? radiusM : 300 };
}

// Great-circle distance in metres (haversine).
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// "unknown" when the device didn't share a position or no office is configured.
export function locationTag(lat: number | null | undefined, lng: number | null | undefined): LocationTag {
  const office = officeLocation();
  if (lat == null || lng == null || !office) return "unknown";
  return distanceM(lat, lng, office.lat, office.lng) <= office.radiusM ? "office" : "remote";
}
