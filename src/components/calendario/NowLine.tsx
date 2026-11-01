"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The red line of the current time in a grid that starts at 8:00. The position
 * is a CSS variable set from here, never `style=`.
 */
export function NowLine({ hours, label }: { hours: number; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty("--adesso-ore", String(hours));
  }, [hours]);
  return (
    <span
      ref={ref}
      className="linea-adesso"
      role="img"
      aria-label={label}
      data-testid="linea-adesso"
    />
  );
}
