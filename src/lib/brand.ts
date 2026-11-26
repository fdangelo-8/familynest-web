/**
 * The product name, in one place (#502). When the final name arrives, this
 * file and the two articles in `messages/it.ts` change, nothing else.
 *
 * Technical identifiers that carry the old name (cookies, browser storage
 * keys, event names, encryption labels) are NOT built from `BRAND`: changing
 * them would log people out and lose saved preferences and linked calendars.
 * They stay written by hand where they are used. `BRAND.slug` is only for the
 * names of downloaded files.
 */

import { baseMessages, getLocale, rich, t } from "@/lib/i18n";
import type { Params, RichTags } from "@/lib/i18n";

export type Brand = {
  /** Name in texts, browser titles and metadata. */
  full: string;
  /** The home: «Il tuo Nest», «Chiedi a Nest». */
  short: string;
  /** Written mark: two parts, lowercase, different weights. */
  wordmark: { family: string; nest: string };
  /** Names of downloaded files. */
  slug: string;
};

export const BRAND: Brand = {
  full: "FamilyNest",
  short: "Nest",
  wordmark: { family: "family", nest: "nest" },
  slug: "familynest",
};

/** Placeholders `{app}` and `{nest}` of the messages. */
export function brandParams(brand: Pick<Brand, "full" | "short">): Params {
  return { app: brand.full, nest: brand.short };
}

/** Texts built from the name: pure, so a test can try another name. */
export function brandTexts(brand: Pick<Brand, "full" | "short">) {
  const messages = baseMessages[getLocale()].brand;
  const params = brandParams(brand);
  return {
    description: t(messages.description, params),
    yourNest: t(messages.yourNest, params),
    yourNestLower: t(messages.yourNestLower, params),
    askNest: t(messages.askNest, params),
    nestEnergy: t(messages.nestEnergy, params),
    /** «FamilyNest · Casa · Spesa»; no parts gives the bare name. */
    pageTitle: (...parts: string[]) =>
      [brand.full, ...parts].join(` ${messages.titleSeparator} `),
  };
}

const TEXTS = brandTexts(BRAND);

export const pageTitle = TEXTS.pageTitle;
export const brandDescription = (): string => TEXTS.description;
export const yourNest = (): string => TEXTS.yourNest;
export const yourNestLower = (): string => TEXTS.yourNestLower;
export const askNest = (): string => TEXTS.askNest;
export const nestEnergy = (): string => TEXTS.nestEnergy;

/** Messages of the active language, for texts that carry the name. */
export const messages = baseMessages[getLocale()];

/** Fills `{app}` and `{nest}` (and any other parameter) of a message. */
export function brandText(template: string, extra: Params = {}): string {
  return t(template, { ...brandParams(BRAND), ...extra });
}

/** Same as `brandText` for messages with tags such as `<b>…</b>`. */
export function brandRich(
  template: string,
  tags: RichTags,
  extra: Params = {},
) {
  return rich(template, { ...brandParams(BRAND), ...extra }, tags);
}
