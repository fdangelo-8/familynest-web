import type { PluralForms } from "../translate";
import type { it } from "./it";

/** A message is a string or plural forms; groups nest them. */
export type MessageTree = {
  readonly [key: string]: string | PluralForms | MessageTree;
};

type Widen<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends PluralForms
      ? PluralForms
      : Widen<T[K]>;
};

/**
 * Shape every language must have: the keys of the Italian messages, with
 * values typed as plain strings (a new language checks keys, not Italian text).
 */
export type Messages = Widen<typeof it>;
