"use client";

import { useEffect, useState } from "react";
import { getBarConfig } from "@/lib/app-routes";
import { Lens } from "../Lens/Lens";
import { BarActionSlot } from "./BarAction";
import {
  BackLink,
  BarIconLink,
  NotificationsLink,
  SearchLink,
} from "./IconLinks";
import { useNotificationCount } from "./NotificationCount";
import { useFramePathname } from "./useFramePathname";

/**
 * Header of the phone (§4), drawn only with the phone shape (CSS). The shape
 * follows the route: a section (Oggi, Calendario, Casa, Spazi) has the lens or
 * the title and the bare «Cerca» and «Notifiche»; a detail has the arrow
 * «Indietro» and the page's own action. When the header of a section scrolls
 * out of the screen, a white bar of 56 px with the same controls stays on top
 * (`og1-03`); back at the top it goes away.
 */
export function PhoneHeader({ pathname: given }: { pathname?: string }) {
  const framePathname = useFramePathname();
  // `pathname` is for the gallery, which shows the header of a route.
  const pathname = given ?? framePathname;
  const config = getBarConfig(pathname);
  const { count } = useNotificationCount();
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [scrolledAway, setScrolledAway] = useState(false);

  useEffect(() => {
    if (!header) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setScrolledAway(
        !entry.isIntersecting && entry.boundingClientRect.bottom <= 0,
      );
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [header]);

  if (config.kind === "none") return null;

  if (config.kind === "section") {
    const collapsed = scrolledAway;
    const title = config.title ? (
      config.titleIsHeading ? (
        <h1 className="testata__titolo">{config.title}</h1>
      ) : (
        <p className="testata__titolo">{config.title}</p>
      )
    ) : null;
    const controls = (
      <div className="testata__azioni">
        <SearchLink bare />
        <NotificationsLink bare newCount={count} />
      </div>
    );
    return (
      <>
        <header
          className="testata testata--sezione"
          data-testid="testata"
          ref={setHeader}
          inert={collapsed}
        >
          {/* DOM order is the order of Tab: title or lens, the lens of a
              titled section, then «Cerca» and «Notifiche» */}
          <div className="testata__sinistra">
            {title ?? (config.lens ? <Lens /> : null)}
          </div>
          {title && config.lens ? (
            <div className="testata__lente">
              <Lens />
            </div>
          ) : null}
          {controls}
        </header>
        {collapsed ? (
          <div className="testata-raccolta" data-testid="testata-raccolta">
            {config.title ? (
              <p className="testata-raccolta__titolo">{config.title}</p>
            ) : (
              <Lens />
            )}
            <div className="testata__azioni">
              <SearchLink bare />
              <NotificationsLink bare newCount={count} />
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <header className="testata testata--dettaglio" data-testid="testata">
      <BackLink fallback={config.fallback} />
      <div className="testata__centro">
        {config.title ? (
          config.titleIsHeading ? (
            <h1 className="testata__titolo-centro">{config.title}</h1>
          ) : (
            <p className="testata__titolo-centro">{config.title}</p>
          )
        ) : null}
      </div>
      {config.link ? <BarIconLink {...config.link} /> : <BarActionSlot />}
    </header>
  );
}
