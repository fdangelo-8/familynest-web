"use client";

import Link from "next/link";
import {
  NAV_ITEMS,
  getActiveNavItem,
  getNavAriaCurrent,
  hasAppRoute,
  PROFILE_HREF,
} from "@/lib/app-routes";
import { BRAND, brandText, yourNest } from "@/lib/brand";
import { it } from "@/lib/i18n/messages/it";
import { Avatar } from "../Avatar/Avatar";
import { Brand } from "../Brand/Brand";
import { Icon, type IconName } from "../Icon/Icon";
import { Lens, useLens } from "../Lens/Lens";
import { Tooltip } from "../Tooltip/Tooltip";
import { cx } from "../cx";
import { useNest } from "./NestProvider";
import { useFramePathname } from "./useFramePathname";

/** The shortcuts of «Di casa»: Ricette and Animali only when their route exists (§5). */
const HOME_SHORTCUTS: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName;
}> = [
  {
    href: "/casa/spesa",
    label: it.shell.shopping,
    icon: "shopping-basket",
  },
  { href: "/ricette", label: it.shell.recipes, icon: "utensils" },
  { href: "/animali", label: it.shell.animals, icon: "paw-print" },
];

/** The lens as one dot, in the narrow bar: a click goes to the other choice. */
function LensDot() {
  const { me, members } = useNest();
  const [lens, setLens] = useLens();
  const next = lens === "io" ? "nest" : "io";
  const label = lens === "io" ? it.shell.lensMe : brandText(it.shell.lensNest);
  const first = members[0];
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className="voce-barra voce-barra--lente"
        aria-label={label}
        onClick={() => setLens(next)}
      >
        {lens === "io" && me ? (
          <Avatar name={me.name} color={me.color} size="m" nameShown />
        ) : first ? (
          <span className="quadrato-nest quadrato-nest--statico">
            {members.slice(0, 4).map((member, index) => (
              <span
                key={index}
                className={`quadrato-nest__punto membro-${member.color}`}
                aria-hidden="true"
              />
            ))}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

/**
 * The sidebar of the computer (§5): full (248 px) from 1280 px, icons only
 * (72 px) from 900 to 1279 px and with a panel open. Drawn only with the
 * computer shape (CSS). The names of the entries stay in the links, visually
 * clipped in the narrow bar, so the accessible name is always the full one.
 * «Chiedi a Nest» is not drawn until B15 (#386) is merged (`ASSISTANT_AVAILABLE`).
 */
export function SideNav({ spacesNews = false }: { spacesNews?: boolean }) {
  const pathname = useFramePathname();
  const { me } = useNest();
  const active = getActiveNavItem(pathname, "desktop");
  const homeShortcuts = HOME_SHORTCUTS.filter((entry) =>
    hasAppRoute(entry.href),
  );

  return (
    <div className="barra-laterale" data-testid="barra-laterale">
      <div className="barra-laterale__marchio">
        <span className="barra-laterale__scritta">
          <Brand />
        </span>
        <span
          className="barra-laterale__segno"
          role="img"
          aria-label={BRAND.full}
        >
          {BRAND.wordmark.nest.charAt(0)}
        </span>
      </div>

      <div className="barra-laterale__lente">
        <Lens />
      </div>
      <div className="barra-laterale__lente-icone">
        <LensDot />
      </div>

      <nav className="barra-laterale__voci" aria-label={it.shell.mainNav}>
        {NAV_ITEMS.map((item) => {
          const news = item.id === "spazi" && spacesNews;
          return (
            <Tooltip key={item.id} label={item.label}>
              <Link
                href={item.href}
                className={cx("voce-barra", active === item.id && "is-attiva")}
                aria-current={getNavAriaCurrent(pathname, "desktop", item.id)}
                aria-keyshortcuts={it.shell[item.shortcut]}
                aria-label={news ? it.shell.spacesNews : undefined}
              >
                <span className="voce-barra__icona">
                  <Icon name={item.icon} />
                  {news ? (
                    <span className="voce-barra__punto" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="voce-barra__etichetta">{item.label}</span>
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      <p className="barra-laterale__titoletto">{it.shell.groupHome}</p>
      <nav className="barra-laterale__voci" aria-label={it.shell.homeNav}>
        {homeShortcuts.map((entry) => (
          <Tooltip key={entry.href} label={entry.label}>
            <Link href={entry.href} className="voce-barra">
              <span className="voce-barra__icona">
                <Icon name={entry.icon} />
              </span>
              <span className="voce-barra__etichetta">{entry.label}</span>
            </Link>
          </Tooltip>
        ))}
      </nav>

      <div className="barra-laterale__fondo">
        <Tooltip label={me ? me.name : yourNest()}>
          <Link
            href={PROFILE_HREF}
            className="barra-laterale__profilo"
            aria-current={getNavAriaCurrent(pathname, "desktop", "profilo")}
            aria-label={
              me
                ? brandText(it.shell.profileName, { name: me.name })
                : yourNest()
            }
          >
            {me ? (
              <Avatar name={me.name} color={me.color} size="m" nameShown />
            ) : null}
            <span className="barra-laterale__profilo-testi">
              {me ? (
                <span className="barra-laterale__profilo-nome">{me.name}</span>
              ) : null}{" "}
              {/* The space keeps the visible text inside the name (axe) */}
              <span className="barra-laterale__profilo-sotto">
                {yourNest()}
              </span>
            </span>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}
