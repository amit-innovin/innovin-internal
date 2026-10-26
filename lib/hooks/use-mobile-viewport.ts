"use client";

import { useEffect, useState } from "react";

// Shared by the mobile workspace and dialogs rendered outside it through a portal.
export function useMobileViewport(enabled: boolean) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let width = window.innerWidth;
    let restingHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const editing = !!document.activeElement?.matches("input,textarea,select,[contenteditable=true]");
        if (Math.abs(window.innerWidth - width) > 40) {
          width = window.innerWidth;
          restingHeight = Math.max(window.innerHeight, height);
        } else if (!editing) restingHeight = Math.max(restingHeight, window.innerHeight, height);
        const open = editing && restingHeight - height > 120;
        setKeyboardOpen(open);
        root.dataset.mobileKeyboardOpen = String(open);
        for (const [name, value] of Object.entries({
          "--workspace-viewport-height": `${height}px`,
          "--workspace-viewport-top": `${Math.round(viewport?.offsetTop ?? 0)}px`,
        })) {
          if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
        }
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      delete root.dataset.mobileKeyboardOpen;
      root.style.removeProperty("--workspace-viewport-height");
      root.style.removeProperty("--workspace-viewport-top");
    };
  }, [enabled]);
  return enabled && keyboardOpen;
}
