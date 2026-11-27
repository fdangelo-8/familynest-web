/**
 * Single source of truth for the navigation rules of the app frame (F5 #506,
 * §2 of docs/specifiche/506-guscio-navigazione.md): one explicit row per
 * route, no generic prefixes (LEZIONI). Active entry, phone header, bottom
 * navigation, title and action of the computer bar all come from the row.
 * Pure functions, no React.
 */

import type { IconName } from "@/components/ui/Icon/icon-paths";
import { pageTitle, yourNest } from "@/lib/brand";
import { it } from "@/lib/i18n/messages/it";
import { SPACES } from "@/lib/spaces";

export type NavItem = "oggi" | "calendario" | "casa" | "spazi";
/** An entry of the navigation: the four sections and, on a computer, the profile. */
export type NavEntry = NavItem | "profilo";
export type Viewport = "mobile" | "desktop";

export const NAV_ITEMS: ReadonlyArray<{
  id: NavItem;
  label: string;
  href: string;
  icon: IconName;
  /** Message key of the single-letter shortcut (§8) */
  shortcut: "keyToday" | "keyCalendar" | "keyHome" | "keySpaces";
}> = [
  {
    id: "oggi",
    label: it.shell.today,
    href: "/oggi",
    icon: "sun",
    shortcut: "keyToday",
  },
  {
    id: "calendario",
    label: it.shell.calendar,
    href: "/calendario",
    icon: "calendar",
    shortcut: "keyCalendar",
  },
  {
    id: "casa",
    label: it.shell.home,
    href: "/casa/spesa",
    icon: "house",
    shortcut: "keyHome",
  },
  {
    id: "spazi",
    label: it.shell.spaces,
    href: "/spazi",
    icon: "layout-grid",
    shortcut: "keySpaces",
  },
];

/** Link of the profile entry of the sidebar. */
export const PROFILE_HREF = "/nest";

