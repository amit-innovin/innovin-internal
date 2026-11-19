import { afterEach, describe, expect, it, vi } from "vitest";
import { officeCheck } from "@/lib/geo";

afterEach(() => vi.unstubAllEnvs());

describe("verifying an office check-in", () => {
  const office = () => { vi.stubEnv("OFFICE_LAT", "12.935"); vi.stubEnv("OFFICE_LNG", "77.624"); vi.stubEnv("OFFICE_RADIUS_M", "300"); };

  it("asks for a location, then accepts it only inside the geofence", () => {
    office();
    expect(officeCheck({ lat: null, lng: null })).toEqual({ ok: false, code: "location-needed" });
    expect(officeCheck({ lat: 12.9352, lng: 77.6241 })).toEqual({ ok: true, source: "location" });
    const far = officeCheck({ lat: 12.97, lng: 77.64 });
    expect(far).toMatchObject({ ok: false, code: "outside" });
    expect(far.ok === false && far.code === "outside" && far.distanceM).toBeGreaterThan(4000);
  });

  it("being on the office network is not proof by itself: a location is still needed", () => {
    office();
    vi.stubEnv("OFFICE_IPS", "203.0.113.7");
    // Older callers passed onNetwork; it must no longer short-circuit the location check.
    expect(officeCheck({ onNetwork: true, lat: null, lng: null } as unknown as Parameters<typeof officeCheck>[0])).toEqual({ ok: false, code: "location-needed" });
  });

  it("with no office configured there is nothing to verify against", () => {
    expect(officeCheck({ lat: null, lng: null })).toEqual({ ok: true, source: "self" });
  });
});
