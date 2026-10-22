"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getActiveNavItem, hasBottomNav } from "@/lib/app-routes";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon/Icon";

const ICONS: Record<(typeof NAV_ITEMS)[number]["id"], IconName> = {
  oggi: "house",
  calendario: "calendar",
  casa: "shopping-basket",
};

/** Mobile bottom navigation with the "Aggiungi" button. Hidden from 1024 px. */
export function BottomNav() {
  const pathname = usePathname();
  if (!hasBottomNav(pathname)) return null;
  const active = getActiveNavItem(pathname, "mobile");

  return (
    <nav className="nav-basso" aria-label="Navigazione principale">
      <div className="nav-basso__voci">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cx("nav-basso__voce", active === item.id && "is-attiva")}
            aria-current={active === item.id ? "page" : undefined}
          >
            <Icon name={ICONS[item.id]} />
            {item.label}
          </Link>
        ))}
      </div>
      <Link href="/aggiungi" className="btn-aggiungi">
        <span className="btn-aggiungi__piu">
          <Icon name="plus" size="s" />
        </span>
        Aggiungi
      </Link>
    </nav>
  );
}
