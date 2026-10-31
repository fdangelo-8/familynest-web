"use client";

import { getBarConfig } from "@/lib/app-routes";
import { Lens } from "../Lens/Lens";
import { NestSquare } from "../NestSquare/NestSquare";
import { cx } from "../cx";
import {
  BackLink,
  CloseLink,
  NotificationsLink,
  SearchLink,
} from "./IconLinks";
import { useFramePathname } from "./useFramePathname";

/** Mobile top bar (`.barra`). Its shape follows the route. Hidden from 1024 px. */
export function AppBar() {
  const pathname = useFramePathname();
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
        <CloseLink fallback={config.href} />
      ) : (
        <BackLink fallback={config.fallback} />
      )}
      <div className="barra__centro" />
      <span className="barra__vuoto" aria-hidden="true" />
    </header>
  );
}
