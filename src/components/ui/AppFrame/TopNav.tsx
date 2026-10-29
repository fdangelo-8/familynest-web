"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_ITEMS,
  getActiveNavItem,
  getNavAriaCurrent,
} from "@/lib/app-routes";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { NestSquare } from "../NestSquare/NestSquare";
import { NotificationsLink, SearchLink } from "./IconLinks";

/** Desktop top navigation (`.nav-alto`). Hidden below 1024 px. */
export function TopNav() {
  const pathname = usePathname();
  const active = getActiveNavItem(pathname, "desktop");

  return (
    <header className="nav-alto">
      <Link href="/oggi" className="nav-alto__logo">
        FamilyNest
      </Link>
      <nav className="nav-alto__voci" aria-label="Navigazione principale">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cx("nav-alto__voce", active === item.id && "is-attiva")}
            aria-current={getNavAriaCurrent(pathname, "desktop", item.id)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="nav-alto__azioni">
        <Link href="/aggiungi" className="btn-aggiungi btn-aggiungi--desktop">
          <span className="btn-aggiungi__piu">
            <Icon name="plus" size="s" />
          </span>
          Aggiungi
        </Link>
        <SearchLink label="Cerca nel Nest (⌘K)" />
        <NotificationsLink />
        <NestSquare />
      </div>
    </header>
  );
}
