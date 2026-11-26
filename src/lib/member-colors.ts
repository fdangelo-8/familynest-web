import type { Database } from "@/types/database";
import { baseMessages, getLocale } from "@/lib/i18n";

/** Codes of the `member_color` enum, in the order the colour choice shows them. */
export type MemberColorCode = Database["public"]["Enums"]["member_color"];

export const MEMBER_COLOR_CODES = [
  "pomodoro",
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
] as const satisfies ReadonlyArray<MemberColorCode>;

// Fails to compile if the enum gets a code that is not in the list above.
type MissingCode = Exclude<
  MemberColorCode,
  (typeof MEMBER_COLOR_CODES)[number]
>;
const allCodesListed: [MissingCode] extends [never] ? true : never = true;
void allCodesListed;

/** Shade shown for each code (`--color-membro-<shade>` in `globals.css`). */
export const MEMBER_COLOR_SHADES: Readonly<Record<MemberColorCode, string>> = {
  pomodoro: "corallo",
  glicine: "glicine",
  salvia: "menta",
  cobalto: "blu",
  zafferano: "ambra",
  lampone: "sabbia",
  ceruleo: "azzurro",
  peonia: "rosa",
  basilico: "ardesia",
  cannella: "cannella",
};

/** Class that sets `--c`, `--c-tinta`, `--c-corsia` and `--c-iniziale`. */
export function memberColorClass(
  code: MemberColorCode | "insieme" | "neutro",
): string {
  return `membro-${code}`;
}

/** Accessible name of a colour, read aloud: `Corallo`. */
export function memberColorLabel(code: MemberColorCode): string {
  return baseMessages[getLocale()].memberColors[code];
}
