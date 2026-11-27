"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { plural } from "@/lib/i18n";
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
  bare = false,
}: {
  newCount?: number;
  current?: boolean;
  /** Bare on white, as in the headers of the phone (`.btn-icona--nudo`) */
  bare?: boolean;
}) {
  const label =
    newCount > 0
      ? plural(it.shell.notificationsNew, newCount)
      : it.shell.notifications;
  return (
    <Link
      href="/notifiche"
      className={cx("btn-icona", bare && "btn-icona--nudo")}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      <Icon name="bell" size={bare ? "l" : "m"} />
      {newCount > 0 ? (
        <span className="btn-icona__punto" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/** Magnifier link to the search page («Cerca»). */
export function SearchLink({ bare = false }: { bare?: boolean }) {
  return (
    <Link
      href="/ricerca"
      className={cx("btn-icona", bare && "btn-icona--nudo")}
      aria-label={it.shell.search}
    >
      <Icon name="search" size={bare ? "l" : "m"} />
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
