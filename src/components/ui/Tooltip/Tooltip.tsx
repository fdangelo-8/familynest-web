"use client";

import { useEffect, useState, type FocusEvent, type ReactNode } from "react";

/**
 * Balloon with the name of an icon (`.fumetto`), at the side of the control.
 * It appears with the mouse over and with the focus from the keyboard; Esc
 * hides it and leaves the focus where it is (WCAG 1.4.13). It never takes the
 * focus and is only visual: the accessible name is on the control itself.
 * Where the control already shows its name, CSS keeps the balloon hidden.
 */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  /** The control: a link or a button */
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const visible = (hover || focus) && !dismissed;

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  const onFocus = (event: FocusEvent<HTMLSpanElement>) => {
    // Only the focus that comes from the keyboard (a click does not show it).
    if (!event.target.matches(":focus-visible")) return;
    setDismissed(false);
    setFocus(true);
  };

  return (
    <span
      className="fumetto-ancora"
      onMouseEnter={() => {
        setDismissed(false);
        setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
      onFocus={onFocus}
      onBlur={() => setFocus(false)}
    >
      {children}
      {visible ? (
        <span className="fumetto" aria-hidden="true">
          {label}
        </span>
      ) : null}
    </span>
  );
}
