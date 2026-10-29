"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBarConfig } from "@/lib/app-routes";
import { Icon } from "../Icon/Icon";
import { Lens } from "../Lens/Lens";
import { NestSquare } from "../NestSquare/NestSquare";
import { cx } from "../cx";
import { BackLink, NotificationsLink, SearchLink } from "./IconLinks";

/** Mobile top bar (`.barra`). Its shape follows the route. Hidden from 1024 px. */
export function AppBar() {
  const pathname = usePathname();
  const config = getBarConfig(pathname);

  if (config.kind === "section") {
    const links = config.actions.map((action) =>
      action === "bell" ? (
        <NotificationsLink key={action} />
      ) : (
        <SearchLink key={action} />
      ),
    );
    const twoActions = config.actions.length > 1;
    return (
      <header className={cx("barra", twoActions && "barra--due-azioni")}>
        <NestSquare />
        <div className="barra__centro">
          {config.center === "lens" ? (
            <Lens />
          ) : (
            <h1 className="barra__titolo t-titolo-pagina">Casa</h1>
          )}
        </div>
        {twoActions ? <div className="barra__azioni">{links}</div> : links}
      </header>
    );
  }

  return (
    <header className="barra">
      {config.kind === "close" ? (
        <Link href={config.href} className="btn-icona" aria-label="Chiudi">
          <Icon name="x" />
        </Link>
      ) : (
        <BackLink fallback={config.fallback} />
      )}
      <div className="barra__centro" />
      <span className="barra__vuoto" aria-hidden="true" />
    </header>
  );
}
