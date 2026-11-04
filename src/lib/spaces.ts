import type { IconName } from "@/components/ui/Icon/icon-paths";
import type { Database } from "@/types/database";

/**
 * Catalogue of the ten spaces (issue #28, shared request #188). A plain module,
 * without "use client", so that server and client components import real values
 * from it (LEZIONI). Used by Esplora (#28), «In arrivo» (#29) and Oggi (#30).
 */

/** Same values as the `space_key` enum of the database. */
export type SpaceKey = Database["public"]["Enums"]["space_key"];

export type SpaceRow = { icon: IconName; text: string };

export type SpaceDef = {
  key: SpaceKey;
  /** Address of the «In arrivo» page of the space (#29) */
  href: string;
  name: string;
  /** Fixed promise. Crescere and Zampe get theirs from `getSpacePromise`. */
  promise: string;
  icon: IconName;
  /**
   * The three rows of the «In arrivo» page (#29): what the space will hold.
   * PROVISIONAL: the texts are the designer's proposal, except A tavola
   * (mockup); they stay until Francesco approves or changes them.
   */
  rows: readonly SpaceRow[];
  /** Wide card (two columns) */
  wide: boolean;
  /** Dark card */
  dark: boolean;
};

/** Most spaces one member can pin. The database enforces the same limit. */
export const MAX_PINNED_SPACES = 6;

