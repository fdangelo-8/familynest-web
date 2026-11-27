"use client";

import { it } from "@/lib/i18n/messages/it";

/**
 * "Vai al contenuto": first element reachable with Tab. Hidden until it has
 * the focus; moves the focus to the page's <main> (`id="contenuto"`).
 * A native anchor, not `next/link`: Next's link handler leaves the focus
 * untouched, while the browser's own jump to the fragment moves it.
 */
export function SkipLink() {
  return (
    <a
      href="#contenuto"
      className="vai-al-contenuto btn-primary btn--piccolo"
      onClick={() => document.getElementById("contenuto")?.focus()}
    >
      {it.shell.skipToContent}
    </a>
  );
}
