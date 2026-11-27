import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// Helpers of the dark theme tests (#634). Colours are compared in a canonical
// form: the production build rewrites #ffffff as #fff and rgba() as #rrggbbaa.

export type Theme = "chiaro" | "scuro";

export function canonicalColor(value: string): string {
  return value
    .replace(
      /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\b/g,
      (_, r: string, g: string, b: string, a: string) =>
        `rgba(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},${(parseInt(a, 16) / 255).toFixed(2)})`,
    )
    .replace(
      /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/g,
      (_, r: string, g: string, b: string, a: string) =>
        `rgba(${r},${g},${b},${Number(a).toFixed(2)})`,
    )
    .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, "#$1$1$2$2$3$3")
    .replace(
      /\brgb\((\d+),(\d+),(\d+)\)/g,
      (_, r: string, g: string, b: string) =>
        `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`,
    );
}

export const normalize = (value: string) =>
  canonicalColor(value.replace(/\s+/g, "").toLowerCase()).replace(
    /(^|[^0-9])\.(\d)/g,
    "$10.$2",
  );

/** Colour as [r, g, b] from #rgb, #rrggbb, #rrggbbaa or rgb()/rgba(). */
export function rgbOf(value: string): [number, number, number] {
  const text = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short)
    return [short[1]!, short[2]!, short[3]!].map((digit) =>
      parseInt(digit + digit, 16),
    ) as [number, number, number];
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/.exec(text);
  if (long)
    return [long[1]!, long[2]!, long[3]!].map((pair) => parseInt(pair, 16)) as [
      number,
      number,
      number,
    ];
  const fn = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(text);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`Colore non riconosciuto: ${value}`);
}

export function luminance(value: string): number {
  const [r, g, b] = rgbOf(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Puts the page in a theme with the attribute, which wins over the system. */
export async function setAspetto(page: Page, value: string | null) {
  await page.evaluate((aspetto) => {
    if (aspetto === null)
      document.documentElement.removeAttribute("data-aspetto");
    else document.documentElement.setAttribute("data-aspetto", aspetto);
  }, value);
}

/** Computed value of custom properties on <html>. */
export async function rootValues(page: Page, names: string[]) {
  return page.evaluate(
    (list) =>
      Object.fromEntries(
        list.map((name) => [
          name,
          getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim(),
        ]),
      ),
    names,
  );
}

export type Role = {
  nome: string;
  chiaro: string;
  scuro: string;
  uguale_nei_due_temi: boolean;
};

/** The 75 roles of docs/design/tavolozza.json (73 + 2 of the Passo 17). */
export function readRoles(): Role[] {
  const json = JSON.parse(
    readFileSync("docs/design/tavolozza.json", "utf8"),
  ) as { ruoli: Role[] };
  return json.ruoli;
}

const PEOPLE: Record<string, string> = {
  marco: "corallo",
  laura: "glicine",
  sofia: "menta",
  tommaso: "blu",
  biscotto: "ambra",
  miele: "cannella",
};

/** Table A of the requirement: role of the palette -> token of the app. */
export function tokenOfRole(role: string): string {
  const fixed: Record<string, string> = {
    "--c-fondo": "--color-carta",
    "--c-sup": "--color-superficie",
    "--c-basso": "--color-carta-2",
    "--c-premuto": "--color-premuto",
    "--c-scheletro": "--color-scheletro",
    "--c-velo": "--color-velo",
    "--c-ombra": "--color-ombra",
    "--c-ombra2": "--color-ombra-forte",
    "--c-barra": "--color-barra",
    "--c-cielo": "--color-cielo",
    "--c-cielo-mezzo": "--color-cielo-mezzo",
    "--c-segnaposto": "--color-segnaposto",
    "--c-segnaposto-testo": "--color-segnaposto-testo",
    "--c-idea-1": "--color-idea-1",
    "--c-idea-2": "--color-idea-2",
    "--c-idea-3": "--color-idea-3",
    "--c-scena": "--color-scena-fondo",
    "--c-filo": "--color-filo",
    "--c-filo2": "--color-filo-2",
    "--c-campo": "--color-filo-campo",
    "--c-fuoco": "--color-fuoco",
    "--c-testo": "--color-inchiostro",
    "--c-testo-m": "--color-inchiostro-medio",
    "--c-testo2": "--color-inchiostro-2",
    "--c-testo3": "--color-inchiostro-3",
    "--c-su": "--color-latte",
    "--c-su2": "--color-latte-2",
    "--c-link": "--color-link",
    "--c-pieno": "--color-pieno",
    "--c-accento": "--color-azione",
    "--c-notte": "--color-notte",
    "--c-logo-a": "--color-logo-a",
    "--c-logo-b": "--color-logo-b",
    "--c-logo-a-notte": "--color-logo-a-notte",
    "--c-logo-b-notte": "--color-logo-b-notte",
    "--c-fumetto": "--color-fumetto",
    "--c-assistente": "--color-assistente",
    "--c-errore": "--color-allerta",
    "--c-errore-pieno": "--color-allerta-pieno",
    "--c-errore-fondo": "--color-allerta-fondo",
    "--c-errore-bordo": "--color-allerta-bordo",
    "--c-adesso": "--color-adesso",
    "--c-adesso-testo": "--color-adesso-testo",
    "--c-liberi": "--color-insieme",
    "--c-liberi-barra": "--color-insieme-bordo",
    "--c-liberi-testo": "--color-insieme-testo",
    "--c-casa-barra": "--color-membro-neutro-corsia",
    "--c-casa-fondo": "--color-membro-neutro-tinta",
    "--c-iniziale": "--color-iniziale",
    "--c-iniziale-blu": "--color-iniziale-blu",
    "--c-rosa": "--color-membro-rosa",
    "--c-nessuno": "--color-nessuno",
    "--c-conferma": "--color-conferma",
    "--c-conferma-fondo": "--color-conferma-fondo",
    "--c-aiutante": "--color-aiutante",
    "--c-piano-icona-1": "--color-piano-icona-1",
    "--c-piano-icona-2": "--color-piano-icona-2",
  };
  const fromTable = fixed[role];
  if (fromTable) return fromTable;
  const person = /^--c-([a-z]+?)(-barra|-fondo)?$/.exec(role);
  const shade = person ? PEOPLE[person[1]!] : undefined;
  if (person && shade) {
    const suffix =
      person[2] === "-barra"
        ? "-corsia"
        : person[2] === "-fondo"
          ? "-tinta"
          : "";
    return `--color-membro-${shade}${suffix}`;
  }
  throw new Error(`Ruolo senza token: ${role}`);
}

/** Text of a stylesheet without the comments. */
export function cssWithoutComments(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}
