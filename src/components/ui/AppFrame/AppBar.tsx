"use client";

import { getBarConfig } from "@/lib/app-routes";
import { Lens } from "../Lens/Lens";
import { NestSquare } from "../NestSquare/NestSquare";
import { cx } from "../cx";
import { BarActionSlot } from "./BarAction";
import {
  BackLink,
  BarIconLink,
  CloseLink,
  NotificationsLink,
  SearchLink,
} from "./IconLinks";
import { useNotificationCount } from "./NotificationCount";
import { useFramePathname } from "./useFramePathname";

/** Mobile top bar (`.barra`). Its shape follows the route. Hidden from 1024 px. */
export function AppBar() {
  const pathname = useFramePathname();
  const config = getBarConfig(pathname);
  const { count } = useNotificationCount();

  if (config.kind === "none") return null;

  if (config.kind === "section") {
    const links = config.actions.map((action) =>
      action === "bell" ? (
        <NotificationsLink key={action} newCount={count} />
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
      <div className="barra__centro">
        {config.kind === "detail" && config.title ? (
          config.titleIsHeading ? (
            <h1 className="barra__titolo">{config.title}</h1>
          ) : (
            <p className="barra__titolo">{config.title}</p>
          )
        ) : null}
      </div>
      {config.kind === "detail" ? (
        config.link ? (
          <BarIconLink {...config.link} />
        ) : config.search ? (
          <SearchLink />
        ) : (
          <BarActionSlot />
        )
      ) : (
        <span className="barra__vuoto" aria-hidden="true" />
      )}
    </header>
  );
}
