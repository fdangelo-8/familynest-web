"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveSettingsItem } from "@/lib/app-routes";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { useNest } from "./NestProvider";

/** Settings side menu (`.menu-laterale`), desktop only: pages 26 to 29. */
export function SettingsMenu() {
  const pathname = usePathname();
  const { nestName } = useNest();
  const active = getActiveSettingsItem(pathname);

  const itemProps = (id: NonNullable<typeof active>) => ({
    className: cx("menu-laterale__voce", active === id && "is-attiva"),
    "aria-current": active === id ? ("page" as const) : undefined,
  });

  return (
    <nav className="menu-laterale" aria-label="Impostazioni">
      <Link href="/profilo" {...itemProps("profilo")}>
        <Icon name="user-round" />
        Il tuo profilo
      </Link>
      <Link href="/calendari-collegati" {...itemProps("calendari-collegati")}>
        <Icon name="calendar-arrow-down" />
        Calendari collegati
      </Link>
      <span className="menu-laterale__separatore" aria-hidden="true" />
      <Link href="/impostazioni" {...itemProps("impostazioni")}>
        <Icon name="house" />
        {nestName ?? "Il tuo Nest"}
      </Link>
      <Link href="/membri" {...itemProps("membri")}>
        <Icon name="users" />
        Chi c’è
      </Link>
      <Link href="/impostazioni#notifiche" className="menu-laterale__voce">
        <Icon name="bell" />
        Notifiche
      </Link>
    </nav>
  );
}
