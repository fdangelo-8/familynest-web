"use client";

import Link from "next/link";
import {
  NAV_ITEMS,
  getActiveNavItem,
  getNavAriaCurrent,
  hasBottomNav,
} from "@/lib/app-routes";
import { it } from "@/lib/i18n/messages/it";
import { cx } from "../cx";
import { Icon } from "../Icon/Icon";
import { useFramePathname } from "./useFramePathname";

/**
 * The floating capsule of the phone (§3): four entries, icon above and label
 * below; the chosen one is bold with the filled icon. `spacesNews` puts the
 * red dot on Spazi and changes its name («Spazi, ci sono novità»).
 */
export function BottomNavView({
  pathname,
  spacesNews = false,
}: {
  pathname: string;
  spacesNews?: boolean;
}) {
  const active = getActiveNavItem(pathname, "mobile");
  return (
    <nav className="barra-basso" aria-label={it.shell.mainNav}>
      <div className="barra-basso__voci">
        {NAV_ITEMS.map((item) => {
          const news = item.id === "spazi" && spacesNews;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cx(
                "barra-basso__voce",
                active === item.id && "is-attiva",
              )}
              aria-current={getNavAriaCurrent(pathname, "mobile", item.id)}
              aria-label={news ? it.shell.spacesNews : undefined}
            >
              <span className="barra-basso__icona">
                <Icon name={item.icon} size="l" />
                {news ? (
                  <span className="barra-basso__punto" aria-hidden="true" />
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Bottom navigation of the app, drawn only with the phone shape (CSS) and on
 * the routes that have it. The news dot waits for DB-7 (#516) and B5 (#564):
 * until then it is always off.
 */
export function BottomNav() {
  const pathname = useFramePathname();
  if (!hasBottomNav(pathname)) return null;
  return <BottomNavView pathname={pathname} />;
}
