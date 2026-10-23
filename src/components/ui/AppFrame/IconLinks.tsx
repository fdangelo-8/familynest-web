"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { Icon } from "../Icon/Icon";
import { useNest } from "./NestProvider";

/** Bell link to the notifications page. Shows the red dot only with new notifications. */
export function NotificationsLink({ newCount = 0 }: { newCount?: number }) {
  const label =
    newCount > 0
      ? `Notifiche, ${newCount} ${newCount === 1 ? "nuova" : "nuove"}`
      : "Notifiche";
  return (
    <Link href="/notifiche" className="btn-icona" aria-label={label}>
      <Icon name="bell" />
      {newCount > 0 ? (
        <span className="btn-icona__punto" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/** Magnifier link to the search page. */
export function SearchLink({ label = "Cerca nel Nest" }: { label?: string }) {
  return (
    <Link href="/ricerca" className="btn-icona" aria-label={label}>
      <Icon name="search" />
    </Link>
  );
}

/**
 * "Indietro" icon button: goes back when the user came from another page of
 * the app, otherwise to the fallback route.
 */
export function BackLink({ fallback }: { fallback: string }) {
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
      aria-label="Indietro"
      onClick={handleClick}
    >
      <Icon name="arrow-left" />
    </Link>
  );
}
