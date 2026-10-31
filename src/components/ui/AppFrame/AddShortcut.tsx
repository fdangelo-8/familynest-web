"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsDesktop } from "../overlay";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** From 1024 px, "n" opens Add unless the user is typing or a dialog is open. Renders nothing. */
export function AddShortcut() {
  const router = useRouter();
  const desktop = useIsDesktop();

  useEffect(() => {
    if (!desktop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== "n") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]'))
        return;
      event.preventDefault();
      router.push("/aggiungi");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktop, router]);

  return null;
}
