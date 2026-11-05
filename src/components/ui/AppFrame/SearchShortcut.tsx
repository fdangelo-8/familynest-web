"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The field of the search itself (`.campo-ricerca`, #40). */
function isSearchField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.closest(".campo-ricerca") !== null
  );
}

/**
 * Control+K / Command+K opens the search page, unless the user is typing.
 * Inside the search field it does nothing, but the browser's own shortcut
 * (which would jump to its address bar or search box) is still stopped, and
 * the search is not opened again. Renders nothing.
 */
export function SearchShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== "k") return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (isSearchField(event.target)) {
        event.preventDefault();
        return;
      }
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      router.push("/ricerca");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
