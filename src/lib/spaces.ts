import type { IconName } from "@/components/ui/Icon/icon-paths";
import type { Database } from "@/types/database";

/**
 * Catalogue of the ten spaces (issue #28, shared request #188). A plain module,
 * without "use client", so that server and client components import real values
 * from it (LEZIONI). Used by Esplora (#28), «In arrivo» (#29) and Oggi (#30).
 */

/** Same values as the `space_key` enum of the database. */
export type SpaceKey = Database["public"]["Enums"]["space_key"];

export type SpaceDef = {
  key: SpaceKey;
  /** Address of the «In arrivo» page of the space (#29) */
  href: string;
  name: string;
  /** Fixed promise. Crescere and Zampe get theirs from `getSpacePromise`. */
  promise: string;
  icon: IconName;
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
    wide: true,
    dark: false,
  },
  {
    key: "couple",
    href: "/esplora/noi-due",
    name: "Noi due",
    promise: "Il vostro tempo, le vostre liste, le vostre date.",
    icon: "heart-handshake",
    wide: false,
    dark: true,
  },
  {
    key: "wellbeing",
    href: "/esplora/stare-bene",
    name: "Stare bene",
    promise: "Prendersi cura di sé e degli altri.",
    icon: "leaf",
    wide: false,
    dark: false,
  },
  {
    key: "together",
    href: "/esplora/tempo-insieme",
    name: "Tempo insieme",
    promise: "Il tempo libero che avete, usato bene.",
    icon: "sun",
    wide: false,
    dark: false,
  },
  {
    key: "hobbies",
    href: "/esplora/passioni",
    name: "Passioni",
    promise: "Quello che ti piace fare, con il suo posto.",
    icon: "sparkles",
    wide: false,
    dark: false,
  },
  {
    key: "chores",
    href: "/esplora/casa-in-ordine",
    name: "Casa in ordine",
    promise: "Chi fa cosa, e niente sfugge.",
    icon: "sparkle",
    wide: false,
    dark: false,
  },
  {
    key: "projects",
    href: "/esplora/progetti",
    name: "Progetti",
    promise: "Traslochi, lavori, grandi cambiamenti, un passo alla volta.",
    icon: "route",
    wide: true,
    dark: false,
  },
  {
    key: "expenses",
    href: "/esplora/conti-chiari",
    name: "Conti chiari",
    promise: "Chi ha pagato cosa, senza discussioni.",
    icon: "scale",
    wide: false,
    dark: false,
  },
  {
    key: "children",
    href: "/esplora/crescere",
    name: "Crescere",
    promise: "Tutto sui vostri figli, in un posto solo.",
    icon: "sprout",
    wide: false,
    dark: false,
  },
  {
    key: "pets",
    href: "/esplora/zampe",
    name: "Zampe",
    promise: "Per i vostri animali e per chi ha quattro zampe.",
    icon: "paw-print",
    wide: false,
    dark: false,
  },
];

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
