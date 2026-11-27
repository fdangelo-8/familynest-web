"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";

export type ChipScrollProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
};

/**
 * The line of chips that scrolls sideways (`.gruppo-chip--scorre`). While
 * there is more on the right, the last chip fades (`.gruppo-chip--sfuma`);
 * at the end, or when everything fits, the fade is gone. Decided here from
 * the scroll position and the size, so pages do nothing.
 */
export function ChipScroll({
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "data-testid": testId,
}: ChipScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  // After every render and on resize: the content may have changed.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      // One pixel of tolerance for the fractions of a scaled screen.
      setMore(node.scrollWidth - node.clientWidth - node.scrollLeft > 1);
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  });

  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cx(
        "gruppo-chip",
        "gruppo-chip--scorre",
        more && "gruppo-chip--sfuma",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
