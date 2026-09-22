"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, LogIn } from "lucide-react";
import { IconTile, PageHeader } from "@/components/kit";
import { StatefulButton } from "@/components/motion/button/stateful";
import { Input } from "@/components/motion/input";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { Card } from "@/components/ui/card";
import { readError, send } from "@/lib/fetcher";
import { useButtonState } from "@/lib/hooks/use-button-state";

const MESSAGES: Record<string, string> = {
  "1": "Wrong passcode — try again",
  locked: "Too many attempts — try again later",
};

// `pinLength` is set when the passcode is a short numeric PIN → beUI OTP input;
// otherwise a regular password field is shown. `initialError` comes from the no-JS form fallback.
export default function AdminLogin({ pinLength, initialError }: { pinLength: number | null; initialError?: string }) {
  const router = useRouter();
  const flash = initialError ? MESSAGES[initialError] : undefined;
  // Inputs stay disabled until hydrated so keystrokes typed during page load are never lost.
  const [ready, setReady] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OTPStatus>(flash ? "error" : "idle");
  const [otpKey, setOtpKey] = useState(0);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | false>(flash ?? false);
  const [otpError, setOtpError] = useState(flash ?? MESSAGES["1"]);
  const [buttonState, run] = useButtonState();

  useEffect(() => setReady(true), []);

  async function signIn(code: string) {
    const res = await send("/api/admin/login", { method: "POST", json: { passcode: code } });
    if (res.ok) {
      setTimeout(() => router.refresh(), 450);
      return { ok: true as const };
    }
    return { ok: false as const, error: res.status === 401 ? "Wrong passcode — try again" : await readError(res) };
  }

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader title="Admin" subtitle="For office coordinators. Enter the admin passcode." />
      <Card className="items-center gap-0 p-6">
        <IconTile icon={Lock} tone="slate" size="lg" />
        {pinLength ? (
          <div className="mt-5 flex w-full justify-center">
            <OTPInput
              key={otpKey}
              length={pinLength}
              mask
              autoFocus
              disabled={!ready}
              status={otpStatus}
              label="Passcode"
              hint="Enter the admin PIN"
              successMessage="Welcome back"
              errorMessage={otpError}
              aria-label="Admin passcode"
              onChange={() => setOtpStatus("idle")}
              onComplete={async (code) => {
                const result = await signIn(code);
                if (!result.ok) setOtpError(result.error);
                setOtpStatus(result.ok ? "success" : "error");
                if (!result.ok) setTimeout(() => setOtpKey((k) => k + 1), 900);
              }}
              className="items-center"
            />
          </div>
        ) : (
          // method/action make a pre-hydration submit a safe POST (never a GET with the passcode in the URL).
          <form
            className="mt-5 w-full"
            method="post"
            action="/api/admin/login"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await signIn(passcode);
                setError(result.ok ? false : result.error);
                return result.ok;
              });
            }}
          >
            <Input
              label="Passcode"
              name="passcode"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              disabled={!ready}
              value={passcode}
              onChange={(v) => {
                setPasscode(v);
                setError(false);
              }}
              error={error}
              reserveErrorLine
            />
            <StatefulButton
              type="submit"
              state={buttonState}
              loadingText="Signing in"
              successText="Signed in"
              errorText="Try again"
              icon={<LogIn className="size-4" />}
              className="mt-2 h-11 w-full rounded-lg font-medium"
            >
              Sign in
            </StatefulButton>
          </form>
        )}
      </Card>
    </div>
  );
}
