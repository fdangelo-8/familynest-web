"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import { useNest } from "./NestProvider";

/**
 * Bell link to the notifications page. Shows the red dot only with new
 * notifications. `current` is true on the notifications page itself
 * (`aria-current="page"`, no change of look).
 */
export function NotificationsLink({
  newCount = 0,
  current = false,
}: {
  newCount?: number;
  current?: boolean;
}) {
  const label =
    newCount > 0
      ? `Notifiche, ${newCount} ${newCount === 1 ? "nuova" : "nuove"}`
      : "Notifiche";
  return (
    <Link
      href="/notifiche"
      className="btn-icona"
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      <Icon name="bell" />
      {newCount > 0 ? (
        <span className="btn-icona__punto" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/**
 * Magnifier link to the search page. On desktop it also announces the
 * shortcut (`shortcut`: `aria-keyshortcuts`), because not every screen reader
 * reads «⌘» in the name.
 */
export function SearchLink({
  label = "Cerca nel Nest",
  shortcut = false,
}: {
  label?: string;
  shortcut?: boolean;
}) {
  return (
    <Link
      href="/ricerca"
      className="btn-icona"
      aria-label={label}
      aria-keyshortcuts={shortcut ? "Control+K Meta+K" : undefined}
    >
      <Icon name="search" />
    </Link>
  );
}

/**
 * Icon link that goes back when the user came from another page of the app,
 * otherwise to the fallback route.
 */
function HistoryLink({
  fallback,
  label,
  icon,
}: {
  fallback: string;
  label: string;
  icon: "arrow-left" | "x";
}) {
  const router = useRouter();
  const { hasPreviousPage } = useNest();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (hasPreviousPage.current) {
      event.preventDefault();
      router.back();
    }
  };

  return (
    <Link
      href={fallback}
      className="btn-icona"
      aria-label={label}
      onClick={handleClick}
    >
      <Icon name={icon} />
    </Link>
  );
}

/** Icon link to another page, on the right of a detail bar («Impostazioni delle notifiche»). */
export function BarIconLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: IconName;
  /** Accessible name, written as the action */
  label: string;
}) {
  return (
    <Link href={href} className="btn-icona" aria-label={label}>
      <Icon name={icon} />
    </Link>
  );
}

/** "Indietro" icon button (arrow). */
export function BackLink({ fallback }: { fallback: string }) {
  return <HistoryLink fallback={fallback} label="Indietro" icon="arrow-left" />;
}

/** "Chiudi" icon button (X): same behaviour as `BackLink`. */
export function CloseLink({ fallback }: { fallback: string }) {
  return <HistoryLink fallback={fallback} label="Chiudi" icon="x" />;
}
