/**
 * The only place that writes language and time zone by hand.
 * Everything else (dates, numbers, `<html lang>`) reads them from here.
 */

export const LOCALES = ["it"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "it";

/** Full language tag used by `Intl` for each supported locale. */
export const LOCALE_TAGS: Record<Locale, string> = {
  it: "it-IT",
};

/** One time zone for the whole app (a time zone per Nest is out of scope). */
export const TIME_ZONE = "Europe/Rome";
