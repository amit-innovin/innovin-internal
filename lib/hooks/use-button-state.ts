"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonState } from "@/components/motion/button/stateful";

// Drives a beUI StatefulButton: idle → loading → success/error → idle.
// The task returns true on success; throwing or returning false shows the error state.
export function useButtonState(resetMs = 1600) {
  const [state, setState] = useState<ButtonState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(
    async (task: () => Promise<boolean>) => {
      clearTimeout(timer.current);
      setState("loading");
      let ok = false;
      try {
        ok = await task();
      } catch {
        ok = false;
      }
      setState(ok ? "success" : "error");
      timer.current = setTimeout(() => setState("idle"), resetMs);
      return ok;
    },
    [resetMs],
  );

  return [state, run] as const;
}
