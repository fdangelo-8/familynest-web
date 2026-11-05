/**
 * Recent searches of the search page (issue #40): the last 3 texts the person
 * searched, kept only in this browser (`localStorage`), never sent to the
 * server, to analytics or to a log.
 *
 * - The key belongs to the account (`familynest:recent-searches:<user id>`),
 *   so a second person using the same browser never sees them. The text is
 *   never part of the key.
 * - «Esci» and the deletion of the account call `clearAllRecentSearches`,
 *   which does not need to know who is leaving: it removes every key of the
 *   module.
 * - Every function takes an optional `storage` (tests pass a fake one) and
 *   never throws: a browser without `localStorage` (private mode, blocked)
 *   behaves as if there were no recent searches.
 */

export const RECENT_SEARCHES_MAX = 3;
/** Longest text kept: the limit of the search function. */
export const RECENT_SEARCH_MAX_LENGTH = 100;

const KEY_PREFIX = "familynest:recent-searches:";

/** The part of `Storage` the module uses. */
export type RecentStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

function defaultStorage(): RecentStorage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function keyOf(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Spaces trimmed and collapsed, cut to the longest text kept. */
export function cleanSearchText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, RECENT_SEARCH_MAX_LENGTH);
}

/** Texts are the same when they differ only by case, accents or spaces. */
export function sameSearchText(a: string, b: string): boolean {
  const normalize = (text: string) =>
    cleanSearchText(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return normalize(a) === normalize(b);
}

function parse(raw: string | null): string[] {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const list: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = cleanSearchText(item);
    if (text === "" || list.some((known) => sameSearchText(known, text))) {
      continue;
    }
    list.push(text);
    if (list.length === RECENT_SEARCHES_MAX) break;
  }
  return list;
}

function write(
  storage: RecentStorage,
  userId: string,
  list: string[],
): boolean {
  try {
    if (list.length === 0) storage.removeItem(keyOf(userId));
    else storage.setItem(keyOf(userId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** The recent searches of the account, the latest first (at most 3). */
export function readRecentSearches(
  userId: string,
  storage: RecentStorage | null = defaultStorage(),
): string[] {
  if (!storage) return [];
  try {
    return parse(storage.getItem(keyOf(userId)));
  } catch {
    return [];
  }
}

/**
 * Puts a search on top. The text is cleaned (spaces); one already there (same
 * letters, case and accents ignored) moves up without a duplicate; only the
 * latest 3 stay. A text that is empty after cleaning changes nothing.
 * Returns the new list.
 */
export function addRecentSearch(
  userId: string,
  text: string,
  storage: RecentStorage | null = defaultStorage(),
): string[] {
  const current = readRecentSearches(userId, storage);
  const clean = cleanSearchText(text);
  if (!storage || clean === "") return current;
  const next = [
    clean,
    ...current.filter((known) => !sameSearchText(known, clean)),
  ].slice(0, RECENT_SEARCHES_MAX);
  write(storage, userId, next);
  return next;
}

/**
 * «Cancella»: removes the recent searches of the account. Returns the ones
 * that were there, to give to `restoreRecentSearches` if the person taps
 * «Annulla».
 */
export function clearRecentSearches(
  userId: string,
  storage: RecentStorage | null = defaultStorage(),
): string[] {
  const previous = readRecentSearches(userId, storage);
  if (storage) write(storage, userId, []);
  return previous;
}

/** «Annulla» after «Cancella»: puts back the same searches in the same order. */
export function restoreRecentSearches(
  userId: string,
  list: readonly string[],
  storage: RecentStorage | null = defaultStorage(),
): string[] {
  if (!storage) return [];
  const clean = parse(JSON.stringify(list));
  write(storage, userId, clean);
  return clean;
}

/**
 * «Esci» and deletion of the account: removes the recent searches of every
 * account in this browser. Takes no user id, so it works even when the
 * session is already gone.
 */
export function clearAllRecentSearches(
  storage: RecentStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Nothing more can be done: the browser refuses to use its storage.
  }
}
