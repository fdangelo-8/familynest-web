import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client of the public page of a wish list (#33): the only place that calls
 * the two public functions of the database and keeps the key and the name of
 * the person who gives in `localStorage`. Used only by `/desideri/<code>`.
 *
 * - Calls are `POST` (a function that writes or may write is called with
 *   `rpc`, which posts): the code, the key and the name travel only in the
 *   body, never in an address.
 * - The client keeps no session and writes no cookie: whoever opens the page,
 *   signed in or not, is treated the same.
 * - Every answer is a union (lessons of #96): the page cannot read what a
 *   variant does not have. Nothing here logs or throws.
 */

const CODE_PATTERN = /^[0-9a-f]{64}$/;
/** Longest name a person can leave (the database accepts 1–40). */
export const GIVER_NAME_MAX = 40;

const KEY_STORAGE = "familynest.wishlist.giver-key";
const NAME_STORAGE = "familynest.wishlist.giver-name";

export type PublicWishlistItem = {
  id: string;
  title: string;
  /** Address of the shop, `http`/`https`, or null */
  url: string | null;
  shopName: string | null;
  note: string | null;
  /** Euro cents, or null */
  priceCents: number | null;
  hasPhoto: boolean;
  /** free = anybody may take it; mine = taken from this browser; taken = by others */
  state: "free" | "mine" | "taken";
};

export type PublicWishlist = {
  childName: string;
  childColor: MemberColor;
  /** Day and month of the occasion; never the year of birth */
  occasionDay: number;
  occasionMonth: number;
  /** In the order the database decided */
  items: PublicWishlistItem[];
};

export type PublicFailure = "network" | "server";

export type LoadPublicWishlistResult =
  | { ok: true; status: "active"; wishlist: PublicWishlist }
  /** Not active, disabled, expired, unknown or malformed: all the same */
  | { ok: true; status: "inactive" }
  | { ok: false; reason: PublicFailure };

export type ReserveOutcome =
  Database["public"]["Enums"]["wishlist_reservation_outcome"];

export type ReservePublicItemResult =
  { ok: true; outcome: ReserveOutcome } | { ok: false; reason: PublicFailure };

/** True for the form of a code: 64 lower-case hexadecimal characters. */
export function isWellFormedCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

function failureOf(status: number): PublicFailure {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "network";
  }
  return status === 0 ? "network" : "server";
}

function createPublicClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createSupabaseClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function toItem(
  raw: Database["public"]["CompositeTypes"]["public_wishlist_item"],
): PublicWishlistItem | null {
  if (!raw.id || !raw.title || !raw.state) return null;
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    shopName: raw.shop_name,
    note: raw.note,
    priceCents: raw.price_cents,
    hasPhoto: raw.has_photo === true,
    state: raw.state,
  };
}

/**
 * Reads the list of a code. A malformed code is «inactive» without any
 * request. `giverKey` lets the database tell which idea this browser took.
 */
export async function loadPublicWishlist(
  code: string,
  giverKey: string | null,
): Promise<LoadPublicWishlistResult> {
  if (!isWellFormedCode(code)) return { ok: true, status: "inactive" };
  try {
    const { data, error, status } = await createPublicClient().rpc(
      "get_public_wishlist",
      giverKey === null
        ? { p_code: code }
        : { p_code: code, p_giver_key: giverKey },
    );
    if (error) return { ok: false, reason: failureOf(status) };
    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) return { ok: false, reason: "server" };
    if (row.status !== "active") return { ok: true, status: "inactive" };
    if (
      !row.child_name ||
      !row.child_color ||
      typeof row.occasion_day !== "number" ||
      typeof row.occasion_month !== "number"
    ) {
      return { ok: false, reason: "server" };
    }
    return {
      ok: true,
      status: "active",
      wishlist: {
        childName: row.child_name,
        childColor: row.child_color,
        occasionDay: row.occasion_day,
        occasionMonth: row.occasion_month,
        items: (row.items ?? [])
          .map(toItem)
          .filter((item): item is PublicWishlistItem => item !== null),
      },
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** «Lo regalo io»: takes an idea in the name of the giver. */
export async function reservePublicWishlistItem(
  code: string,
  itemId: string,
  giverName: string,
  giverKey: string,
): Promise<ReservePublicItemResult> {
  if (!isWellFormedCode(code)) return { ok: true, outcome: "inactive" };
  try {
    const { data, error, status } = await createPublicClient().rpc(
      "reserve_public_wishlist_item",
      {
        p_code: code,
        p_item_id: itemId,
        p_name: giverName,
        p_giver_key: giverKey,
      },
    );
    if (error) return { ok: false, reason: failureOf(status) };
    if (typeof data !== "string") return { ok: false, reason: "server" };
    return { ok: true, outcome: data };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * The photo of an idea as an address the browser can show (`data:`): the code
 * never goes into the address of an image. Null when there is none or the
 * read fails (the page shows the icon).
 */
export async function loadPublicWishlistPhoto(
  code: string,
  itemId: string,
): Promise<string | null> {
  if (!isWellFormedCode(code)) return null;
  try {
    const { data, error } = await createPublicClient().rpc(
      "get_public_wishlist_photo",
      { p_code: code, p_item_id: itemId },
    );
    const row = Array.isArray(data) ? data[0] : undefined;
    if (error || !row) return null;
    if (
      row.content_type !== "image/webp" &&
      row.content_type !== "image/jpeg"
    ) {
      return null;
    }
    return `data:${row.content_type};base64,${row.data_base64}`;
  } catch {
    return null;
  }
}

/** Name as the database reads it: ends trimmed, runs of spaces made one. */
export function normalizeGiverName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

// Only used in the browser, when `localStorage` is not available (private
// mode): never reached on the server (see the guards below).
let memoryKey: string | null = null;

function newGiverKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  // base64url, 43 characters: inside the 32–128 the database accepts.
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The key of this browser (created on first use). It never leaves the
 * browser except in the body of the two calls above. Without `localStorage`
 * (private mode) it lives as long as the page.
 */
export function getGiverKey(): string | null {
  // On the server there is no browser: no key is made there, ever.
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(KEY_STORAGE);
    if (stored && /^[A-Za-z0-9+/=_-]{32,128}$/.test(stored)) return stored;
    const created = newGiverKey();
    window.localStorage.setItem(KEY_STORAGE, created);
    return created;
  } catch {
    memoryKey ??= newGiverKey();
    return memoryKey;
  }
}

/** The key if this browser already has one, without creating it. */
export function peekGiverKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(KEY_STORAGE);
    return stored && /^[A-Za-z0-9+/=_-]{32,128}$/.test(stored)
      ? stored
      : memoryKey;
  } catch {
    return memoryKey;
  }
}

/** The name left last time in this browser, or an empty string. */
export function getSavedGiverName(): string {
  try {
    return normalizeGiverName(
      window.localStorage.getItem(NAME_STORAGE) ?? "",
    ).slice(0, GIVER_NAME_MAX);
  } catch {
    return "";
  }
}

/** Remembers the name for the next time; never fails the page. */
export function saveGiverName(name: string): void {
  try {
    window.localStorage.setItem(
      NAME_STORAGE,
      normalizeGiverName(name).slice(0, GIVER_NAME_MAX),
    );
  } catch {
    // No storage: the name is asked again next time.
  }
}
