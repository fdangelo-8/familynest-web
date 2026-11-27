"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { it } from "@/lib/i18n/messages/it";
import { useShell } from "../AppFrame/Shell";
import { IconButton } from "../IconButton/IconButton";
import { useEscapeLayer } from "../overlay";

/** `history.back()` calls made by a panel closing, whose `popstate` is ours. */
let ownBacks = 0;

export type PanelProps = {
  open: boolean;
  onClose: () => void;
  /** Required: the `h2` of the head and the name of the region */
  title: string;
  children: ReactNode;
  /** Foot: «Elimina» on the left (`footerStart`), the actions on the right (`footerEnd`) */
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  "data-testid"?: string;
};

/**
 * Panel on the right (F5 #506, §7): looks at and edits without leaving the
 * page. It sits beside the content, which gets narrower, with no veil; the
 * sidebar goes to icons. It is not a window: the focus is not trapped, and Tab
 * reaches it last. Esc, «Chiudi» and the browser's «back» close it, and the
 * focus goes back to the control that opened it. Without the frame (the
 * gallery) it is drawn in place.
 */
export function Panel({
  open,
  onClose,
  title,
  children,
  footerStart,
  footerEnd,
  "data-testid": testId,
}: PanelProps) {
  const shell = useShell();
  const titleId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const historyEntry = useRef(false);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const setPanelOpen = shell?.setPanelOpen;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    closing.current = false;
    setPanelOpen?.(true);

    // One entry of the history: «back» of the browser closes the panel and
    // leaves the page (the address does not change).
    const token = Math.random().toString(36).slice(2);
    window.history.pushState(
      { ...(window.history.state as object | null), panel: token },
      "",
      window.location.href,
    );
    historyEntry.current = true;
    const onPopState = () => {
      // The «back» that we asked for ourselves (closing by Esc or «Chiudi»).
      if (ownBacks > 0) return;
      historyEntry.current = false;
      closing.current = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      setPanelOpen?.(false);
      // Closed by Esc, «Chiudi» or the parent: take our entry off the history.
      // Only if that entry is still the current one: if the person went to
      // another page in the meantime, going back would leave that page.
      const stillCurrent =
        (window.history.state as { panel?: string } | null)?.panel === token;
      if (historyEntry.current && !stillCurrent) {
        historyEntry.current = false;
      }
      if (historyEntry.current) {
        historyEntry.current = false;
        ownBacks += 1;
        // All the listeners see the event first; then the count goes down.
        window.addEventListener(
          "popstate",
          () => {
            window.setTimeout(() => {
              ownBacks -= 1;
            }, 0);
          },
          { once: true },
        );
        window.history.back();
      }
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus();
    };
  }, [open, setPanelOpen]);

  const requestClose = useCallback(() => onCloseRef.current(), []);
  useEscapeLayer(open, requestClose);

  if (!open) return null;

  const panel = (
    <section
      className="pannello"
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <header className="pannello__testata">
        <h2 id={titleId} className="pannello__titolo">
          {title}
        </h2>
        <IconButton
          icon="x"
          aria-label={it.shell.panelClose}
          onClick={requestClose}
        />
      </header>
      <div className="pannello__corpo">{children}</div>
      {footerStart || footerEnd ? (
        <footer className="pannello__piede">
          <div className="pannello__piede-inizio">{footerStart}</div>
          <div className="pannello__piede-fine">{footerEnd}</div>
        </footer>
      ) : null}
    </section>
  );

  if (!shell) return panel;
  return shell.panelSlot ? createPortal(panel, shell.panelSlot) : null;
}
