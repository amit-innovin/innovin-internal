import { describe, expect, it } from "vitest";
import { locationFailure } from "@/lib/locate";

// GeolocationPositionError codes: 1 permission denied, 2 position unavailable, 3 timeout.
describe("why a location read failed", () => {
  it("permission denied means location is off", () => expect(locationFailure({ code: 1 })).toBe("blocked"));
  it("no geolocation in the browser means location is off", () => expect(locationFailure(new Error("unsupported"))).toBe("blocked"));
  it("a timeout indoors is a weak signal, not a blocked permission", () => expect(locationFailure({ code: 3 })).toBe("no-fix"));
  it("position unavailable is a weak signal too", () => expect(locationFailure({ code: 2 })).toBe("no-fix"));
});
