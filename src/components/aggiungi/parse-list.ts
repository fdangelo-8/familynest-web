import { nameKey } from "../casa-spesa/model";

/**
 * Reads a phrase for «Spesa» (issue #22, requisito §2). Pure code that runs in
 * the browser: the text never leaves the app.
 */

export type ShoppingEntry = {
  /** First letter in capitals, the rest as written */
  name: string;
  /** «6», «2 l», «1 kg», or null */
  quantity: string | null;
};

/** «spesa:» at the start chooses the type; the prefix is not a thing. */
const PREFIX = /^\s*spesa\s*:\s*/iu;

/**
 * Things are separated by commas (not the decimal one: «1,5 kg»), semicolons,
 * line breaks and the whole words «e» and «ed».
 */
const SEPARATOR =
  /(?<!\d),|,(?!\d)|[;\n]|(?<![\p{L}\p{N}])(?:e|ed)(?![\p{L}\p{N}])/giu;

const QUANTITY =
  /^(\d+(?:[.,]\d+)?)(?:\s*(kg|g|hg|l|ml|cl|pz)(?![\p{L}\p{N}]))?\s*(?:di\s+)?(.+)$/iu;

export const SHOPPING_NAME_MAX = 80;
export const SHOPPING_QUANTITY_MAX = 20;

export function hasShoppingPrefix(phrase: string): boolean {
  return PREFIX.test(phrase);
}

/** True when the text has a comma or the whole word «e» / «ed». */
export function looksLikeList(phrase: string): boolean {
  SEPARATOR.lastIndex = 0;
  const found = SEPARATOR.test(phrase.replace(PREFIX, ""));
  SEPARATOR.lastIndex = 0;
  return found;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);
}

function readPiece(piece: string): ShoppingEntry | null {
  const text = piece.replace(/\s+/g, " ").trim();
  if (text === "") return null;
  const match = QUANTITY.exec(text);
  if (match) {
    const name = match[3]!.trim();
    if (name !== "") {
      const unit = match[2];
      return {
        name: capitalizeFirst(name),
        quantity: unit ? `${match[1]} ${unit.toLowerCase()}` : match[1]!,
      };
    }
  }
  return { name: capitalizeFirst(text), quantity: null };
}

/** The things of the phrase, in order, without the ones written twice. */
export function parseShopping(phrase: string): ShoppingEntry[] {
  const text = phrase.replace(PREFIX, "");
  const seen = new Set<string>();
  const entries: ShoppingEntry[] = [];
  for (const piece of text.split(SEPARATOR)) {
    const entry = readPiece(piece);
    if (!entry) continue;
    const key = nameKey(entry.name);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}
