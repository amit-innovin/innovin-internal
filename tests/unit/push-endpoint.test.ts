import { describe, expect, it } from "vitest";
import { validPushEndpoint } from "@/lib/push-endpoint";

describe("push delivery destinations", () => {
  it("accepts browser push services and rejects arbitrary or disguised hosts", () => {
    for (const endpoint of ["https://fcm.googleapis.com/fcm/send/token", "https://updates.push.services.mozilla.com/wpush/v2/token", "https://web.push.apple.com/token", "https://wns2.notify.windows.com/w/?token=x"]) {
      expect(validPushEndpoint(endpoint)).toBe(true);
    }
    for (const endpoint of ["https://127.0.0.1/private", "https://localhost/private", "https://internal.example/private", "https://fcm.googleapis.com.evil.example/token", "https://fcm.googleapis.com@evil.example/token", "https://evil.example@fcm.googleapis.com/token", "http://fcm.googleapis.com/token", "https://fcm.googleapis.com:444/token", "garbage"]) {
      expect(validPushEndpoint(endpoint)).toBe(false);
    }
  });
});
