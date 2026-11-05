import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import { dayAndMonth, howMuch, nextBirthday } from "@/lib/datetime";

/*
 * What the wish list of a child reads and how it turns into text (#32). Pure
 * functions: «now» is always an argument (the page takes it in the browser).
 */

export const IDEA_MAX = 80;
export const NOTE_MAX = 80;
export const LINK_MAX = 2000;
/** Most ideas in a list, as in the database */
export const MAX_IDEAS = 50;

export type WishItem = {
  id: string;
  title: string;
  /** Address of the shop, or null */
  url: string | null;
  shopName: string | null;
  /** Euro cents, or null */
  priceCents: number | null;
  note: string | null;
  /** `data:` address of the reduced copy of the photo, or null */
  photoSrc: string | null;
  createdAt: string;
  /** Name left by whoever takes it: only the adults of the Nest see it */
  giverName: string | null;
  takenAt: string | null;
};

export type WishlistData = {
  child: {
    id: string;
    name: string;
    color: MemberColor;
    /** `YYYY-MM-DD` */
    birthDate: string | null;
  };
  items: WishItem[];
  /** `expires_at` of the active link (not disabled, not expired), or null */
  activeLinkExpiresAt: string | null;
  /**
   * The latest link when none is active: it ran out (`expired`) or was turned
   * off (`disabled`). `null` when there was never a link or one is active.
   */
  endedLink: { kind: "expired" | "disabled"; expiresAt: string } | null;
  readAt: Date;
};

/** The ideas nobody took, the latest added first. */
export function freeItems(items: ReadonlyArray<WishItem>): WishItem[] {
  return items
    .filter((item) => item.takenAt === null)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}

/** The ideas somebody took, the latest taken first. */
export function takenItems(items: ReadonlyArray<WishItem>): WishItem[] {
  return items
    .filter((item) => item.takenAt !== null)
    .sort(
      (a, b) =>
        (b.takenAt ?? "").localeCompare(a.takenAt ?? "") ||
        b.id.localeCompare(a.id),
    );
}

/** The title of the line under a title: «Feltrinelli · lo vuole tanto». */
export { wishlistInfoLine } from "@/lib/wishlist-texts";

/** `14 dicembre`: day and month, never the year. */
export function dayAndMonthName(day: number, month: number): string {
  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export type OccasionView = {
  /** The big number or word («55», «Oggi»); null when the birth date is missing */
  number: string | null;
  unit: string | null;
  /** «Oggi» is a word: smaller type */
  word: boolean;
  info: string;
  missing: boolean;
};

/** The row of the birthday (#32 §3.1; counter rule of the profile, #31). */
export function occasionView(
  birthDate: string | null,
  now: Date,
): OccasionView {
  const next = birthDate ? nextBirthday(birthDate, now) : null;
  if (!next) {
    return {
      number: null,
      unit: null,
      word: false,
      info: "Manca la data di nascita",
      missing: true,
    };
  }
  const how = howMuch(next.daysLeft);
  const age = `compie ${next.turnsAge} ${next.turnsAge === 1 ? "anno" : "anni"}`;
  const day = dayAndMonthName(
    Number(next.dayKey.slice(8, 10)),
    Number(next.dayKey.slice(5, 7)),
  );
  return {
    number: how.number,
    unit: how.unit,
    word: how.word,
    info: next.daysLeft === 0 ? `Oggi, ${age}` : `${day}, ${age}`,
    missing: false,
  };
}

/** «Compleanno, 14 dicembre» in the profile of the child (#32 §9). */
export function birthdayTitle(birthDate: string | null, now: Date): string {
  const next = birthDate ? nextBirthday(birthDate, now) : null;
  if (!next) return "Compleanno";
  return `Compleanno, ${dayAndMonthName(
    Number(next.dayKey.slice(8, 10)),
    Number(next.dayKey.slice(5, 7)),
  )}`;
}

export type ShareView =
  | { kind: "none" }
  | {
      kind: "expired";
      /** «Era attivo fino al 15 dicembre» */
      until: string;
    }
  | { kind: "disabled" }
  | { kind: "no-birth" }
  | {
      kind: "active";
      /** «Attivo fino al 15 dicembre» */
      until: string;
      /** «2 regali già presi» */
      taken: string;
    };

/** Plural of «regalo già preso» for the block of the link. */
function takenText(count: number): string {
  if (count === 0) return "Ancora nessun regalo preso";
  return count === 1 ? "1 regalo già preso" : `${count} regali già presi`;
}

/** What the dark block says (#32 §3.3 and designer §4). */
export function shareView(data: WishlistData): ShareView {
  if (data.activeLinkExpiresAt) {
    const expires = new Date(data.activeLinkExpiresAt);
    // The link works until the day before the expiry (midnight of Rome).
    const lastDay = new Date(expires.getTime() - 1);
    const taken = data.items.filter((item) => item.takenAt !== null).length;
    return {
      kind: "active",
      until: `Attivo fino al ${dayAndMonth(lastDay, data.readAt)}`,
      taken: takenText(taken),
    };
  }
  if (
    !data.child.birthDate ||
    !nextBirthday(data.child.birthDate, data.readAt)
  ) {
    return { kind: "no-birth" };
  }
  if (data.endedLink?.kind === "disabled") return { kind: "disabled" };
  if (data.endedLink?.kind === "expired") {
    const lastDay = new Date(new Date(data.endedLink.expiresAt).getTime() - 1);
    return {
      kind: "expired",
      until: `Era attivo fino al ${dayAndMonth(lastDay, data.readAt)}`,
    };
  }
  return { kind: "none" };
}

/** The «n idee» of the section in the profile (#32 §9). */
export function ideasCountText(count: number): string {
  if (count === 0) return "Nessuna idea";
  return count === 1 ? "1 idea" : `${count} idee`;
}

/** «Non ancora condivisa · 2 già presi» (the profile never shows who). */
export function wishlistRowInfo(shared: boolean, taken: number): string {
  const base = shared ? "Condivisa" : "Non ancora condivisa";
  if (taken === 0) return base;
  return `${base} · ${taken} ${taken === 1 ? "già preso" : "già presi"}`;
}

const HEX = /^\\x([0-9a-fA-F]*)$/;

/**
 * The photo comes from the database as `bytea` (`\x…` in hexadecimal). It
 * becomes a `data:` address, so no request is made to show it and the address
 * of the photo carries nothing. Null if it cannot be read.
 */
export function photoSrcOf(
  contentType: string | null | undefined,
  data: string | null | undefined,
): string | null {
  if (contentType !== "image/webp" && contentType !== "image/jpeg") return null;
  const match = data ? HEX.exec(data) : null;
  if (!match || !match[1] || match[1].length % 2 !== 0) return null;
  const hex = match[1];
  let binary = "";
  for (let index = 0; index < hex.length; index += 2) {
    binary += String.fromCharCode(
      Number.parseInt(hex.slice(index, index + 2), 16),
    );
  }
  try {
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Spaces at the ends removed and runs of spaces made one, as in the database. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** True for an address that starts with `http://` or `https://` and has a host. */
export function isShopAddress(text: string): boolean {
  try {
    const url = new URL(text);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}
