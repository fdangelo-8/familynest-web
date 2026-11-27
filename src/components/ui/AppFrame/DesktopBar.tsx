"use client";

import Link from "next/link";
import { getDesktopBarConfig } from "@/lib/app-routes";
import { it } from "@/lib/i18n/messages/it";
import { Icon } from "../Icon/Icon";
import { BackLink, NotificationsLink } from "./IconLinks";
import { useNotificationCount } from "./NotificationCount";
import { useFramePathname } from "./useFramePathname";

/**
 * Bar at the top of the computer (§6), in the area of the content, 72 px
 * high: the arrow «Indietro» on detail routes, the title of the route, then on
 * the right the field «Cerca» (it opens the search of today), the bell and,
 * where the route has it, «Nuovo impegno». Drawn only with the computer shape
 * (CSS). The title is a `p`: the pages write their own h1.
 */
export function DesktopBar({ pathname: given }: { pathname?: string }) {
  const framePathname = useFramePathname();
  // `pathname` is for the gallery, which shows the bar of a route.
  const pathname = given ?? framePathname;
  const config = getDesktopBarConfig(pathname);
  const { count } = useNotificationCount();

  return (
    <div className="barra-alto" data-testid="barra-alto">
      {config.back ? <BackLink fallback={config.back} /> : null}
      {config.title ? (
        <p className="barra-alto__titolo">{config.title}</p>
      ) : null}
      <div className="barra-alto__azioni">
        <Link
          href="/ricerca"
          className="campo-cerca-barra"
          aria-keyshortcuts={it.shell.keySearch}
        >
          <Icon name="search" />
          <span className="campo-cerca-barra__testo">{it.shell.search}</span>
          <kbd className="tasto tasto--accanto" aria-hidden="true">
            {it.shell.keySearch}
          </kbd>
        </Link>
        <NotificationsLink
          bare
          newCount={count}
          current={pathname === "/notifiche"}
        />
        {config.newEvent ? (
          <Link
            href="/aggiungi"
            className="btn-primary btn--piccolo pulsante-barra"
            aria-keyshortcuts={it.shell.keyNew}
            data-azione-barra=""
          >
            <Icon name="plus" size="s" />
            {it.shell.newEvent}
            <kbd className="tasto tasto--accanto" aria-hidden="true">
              {it.shell.keyNew}
            </kbd>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
