import { DEFAULT_LOCALE, LOCALE_TAGS } from "./config";
import { formatNumber } from "./format";

/**
 * Message engine: `{name}` placeholders and plural forms.
 * Templates are plain strings, so a library can replace this later without
 * rewriting the messages.
 */

export type Params = Readonly<Record<string, string | number>>;

export type PluralForms = {
  zero?: string;
  one: string;
  other: string;
};

const PLACEHOLDER = /\{(\w+)\}/g;
const pluralRules = new Intl.PluralRules(LOCALE_TAGS[DEFAULT_LOCALE]);

/**
 * Fills the placeholders. A missing parameter throws outside production
 * (the message names only the parameter, never the text or the values) and
 * leaves the placeholder visible in production.
 */
export function t(template: string, params: Params = {}): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        throw new Error(`i18n: missing param "${name}"`);
      }
      return placeholder;
    }
    return String(value);
  });
}

/** Picks the form for `count` and fills `{count}` (formatted) and params. */
export function plural(
  forms: PluralForms,
  count: number,
  params: Params = {},
): string {
  const form =
    count === 0 && forms.zero !== undefined
      ? forms.zero
      : pluralRules.select(count) === "one"
        ? forms.one
        : forms.other;
  return t(form, { ...params, count: formatNumber(count) });
}
