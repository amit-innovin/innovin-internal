import { afterEach, describe, expect, it, vi } from "vitest";
import { officeCheck } from "@/lib/geo";

afterEach(() => vi.unstubAllEnvs());

describe("verifying an office check-in", () => {
  const office = () => { vi.stubEnv("OFFICE_LAT", "12.935"); vi.stubEnv("OFFICE_LNG", "77.624"); vi.stubEnv("OFFICE_RADIUS_M", "300"); };

  it("office Wi-Fi is proof on its own: no location needed", () => {
    office();
    expect(officeCheck({ onNetwork: true, lat: null, lng: null })).toEqual({ ok: true, source: "wifi" });
    // Wi-Fi wins even when a (wrong) position is also sent.
    expect(officeCheck({ onNetwork: true, lat: 13.2, lng: 77.9 })).toEqual({ ok: true, source: "wifi" });
  });

  it("off Wi-Fi, asks for a location, then accepts it only inside the geofence", () => {
    office();
    expect(officeCheck({ onNetwork: false, lat: null, lng: null })).toEqual({ ok: false, code: "location-needed" });
    expect(officeCheck({ onNetwork: false, lat: 12.9352, lng: 77.6241 })).toEqual({ ok: true, source: "location" });
    const far = officeCheck({ onNetwork: false, lat: 12.97, lng: 77.64 });
    expect(far).toMatchObject({ ok: false, code: "outside" });
    expect(far.ok === false && far.code === "outside" && far.distanceM).toBeGreaterThan(4000);
  });

  it("with no office configured there is nothing to verify against", () => {
    expect(officeCheck({ onNetwork: false, lat: null, lng: null })).toEqual({ ok: true, source: "self" });
  });
});
