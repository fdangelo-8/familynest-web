import { DEFAULT_LOCALE, type Locale } from "./config";
import { it } from "./messages/it";
import type { Messages } from "./messages/types";

export { LOCALES, DEFAULT_LOCALE, LOCALE_TAGS, TIME_ZONE } from "./config";
export type { Locale } from "./config";
export { t, plural } from "./translate";
export type { Params, PluralForms } from "./translate";
export type { Messages, MessageTree } from "./messages/types";
export { rich } from "./rich";
export type { RichTags } from "./rich";
export {
  formatNumber,
  formatCurrency,
  capitalize,
  toUpper,
  toLower,
  compareText,
  formatList,
} from "./format";

/** Base messages of every supported locale. */
export const baseMessages: Record<Locale, Messages> = { it };

/**
 * The active language. Always Italian for now: no address, cookie, saved
 * preference or browser language is read.
 */
export function getLocale(): Locale {
  return DEFAULT_LOCALE;
}