/** The catalogue, always in this order. */
export const SPACES: readonly SpaceDef[] = [
  {
    key: "meals",
    href: "/esplora/a-tavola",
    name: "A tavola",
    promise: "Cosa mangiamo questa settimana, senza pensarci ogni sera.",
    icon: "utensils",
    rows: [
      { icon: "calendar-range", text: "Il piano dei pasti della settimana" },
      { icon: "book-open", text: "Ricette adatte a chi vive con te" },
      { icon: "shopping-basket", text: "La spesa che si scrive da sola" },
    ],
    wide: true,
    dark: false,
  },
  {
    key: "couple",
    href: "/esplora/noi-due",
    name: "Noi due",
    promise: "Il vostro tempo, le vostre liste, le vostre date.",
    icon: "heart-handshake",
    rows: [
      { icon: "calendar-check", text: "Una serata per voi, ogni settimana" },
      { icon: "square-check", text: "Le liste che tenete solo per voi" },
      { icon: "gift", text: "Date da ricordare e idee regalo" },
    ],
    wide: false,
    dark: true,
  },
  {
    key: "wellbeing",
    href: "/esplora/stare-bene",
    name: "Stare bene",
    promise: "Prendersi cura di sé e degli altri.",
    icon: "leaf",
    rows: [
      { icon: "repeat", text: "Le abitudini che volete tenere" },
      { icon: "sun", text: "Un momento per te, ogni giorno" },
      { icon: "heart", text: "Chi ha bisogno di una mano" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "together",
    href: "/esplora/tempo-insieme",
    name: "Tempo insieme",
    promise: "Il tempo libero che avete, usato bene.",
    icon: "sun",
    rows: [
      { icon: "users", text: "Quando siete liberi tutti insieme" },
      { icon: "sunrise", text: "Idee per il weekend, vicino a casa" },
      { icon: "ticket", text: "Uscite da fare, con i biglietti" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "hobbies",
    href: "/esplora/passioni",
    name: "Passioni",
    promise: "Quello che ti piace fare, con il suo posto.",
    icon: "sparkles",
    rows: [
      { icon: "repeat", text: "Gli orari di corsi e allenamenti" },
      { icon: "headphones", text: "Libri, film e dischi da recuperare" },
      { icon: "palette", text: "Quello che ti serve, in una lista" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "chores",
    href: "/esplora/casa-in-ordine",
    name: "Casa in ordine",
    promise: "Chi fa cosa, e niente sfugge.",
    icon: "sparkle",
    rows: [
      { icon: "users", text: "Chi fa cosa, a turno" },
      { icon: "repeat", text: "Le faccende che si ripetono" },
      { icon: "bell", text: "Un promemoria a chi tocca" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "projects",
    href: "/esplora/progetti",
    name: "Progetti",
    promise: "Traslochi, lavori, grandi cambiamenti, un passo alla volta.",
    icon: "route",
    rows: [
      { icon: "route", text: "Un progetto alla volta, a tappe" },
      { icon: "square-check", text: "Le cose da fare per ogni tappa" },
      { icon: "briefcase", text: "Preventivi, contatti e scadenze" },
    ],
    wide: true,
    dark: false,
  },
  {
    key: "expenses",
    href: "/esplora/conti-chiari",
    name: "Conti chiari",
    promise: "Chi ha pagato cosa, senza discussioni.",
    icon: "scale",
    rows: [
      { icon: "scale", text: "Chi ha pagato cosa, segnato subito" },
      { icon: "users", text: "Le spese di casa, divise tra voi" },
      { icon: "check", text: "Quanto manca per andare in pari" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "children",
    href: "/esplora/crescere",
    name: "Crescere",
    promise: "Tutto sui vostri figli, in un posto solo.",
    icon: "sprout",
    rows: [
      { icon: "book-open", text: "Scuola, classe e orario" },
      { icon: "phone", text: "I contatti delle maestre" },
      { icon: "gift", text: "Taglie e lista dei desideri" },
    ],
    wide: false,
    dark: false,
  },
  {
    key: "pets",
    href: "/esplora/zampe",
    name: "Zampe",
    promise: "Per i vostri animali e per chi ha quattro zampe.",
    icon: "paw-print",
    rows: [
      { icon: "repeat", text: "Pappa e passeggiate, a turno" },
      { icon: "calendar-check", text: "Le visite dal veterinario" },
      { icon: "shopping-basket", text: "Il cibo che sta per finire" },
    ],
    wide: false,
    dark: false,
  },
];

/** The space of an address `/esplora/<slug>`; undefined if it is not one of the ten. */
export function getSpaceByHref(pathname: string): SpaceDef | undefined {
  return SPACES.find((space) => space.href === pathname);
}

/** Members of the Nest by kind, counting also adults without an account. */
export type MemberCounts = {
  adults: number;
  children: number;
  pets: number;
};

/** True when the space makes sense for a Nest with these members. */
export function isSpaceAvailable(key: SpaceKey, counts: MemberCounts): boolean {
  switch (key) {
    case "couple":
    case "expenses":
      return counts.adults >= 2;
    case "children":
      return counts.children >= 1;
    case "pets":
      return counts.pets >= 1;
    default:
      return true;
  }
}

/** The spaces available for these members, in catalogue order. */
export function getAvailableSpaces(counts: MemberCounts): SpaceDef[] {
  return SPACES.filter((space) => isSpaceAvailable(space.key, counts));
}

/** «Sofia», «Sofia e Tommaso», «Anna, Bea e Carlo». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Promise of a space. Crescere and Zampe use the names (in order of
 * insertion): `childNames` and `petNames` are ignored by the other spaces.
 * Without names the fixed text of the catalogue is returned.
 */
export function getSpacePromise(
  key: SpaceKey,
  names: { childNames?: readonly string[]; petNames?: readonly string[] } = {},
): string {
  if (key === "children" && names.childNames?.length) {
    return `Tutto su ${joinNames(names.childNames)}, in un posto solo.`;
  }
  if (key === "pets" && names.petNames?.length) {
    // «Per Fido, Micia e per chi ha quattro zampe.»
    return `Per ${names.petNames.join(", ")} e per chi ha quattro zampe.`;
  }
  return SPACES.find((space) => space.key === key)?.promise ?? "";
}

type DbError = { code?: string | null } | null | undefined;

/** The database refused a seventh pinned space (code FN001). */
export function isPinLimitError(error: DbError): boolean {
  return error?.code === "FN001";
}

/** The database refused a space that is not available for this Nest (FN002). */
export function isSpaceUnavailableError(error: DbError): boolean {
  return error?.code === "FN002";
}

/**
 * How many of the pinned spaces count towards the limit: only the ones that
 * are available now (a pinned space that is no longer available is hidden and
 * does not count).
 */
export function countPinnedAvailable(
  pinned: readonly SpaceKey[],
  counts: MemberCounts,
): number {
  return pinned.filter((key) => isSpaceAvailable(key, counts)).length;
}
