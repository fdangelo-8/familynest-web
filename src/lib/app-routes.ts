/**
 * Single source of truth for the navigation rules of the app frame:
 * active entries, bottom navigation visibility, top bar shape and
 * placeholder pages. Pure functions, no React.
 */

export type NavItem = "oggi" | "calendario" | "casa";
export type Viewport = "mobile" | "desktop";

export const NAV_ITEMS: ReadonlyArray<{
  id: NavItem;
  label: string;
  href: string;
}> = [
  { id: "oggi", label: "Oggi", href: "/oggi" },
  { id: "calendario", label: "Calendario", href: "/calendario" },
  { id: "casa", label: "Casa", href: "/casa/spesa" },
];

/** True when `pathname` is `base` or a sub-route of it. */
export function matchesPrefix(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function matchesAny(pathname: string, bases: readonly string[]): boolean {
  return bases.some((base) => matchesPrefix(pathname, base));
}

// Only the pages that exist: new Casa pages must be added here (explicit
// list, not a prefix).
const CASA_ROUTES = ["/casa/spesa", "/casa/da-fare", "/casa/scadenze"];

/** Known Casa pages only: an unknown address under /casa is a 404, not Casa. */
export function isCasaRoute(pathname: string): boolean {
  return matchesAny(pathname, CASA_ROUTES);
}

/** Entry highlighted in the bottom (mobile) or top (desktop) navigation. */
export function getActiveNavItem(
  pathname: string,
  viewport: Viewport,
): NavItem | null {
  if (matchesAny(pathname, ["/calendario", "/impegni"])) return "calendario";
  if (isCasaRoute(pathname)) return "casa";
  if (matchesAny(pathname, ["/oggi", "/aggiungi"])) return "oggi";
  if (viewport === "mobile") {
    if (matchesAny(pathname, ["/esplora", "/figli", "/notifiche"])) {
      return "oggi";
    }
  } else if (matchesPrefix(pathname, "/ricerca")) {
    return "oggi";
  }
  return null;
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
  item: NavItem,
): "page" | "true" | undefined {
  if (getActiveNavItem(pathname, viewport) !== item) return undefined;
  const entry = NAV_ITEMS.find((candidate) => candidate.id === item);
  return entry && pathname === entry.href ? "page" : "true";
}

const NO_TODAY_LINK_ON_ERROR = ["/oggi", "/onboarding"] as const;

/**
 * The page-wide error offers "Torna a Oggi" everywhere except on Oggi itself
 * (same page as "Riprova") and in the onboarding (Oggi does not exist yet
 * for whoever is there).
 */
export function hasTodayLinkOnError(pathname: string): boolean {
  return !matchesAny(pathname, NO_TODAY_LINK_ON_ERROR);
}

const NO_BOTTOM_NAV = [
  "/nest",
  "/ricerca",
  "/profilo",
  "/calendari-collegati",
  "/impostazioni",
  "/membri",
] as const;

/** The bottom navigation is hidden on these routes (mockup). */
export function hasBottomNav(pathname: string): boolean {
  return !matchesAny(pathname, NO_BOTTOM_NAV);
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

export type BarConfig =
  | {
      kind: "section";
      center: "lens" | "title";
      /** Icon links on the right, in order */
      actions: ReadonlyArray<"search" | "bell">;
    }
  | { kind: "detail"; fallback: string }
  | { kind: "close"; href: string };

/** Shape of the mobile top bar for a route. */
export function getBarConfig(pathname: string): BarConfig {
  if (matchesAny(pathname, ["/oggi", "/aggiungi"])) {
    return { kind: "section", center: "lens", actions: ["bell"] };
  }
  if (matchesPrefix(pathname, "/calendario")) {
    return { kind: "section", center: "lens", actions: ["search", "bell"] };
  }
  if (isCasaRoute(pathname)) {
    return { kind: "section", center: "title", actions: ["search", "bell"] };
  }
  if (matchesPrefix(pathname, "/nest")) {
    return { kind: "close", href: "/oggi" };
  }
  if (
    matchesAny(pathname, [
      "/profilo",
      "/calendari-collegati",
      "/impostazioni",
      "/membri",
    ])
  ) {
    return { kind: "detail", fallback: "/nest" };
  }
  return { kind: "detail", fallback: "/oggi" };
}

export type PlaceholderKey =
  | "oggi"
  | "aggiungi"
  | "calendario"
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
    browserTitle: "FamilyNest · Oggi",
    icon: "house",
    text: `Qui vedrai la giornata di casa: il prossimo impegno, la spesa e le cose da fare. ${COMING}`,
    backToToday: false,
  },
  aggiungi: {
    title: "Aggiungi",
    browserTitle: "FamilyNest · Aggiungi",
    icon: "plus",
    text: `Da qui aggiungerai impegni, spesa, cose da fare e scadenze. ${COMING}`,
    backToToday: true,
  },
  calendario: {
    title: "Calendario",
    browserTitle: "FamilyNest · Calendario",
    icon: "calendar",
    text: `Qui vedrai gli impegni di tutta la casa, per giorno, settimana e mese. ${COMING}`,
    backToToday: true,
  },
  casa: {
    title: "Casa",
    browserTitle: "FamilyNest · Casa · Spesa",
    icon: "shopping-basket",
    text: `Qui ci saranno la spesa, le cose da fare e le scadenze di casa. ${COMING}`,
    backToToday: true,
  },
  "casa-da-fare": {
    title: "Casa",
    browserTitle: "FamilyNest · Casa · Da fare",
    icon: "square-check",
    text: `Qui ci saranno le cose da fare della casa. ${COMING}`,
    backToToday: true,
  },
  "casa-scadenze": {
    title: "Casa",
    browserTitle: "FamilyNest · Casa · Scadenze",
    icon: "file-clock",
    text: `Qui ci saranno le scadenze della casa. ${COMING}`,
    backToToday: true,
  },
  nest: {
    title: "Il tuo Nest",
    browserTitle: "FamilyNest · Il tuo Nest",
    icon: "users",
    text: `Qui troverai le persone di casa, Esplora e le impostazioni. ${COMING}`,
    backToToday: true,
  },
  notifiche: {
    title: "Notifiche",
    browserTitle: "FamilyNest · Notifiche",
    icon: "bell",
    text: `Qui vedrai cosa è cambiato in casa e la sintesi del mattino. ${COMING}`,
    backToToday: true,
  },
  ricerca: {
    title: "Ricerca",
    browserTitle: "FamilyNest · Ricerca",
    icon: "search",
    text: `Da qui cercherai impegni, spesa, cose da fare e scadenze. ${COMING}`,
    backToToday: true,
  },
  profilo: {
    title: "Il tuo profilo",
    browserTitle: "FamilyNest · Il tuo profilo",
    icon: "user-round",
    text: `Qui sceglierai il tuo nome, il tuo colore e cosa vedere all'apertura. ${COMING}`,
    backToToday: true,
  },
  "calendari-collegati": {
    title: "Calendari collegati",
    browserTitle: "FamilyNest · Calendari collegati",
    icon: "calendar-arrow-down",
    text: `Da qui collegherai Outlook, Google e iCloud al calendario di casa. ${COMING}`,
    backToToday: true,
  },
  impostazioni: {
    title: "Impostazioni della casa",
    browserTitle: "FamilyNest · Impostazioni della casa",
    icon: "house",
    text: `Qui sceglierai il nome della casa e le notifiche. ${COMING}`,
    backToToday: true,
  },
  membri: {
    title: "Chi c’è",
    browserTitle: "FamilyNest · Chi c’è",
    icon: "users",
    text: `Qui vedrai chi c'è nel Nest e potrai invitare qualcuno. ${COMING}`,
    backToToday: true,
  },
};
