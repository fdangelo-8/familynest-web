import { DEFAULT_LOCALE, LOCALE_TAGS } from "./config";

/**
 * Locale-aware formatting of numbers, currency, case, sorting and lists.
 * Dates and times live in `src/lib/datetime.ts`.
 */

const TAG = LOCALE_TAGS[DEFAULT_LOCALE];

const numberFormatter = new Intl.NumberFormat(TAG);
const currencyFormatter = new Intl.NumberFormat(TAG, {
  style: "currency",
  currency: "EUR",
});
const collator = new Intl.Collator(TAG, { sensitivity: "base" });
const listFormatter = new Intl.ListFormat(TAG, {
  style: "long",
  type: "conjunction",
});

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Euro amount; the symbol follows the number after a no-break space. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** First letter in capitals, the rest untouched. Empty text stays empty. */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(TAG) + text.slice(1);
}

export function toUpper(text: string): string {
  return text.toLocaleUpperCase(TAG);
}

export function toLower(text: string): string {
  return text.toLocaleLowerCase(TAG);
}

/** Alphabetical comparison, ignoring case and accents. For `Array.sort`. */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

/** «A, B e C». */
export function formatList(items: readonly string[]): string {
  return listFormatter.format(items);
}
