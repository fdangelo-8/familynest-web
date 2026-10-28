"use client";

import Link from "next/link";
import { cx } from "../cx";

export type SectionSwitcherItem = {
  key: string;
  label: string;
  href: string;
  /** Shown after the label: 1 to 99, "99+" above; hidden if absent, 0 or negative */
  count?: number;
};

export type SectionSwitcherProps = {
  /** Required accessible name of the group */
  "aria-label": string;
  /** 2 to 5 items, in the order shown */
  items: ReadonlyArray<SectionSwitcherItem>;
  /** `key` of the item of the current page */
  current: string;
  className?: string;
  "data-testid"?: string;
};

function formatCount(count: number | undefined): string | null {
  if (count === undefined || !(count > 0)) return null;
  return count > 99 ? "99+" : String(count);
}

/**
 * `.selettore` that moves between pages: the current page is a pressed
 * button that does nothing, the others are links.
 */
export function SectionSwitcher({
  items,
  current,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: SectionSwitcherProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx("selettore", className)}
      data-testid={testId}
    >
      {items.map((item) => {
        const count = formatCount(item.count);
        const content = (
          <>
            {item.label}
            {count ? (
              <span className="selettore__conteggio">{count}</span>
            ) : null}
          </>
        );
        return item.key === current ? (
          <button
            key={item.key}
            type="button"
            className="selettore__voce"
            aria-pressed="true"
          >
            {content}
          </button>
        ) : (
          <Link key={item.key} href={item.href} className="selettore__voce">
            {content}
          </Link>
        );
      })}
    </div>
  );
}
