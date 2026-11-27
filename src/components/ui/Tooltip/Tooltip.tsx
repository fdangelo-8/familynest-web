"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Balloon with the name of an icon (`.fumetto`), at the side of the control.
 * It appears with the mouse over and with the focus from the keyboard; Esc
 * hides it and leaves the focus where it is (WCAG 1.4.13). It never takes the
 * focus and is only visual: the accessible name is on the control itself.
 *
 * The balloon is drawn in the body, outside the bar that holds the control:
 * a bar that scrolls clips what sticks out of it. Its place is written as two
 * custom properties on the balloon, as the calendar of the date field does.
 * `suppressed`: the control already shows its name, no balloon.
 */
export function Tooltip({
  label,
  suppressed = false,
  children,
}: {
  label: string;
  suppressed?: boolean;
  /** The control: a link or a button */
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const balloon = useRef<HTMLSpanElement>(null);
  const visible = (hover || focus) && !dismissed && !suppressed;

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible || !anchor.current || !balloon.current) return;
    const rect = anchor.current.getBoundingClientRect();
    balloon.current.style.setProperty("--fumetto-x", `${rect.right}px`);
    balloon.current.style.setProperty(
      "--fumetto-y",
      `${rect.top + rect.height / 2}px`,
    );
  }, [visible]);

  const onFocus = (event: FocusEvent<HTMLSpanElement>) => {
    // Only the focus that comes from the keyboard (a click does not show it).
    if (!event.target.matches(":focus-visible")) return;
    setDismissed(false);
    setFocus(true);
  };

  return (
    <span
      ref={anchor}
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
      {visible
        ? createPortal(
            <span className="fumetto" aria-hidden="true" ref={balloon}>
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
