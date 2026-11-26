"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";
import { useOptionalNest } from "./NestProvider";

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
  onMedia,
}: {
  fallback: string;
  label: string;
  icon: "arrow-left" | "x";
  onMedia?: boolean;
}) {
  const router = useRouter();
  const nest = useOptionalNest();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Outside the app frame (the gallery) there is no Nest to remember the
    // path: the tab history tells whether there is a page before this one.
    const hasPrevious = nest
      ? nest.hasPreviousPage.current
      : window.history.length > 1;
    if (hasPrevious) {
      event.preventDefault();
      router.back();
    }
  };

  return (
    <Link
      href={fallback}
      className={cx("btn-freccia", onMedia && "btn-freccia--disco")}
      aria-label={label}
      onClick={handleClick}
    >
      <Icon name={icon} size="l" />
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

/**
 * "Indietro" arrow D (#503): bare on white, in a white disc (`onMedia`) over
 * a photo or a scene. No label next to it.
 */
export function BackLink({
  fallback,
  onMedia,
}: {
  fallback: string;
  onMedia?: boolean;
}) {
  return (
    <HistoryLink
      fallback={fallback}
      label={it.back}
      icon="arrow-left"
      onMedia={onMedia}
    />
  );
}

/** "Chiudi" icon button (X): same behaviour and look as `BackLink`. */
export function CloseLink({
  fallback,
  onMedia,
}: {
  fallback: string;
  onMedia?: boolean;
}) {
  return (
    <HistoryLink
      fallback={fallback}
      label={it.close}
      icon="x"
      onMedia={onMedia}
    />
  );
}