/** True when `pathname` is `base` or a sub-route of it. */
export function matchesPrefix(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Shape of the header of the phone for a route (§4). */
export type BarConfig =
  | {
      kind: "section";
      /** The lens «Io · Nest» on the left */
      lens: boolean;
      /** Title of the section on the left (700, 30/36) */
      title?: string;
      /**
       * The title is the h1 of the page (`h1`): only where the page does not
       * write its own on the phone (Casa).
       */
      titleIsHeading?: boolean;
    }
  | {
      kind: "detail";
      fallback: string;
      /** Title in the middle: a `p`, not a heading (the page has its own h1) */
      title?: string;
      /** The title is the page's h1 on the phone (Notifiche) */
      titleIsHeading?: boolean;
      /** Icon link on the right, instead of the page's own action */
      link?: { href: string; icon: IconName; label: string };
    }
  /** No header: the page has its own (the search on the phone) */
  | { kind: "none" };

type Desktop = {
  /** Title of the computer bar (700, 26/32); `null`: none */
  title: string | null;
  /** «Nuovo impegno» on the right */
  newEvent?: boolean;
};

type RouteDef = {
  /** Segments between slashes; `[name]` accepts one segment */
  path: string;
  /** Entry highlighted on the phone */
  nav: NavItem | null;
  /** Entry highlighted on a computer, when it is not the same */
  navDesktop?: NavEntry | null;
  phone: BarConfig | ((params: string[]) => BarConfig);
  bottomNav: boolean;
  desktop: Desktop;
  /** The computer bar has the arrow «Indietro» (detail routes) */
  back?: string | ((params: string[]) => string);
  /** Extra check on the dynamic segments */
  accepts?: (params: string[]) => boolean;
};

/** `/figli/<id>/lista-desideri` (#32): the id is a lowercase uuid. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SPACE_PATHS: readonly string[] = SPACES.map((space) => space.href);

function section(
  lens: boolean,
  title?: string,
  titleIsHeading?: boolean,
): BarConfig {
  return { kind: "section", lens, title, titleIsHeading };
}

const SETTINGS_LINK = {
  href: "/impostazioni#notifiche",
  icon: "settings-2",
  label: it.shell.notificationSettings,
} as const;

const PROFILE_ROW = {
  nav: "spazi",
  navDesktop: "profilo",
  bottomNav: false,
} as const;

/** The list of routes of the app that exist (§2). */
const ROUTES: readonly RouteDef[] = [
  {
    path: "/oggi",
    nav: "oggi",
    phone: section(true),
    bottomNav: true,
    desktop: { title: it.shell.today, newEvent: true },
  },
  {
    path: "/aggiungi",
    nav: "oggi",
    phone: section(true),
    bottomNav: true,
    desktop: { title: it.shell.today, newEvent: true },
  },
  ...["/calendario", "/calendario/giorno", "/calendario/mese"].map(
    (path): RouteDef => ({
      path,
      nav: "calendario",
      phone: section(true, it.shell.calendar),
      bottomNav: true,
      desktop: { title: it.shell.calendar, newEvent: true },
    }),
  ),
  {
    path: "/impegni/[id]",
    nav: "calendario",
    phone: { kind: "detail", fallback: "/calendario" },
    bottomNav: true,
    desktop: { title: it.shell.calendar },
    back: "/calendario",
  },
  // `/casa` only redirects to `/casa/spesa`
  ...["/casa", "/casa/spesa", "/casa/da-fare", "/casa/scadenze"].map(
    (path): RouteDef => ({
      path,
      nav: "casa",
      phone: section(false, it.shell.home, true),
      bottomNav: true,
      desktop: { title: it.shell.home },
    }),
  ),
  {
    path: "/spazi",
    nav: "spazi",
    phone: section(false, it.shell.spaces),
    bottomNav: true,
    desktop: { title: it.shell.spaces },
  },
  {
    path: "/spazi/[spazio]",
    nav: "spazi",
    phone: { kind: "detail", fallback: "/spazi" },
    bottomNav: true,
    desktop: { title: it.shell.spaces },
    back: "/spazi",
    accepts: ([space]) => SPACE_PATHS.includes(`/spazi/${space}`),
  },
  {
    path: "/figli/[id]",
    nav: "spazi",
    phone: { kind: "detail", fallback: "/nest" },
    bottomNav: true,
    desktop: { title: it.shell.spaces },
    back: "/nest",
  },
  {
    path: "/figli/[id]/lista-desideri",
    nav: "spazi",
    // Only a well-formed id goes in the address of the fallback.
    phone: ([id]) => ({
      kind: "detail",
      fallback: id && UUID.test(id) ? `/figli/${id}` : "/nest",
    }),
    bottomNav: true,
    desktop: { title: it.shell.spaces },
    back: ([id]) => (id && UUID.test(id) ? `/figli/${id}` : "/nest"),
  },
  {
    path: "/notifiche",
    nav: null,
    // «Notifiche» is the h1 of the page on the phone, and the gear leads to
    // the settings of the notifications.
    phone: {
      kind: "detail",
      fallback: "/oggi",
      title: it.shell.notifications,
      titleIsHeading: true,
      link: SETTINGS_LINK,
    },
    bottomNav: true,
    desktop: { title: it.shell.notifications },
    back: "/oggi",
  },
  // Search (#40): the field with «Annulla» is the bar.
  {
    path: "/ricerca",
    nav: null,
    phone: { kind: "none" },
    bottomNav: false,
    desktop: { title: null },
  },
  {
    path: "/nest",
    ...PROFILE_ROW,
    phone: { kind: "detail", fallback: "/spazi" },
    desktop: { title: yourNest() },
    back: "/spazi",
  },
  {
    path: "/profilo",
    ...PROFILE_ROW,
    phone: {
      kind: "detail",
      fallback: "/nest",
      title: it.shell.profileTitle,
    },
    desktop: { title: it.shell.profileTitle },
    back: "/nest",
  },
  {
    path: "/impostazioni",
    ...PROFILE_ROW,
    phone: {
      kind: "detail",
      fallback: "/nest",
      title: it.shell.settingsTitle,
    },
    desktop: { title: it.shell.settingsTitle },
    back: "/nest",
  },
  {
    path: "/calendari-collegati",
    ...PROFILE_ROW,
    phone: { kind: "detail", fallback: "/nest" },
    desktop: { title: it.shell.linkedCalendarsTitle },
    back: "/nest",
  },
  {
    path: "/membri",
    ...PROFILE_ROW,
    phone: { kind: "detail", fallback: "/nest" },
    desktop: { title: it.shell.membersTitle },
    back: "/nest",
  },
  {
    path: "/membri/[id]",
    ...PROFILE_ROW,
    phone: { kind: "detail", fallback: "/nest" },
    desktop: { title: it.shell.membersTitle },
    back: "/nest",
  },
];

/** An address that is not on the list: the 404 inside the frame. */
const UNKNOWN: RouteDef = {
  path: "",
  nav: null,
  phone: { kind: "detail", fallback: "/oggi" },
  bottomNav: true,
  desktop: { title: null },
  back: "/oggi",
};

const BASE = "https://app.invalid";

/**
 * The `pathname` of a raw address, or null when it is not a path of this app
 * (no leading slash, another origin, `//`). Same normalisation as `isAppPath`
 * (LEZIONI: `new URL(raw, base)`, then rules on the pathname).
 */
function normalize(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const { pathname } = url;
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

type Match = { route: RouteDef; params: string[] };

function matchRoute(pathname: string): Match | null {
  const segments = pathname.split("/").slice(1);
  for (const route of ROUTES) {
    const pattern = route.path.split("/").slice(1);
    if (pattern.length !== segments.length) continue;
    const params: string[] = [];
    const fits = pattern.every((part, index) => {
      const segment = segments[index] ?? "";
      if (part.startsWith("[")) {
        if (segment === "") return false;
        params.push(segment);
        return true;
      }
      return part === segment;
    });
    if (fits && (route.accepts?.(params) ?? true)) return { route, params };
  }
  return null;
}

/** The route of `pathname`, or the 404 row. */
function resolve(pathname: string): Match {
  return (
    matchRoute(normalize(pathname) ?? pathname) ?? {
      route: UNKNOWN,
      params: [],
    }
  );
}

/**
 * True for an address that is a route of the app that exists: the rows of the
 * list above (one segment for each `[name]`), with a final slash, a query or a
 * fragment accepted. False for the redirects that are not rows (`/esplora`),
 * for rows not yet on the list and for anything that is not a plain path.
 */
export function hasAppRoute(pathname: string): boolean {
  const normalized = normalize(pathname);
  return normalized !== null && matchRoute(normalized) !== null;
}

const PUBLIC_EXACT = ["/accesso", "/onboarding", "/privacy", "/termini"];
const PUBLIC_PREFIX = ["/accesso", "/onboarding", "/invito"];
const WISHLIST_PUBLIC = /^\/desideri\/[^/]+$/;

/**
 * True for the routes of the app and the public ones (`/accesso/*`,
 * `/onboarding/*`, `/invito/*`, `/desideri/<code>`, `/privacy`, `/termini`):
 * the native shell opens only these inside the app (§10).
 */
export function isAppPath(pathname: string): boolean {
  const normalized = normalize(pathname);
  if (normalized === null) return false;
  if (matchRoute(normalized) !== null) return true;
  if (PUBLIC_EXACT.includes(normalized)) return true;
  if (PUBLIC_PREFIX.some((base) => matchesPrefix(normalized, base))) {
    return true;
  }
  return WISHLIST_PUBLIC.test(normalized);
}

// The ten «In arrivo» pages of Spazi (#29): explicit list, not a prefix, so
// that an address like /spazi/palestra is not highlighted.
/** `/spazi/<space>` for one of the ten spaces of the catalogue. */
export function isSpaceRoute(pathname: string): boolean {
  return SPACE_PATHS.includes(pathname);
}

const CASA_ROUTES = ["/casa/spesa", "/casa/da-fare", "/casa/scadenze"];

/** Known Casa pages only: an unknown address under /casa is a 404, not Casa. */
export function isCasaRoute(pathname: string): boolean {
  return CASA_ROUTES.includes(normalize(pathname) ?? pathname);
}

/**
 * Entry highlighted in the bottom navigation and, on a computer, in the
 * sidebar. On a computer the pages of the Nest highlight the profile.
 */
export function getActiveNavItem(
  pathname: string,
  viewport: Viewport,
): NavEntry | null {
  const { route } = resolve(pathname);
  if (viewport === "desktop" && route.navDesktop !== undefined) {
    return route.navDesktop;
  }
  return route.nav;
}

/**
 * Value of `aria-current` for a navigation entry. "page" only when the
 * address is exactly the entry's link; "true" when the entry is highlighted
 * for a related page (so a screen reader does not say "current page").
 * At most one entry is active, so at most one gets a value.
 */
export function getNavAriaCurrent(
  pathname: string,
  viewport: Viewport,
  item: NavEntry,
): "page" | "true" | undefined {
  if (getActiveNavItem(pathname, viewport) !== item) return undefined;
  const href =
    item === "profilo"
      ? PROFILE_HREF
      : NAV_ITEMS.find((candidate) => candidate.id === item)?.href;
  return normalize(pathname) === href ? "page" : "true";
}

const NO_TODAY_LINK_ON_ERROR = ["/oggi", "/onboarding"] as const;

/**
 * The page-wide error offers "Torna a Oggi" everywhere except on Oggi itself
 * (same page as "Riprova") and in the onboarding (Oggi does not exist yet
 * for whoever is there).
 */
export function hasTodayLinkOnError(pathname: string): boolean {
  return !NO_TODAY_LINK_ON_ERROR.some((base) => matchesPrefix(pathname, base));
}

/** The bottom navigation is hidden on the routes where the row says no. */
export function hasBottomNav(pathname: string): boolean {
  return resolve(pathname).route.bottomNav;
}

export type SettingsItem =
  "profilo" | "calendari-collegati" | "impostazioni" | "membri";

/** Entry of the desktop settings menu that is current (the last one never is). */
export function getActiveSettingsItem(pathname: string): SettingsItem | null {
  if (matchesPrefix(pathname, "/profilo")) return "profilo";
  if (matchesPrefix(pathname, "/calendari-collegati")) {
    return "calendari-collegati";
  }
  if (matchesPrefix(pathname, "/impostazioni")) return "impostazioni";
  if (matchesPrefix(pathname, "/membri")) return "membri";
  return null;
}

/** Shape of the header of the phone for a route. */
export function getBarConfig(pathname: string): BarConfig {
  const { route, params } = resolve(pathname);
  return typeof route.phone === "function" ? route.phone(params) : route.phone;
}

export type DesktopBarConfig = {
  title: string | null;
  newEvent: boolean;
  /** Fallback of the arrow «Indietro»; `null`: no arrow */
  back: string | null;
};

/** Title, button and arrow of the computer bar for a route. */
export function getDesktopBarConfig(pathname: string): DesktopBarConfig {
  const { route, params } = resolve(pathname);
  const back =
    typeof route.back === "function" ? route.back(params) : route.back;
  return {
    title: route.desktop.title,
    newEvent: route.desktop.newEvent === true,
    back: back ?? null,
  };
}

export type PlaceholderKey =
  | "oggi"
  | "aggiungi"
  | "calendario"
  | "calendario-giorno"
  | "calendario-mese"
  | "impegno"
  | "casa"
  | "casa-da-fare"
  | "casa-scadenze"
  | "nest"
  | "notifiche"
  | "ricerca"
  | "profilo"
  | "calendari-collegati"
  | "impostazioni"
  | "membri";

export type PlaceholderDef = {
  /** h1 text */
  title: string;
  /** Browser tab title */
  browserTitle: string;
  icon:
    | "house"
    | "plus"
    | "calendar"
    | "shopping-basket"
    | "square-check"
    | "file-clock"
    | "users"
    | "compass"
    | "bell"
    | "search"
    | "user-round"
    | "calendar-arrow-down";
  text: string;
  /** Show the "Torna a Oggi" link */
  backToToday: boolean;
};

const COMING = "Stiamo preparando questa pagina.";

export const PLACEHOLDERS: Record<PlaceholderKey, PlaceholderDef> = {
  oggi: {
    title: "Oggi",
    browserTitle: pageTitle("Oggi"),
    icon: "house",
    text: `Qui vedrai la giornata di casa: il prossimo impegno, la spesa e le cose da fare. ${COMING}`,
    backToToday: false,
  },
  aggiungi: {
    title: "Aggiungi",
    browserTitle: pageTitle("Aggiungi"),
    icon: "plus",
    text: `Da qui aggiungerai impegni, spesa, cose da fare e scadenze. ${COMING}`,
    backToToday: true,
  },
  calendario: {
    title: "Calendario",
    browserTitle: pageTitle("Calendario"),
    icon: "calendar",
    text: `Qui vedrai gli impegni di tutta la casa, per giorno, settimana e mese. ${COMING}`,
    backToToday: true,
  },
  // Until #26 (Giorno), #27 (Mese) and #19 (Dettaglio impegno) are built.
  "calendario-giorno": {
    title: "Calendario",
    browserTitle: pageTitle("Calendario"),
    icon: "calendar",
    text: `Qui vedrai gli impegni di un giorno, ora per ora. ${COMING}`,
    backToToday: true,
  },
  "calendario-mese": {
    title: "Calendario",
    browserTitle: pageTitle("Calendario"),
    icon: "calendar",
    text: `Qui vedrai gli impegni del mese, giorno per giorno. ${COMING}`,
    backToToday: true,
  },
  impegno: {
    title: "Impegno",
    browserTitle: pageTitle("Impegno"),
    icon: "calendar",
    text: `Qui vedrai i dettagli di un impegno. ${COMING}`,
    backToToday: true,
  },
  casa: {
    title: "Casa",
    browserTitle: pageTitle("Casa", "Spesa"),
    icon: "shopping-basket",
    text: `Qui ci saranno la spesa, le cose da fare e le scadenze di casa. ${COMING}`,
    backToToday: true,
  },
  "casa-da-fare": {
    title: "Casa",
    browserTitle: pageTitle("Casa", "Da fare"),
    icon: "square-check",
    text: `Qui ci saranno le cose da fare della casa. ${COMING}`,
    backToToday: true,
  },
  "casa-scadenze": {
    title: "Casa",
    browserTitle: pageTitle("Casa", "Scadenze"),
    icon: "file-clock",
    text: `Qui ci saranno le scadenze della casa. ${COMING}`,
    backToToday: true,
  },
  nest: {
    title: yourNest(),
    browserTitle: pageTitle(yourNest()),
    icon: "users",
    text: `Qui troverai le persone di casa, Esplora e le impostazioni. ${COMING}`,
    backToToday: true,
  },
  notifiche: {
    title: "Notifiche",
    browserTitle: pageTitle("Notifiche"),
    icon: "bell",
    text: `Qui vedrai cosa è cambiato in casa e la sintesi del mattino. ${COMING}`,
    backToToday: true,
  },
  ricerca: {
    title: "Ricerca",
    browserTitle: pageTitle("Ricerca"),
    icon: "search",
    text: `Da qui cercherai impegni, spesa, cose da fare e scadenze. ${COMING}`,
    backToToday: true,
  },
  profilo: {
    title: "Il tuo profilo",
    browserTitle: pageTitle("Il tuo profilo"),
    icon: "user-round",
    text: `Qui sceglierai il tuo nome, il tuo colore e cosa vedere all'apertura. ${COMING}`,
    backToToday: true,
  },
  "calendari-collegati": {
    title: "Calendari collegati",
    browserTitle: pageTitle("Calendari collegati"),
    icon: "calendar-arrow-down",
    text: `Da qui collegherai Outlook, Google e iCloud al calendario di casa. ${COMING}`,
    backToToday: true,
  },
  impostazioni: {
    title: "Impostazioni della casa",
    browserTitle: pageTitle("Impostazioni della casa"),
    icon: "house",
    text: `Qui sceglierai il nome della casa e le notifiche. ${COMING}`,
    backToToday: true,
  },
  membri: {
    title: "Chi c’è",
    browserTitle: pageTitle("Chi c’è"),
    icon: "users",
    text: `Qui vedrai chi c'è nel Nest e potrai invitare qualcuno. ${COMING}`,
    backToToday: true,
  },
};
