import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { MEMBER_COLOR_CODES } from "../../src/lib/member-colors";

// #196 (F2 token e font): token values, colours of the people, contrasts.
// Everything runs on /design-system, which is public.

const BASE_PATH = "/design-system";

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_PATH);
});

// ---------------------------------------------------------------- helpers

// The production build rewrites colours (#ffffff -> #fff, rgba -> #rrggbbaa)
// and ms -> s: both sides are compared in the same canonical form.
function canonicalColor(value: string): string {
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
    .replace(/([\d.]+)ms\b/g, (_, ms: string) => `${Number(ms) / 1000}s`);
}

const normalize = (value: string) =>
  canonicalColor(value.replace(/\s+/g, "").toLowerCase()).replace(
    /(^|[^0-9])\.(\d)/g,
    "$10.$2",
  );

async function rootValues(page: Page, names: string[]) {
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

/** Colour as [r, g, b] from #rgb, #rrggbb or rgb(...). */
function rgbOf(value: string): [number, number, number] {
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

function luminance(value: string): number {
  const [r, g, b] = rgbOf(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function hueOf(value: string): number {
  const [r, g, b] = rgbOf(value).map((c) => c / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

const rgbString = (hex: string) => `rgb(${rgbOf(hex).join(", ")})`;

// Shade of each database code (spec §5), written here on purpose: the test
// must not read it from the module it checks.
const SHADE: Record<string, string> = {
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
const WHITE_INITIAL = ["cobalto", "basilico"];

// ---------------------------------------------------------------- token

test.describe("token", () => {
  test("CA-9: i token di :root coincidono con docs/agenti/design/token.css", async ({
    page,
  }) => {
    // #634: the file has the light :root first, then the two dark blocks.
    const whole = readFileSync("docs/agenti/design/token.css", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const css = whole.slice(0, whole.indexOf("\n}\n"));
    const tokens: Record<string, string> = {};
    for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens[match[1]!] = match[2]!;
    }
    const names = Object.keys(tokens);
    expect(names.length).toBeGreaterThan(200);

    // Every custom property declared in a :root rule of the loaded stylesheets.
    const declared = await page.evaluate(() => {
      const found = new Set<string>();
      const visit = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            for (const name of Array.from(rule.style)) {
              if (name.startsWith("--")) found.add(name);
            }
          } else if ("cssRules" in rule) {
            visit((rule as CSSGroupingRule).cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          visit(sheet.cssRules);
        } catch {
          // cross-origin sheet: not ours
        }
      }
      return [...found];
    });
    // Both directions: nothing missing, nothing extra. #634: the CSS minifier
    // turns `color-scheme` into two helper properties.
    expect(
      declared.filter((name) => !name.startsWith("--lightningcss-")).sort(),
    ).toEqual([...names].sort());

    const actual = await rootValues(page, names);
    for (const name of names) {
      // The two font tokens point to the variable of next/font (CA-2).
      if (name === "--font-titoli" || name === "--font-testo") continue;
      // The browser reports custom properties with var() already resolved.
      let source = tokens[name]!;
      while (/var\((--[a-z0-9-]+)\)/.test(source)) {
        source = source.replace(
          /var\((--[a-z0-9-]+)\)/g,
          (_, ref: string) => tokens[ref]!,
        );
      }
      expect(normalize(actual[name]!), name).toBe(normalize(source));
    }
  });

  test("CA-10: i valori di §3-§6 della specifica sono nel :root", async ({
    page,
  }) => {
    const wanted: Record<string, string> = {
      // §3 text
      "--text-titolo-pagina-size": "1.875rem",
      "--text-titolo-pagina-line": "2.25rem",
      "--text-titolo-pagina-tracking": "-0.02em",
      "--text-titolo-sezione-size": "1.3125rem",
      "--text-titolo-sezione-line": "1.6875rem",
      "--text-titolo-sezione-tracking": "-0.012em",
      "--text-sottotitolo-size": "1.0625rem",
      "--text-sottotitolo-line": "1.5625rem",
      "--text-titolo-barra-size": "1rem",
      "--text-titolo-barra-line": "1.375rem",
      "--text-controllo-size": "1rem",
      "--text-controllo-line": "1.375rem",
      "--text-etichetta-tracking": "0",
      "--text-tag-size": "0.75rem",
      "--text-tag-line": "1rem",
      // §2 weights
      "--weight-sottile": "400",
      "--weight-normale": "400",
      "--weight-medio": "400",
      "--weight-semi": "600",
      "--weight-forte": "600",
      "--weight-pieno": "700",
      // §4 interface colours
      "--color-inchiostro": "#10262A",
      "--color-inchiostro-2": "#55686C",
      "--color-inchiostro-2-fondo": "#4A5F63",
      "--color-inchiostro-3": "#8A989A",
      "--color-azione": "#0F3D44",
      "--color-azione-premuto": "#0A2D33",
      "--color-carta": "#FFFFFF",
      "--color-superficie": "#FFFFFF",
      "--color-carta-2": "#F4F6F4",
      "--color-fondo-app": "#F5F6F4",
      "--color-premuto": "#ECEFEC",
      "--color-scelta-tenue": "#E2E9E5",
      "--color-anello-scelta": "#B5CBCB",
      "--color-filo": "#E4E8E5",
      "--color-filo-2": "#C3CCC9",
      // #634: the light values follow docs/design/tavolozza.json.
      "--color-filo-campo": "#869390",
      "--color-filo-tenue": "#AEB9B7",
      "--color-filo-barra": "rgba(16, 38, 42, 0.1)",
      "--color-corsia-vuota": "#EEF1EF",
      "--color-allerta": "#B3261E",
      "--color-allerta-fondo": "#FCEEEA",
      "--color-scaduto": "#A8321F",
      "--color-ok": "#1B6B45",
      "--color-adesso": "#F6C945",
      "--color-adesso-tinta": "#FCEFC0",
      "--color-insieme": "#FCEFC0",
      "--color-insieme-testo": "#4A4630",
      "--color-insieme-bordo": "#A38009",
      "--color-ombra": "rgba(16, 38, 42, 0.08)",
      "--color-ombra-forte": "rgba(16, 38, 42, 0.2)",
      // §4 scene of Oggi
      "--color-scena-mattino-cielo": "#BFE3F7",
      "--color-scena-mattino-casa-1": "#7DBFC2",
      "--color-scena-mattino-casa-2": "#4E9DA6",
      "--color-scena-mattino-sole": "#FFB84D",
      "--color-scena-pomeriggio-cielo": "#7FC4F2",
      "--color-scena-pomeriggio-casa-1": "#57B0B5",
      "--color-scena-pomeriggio-casa-2": "#2F8F99",
      "--color-scena-pomeriggio-sole": "#FFF1A8",
      "--color-scena-sera-cielo": "#35539E",
      "--color-scena-sera-casa-1": "#2A7F80",
      "--color-scena-sera-casa-2": "#0C4A52",
      "--color-scena-sera-sole": "#FF9E3C",
      "--color-scena-tetto": "#0F3D44",
      // §5 colours of the people
      "--color-membro-corallo": "#F2765C",
      "--color-membro-corallo-tinta": "#FDEAE5",
      "--color-membro-corallo-corsia": "#D75E45",
      "--color-membro-glicine": "#B9A2EC",
      "--color-membro-glicine-tinta": "#F2ECFC",
      "--color-membro-glicine-corsia": "#8F78BF",
      "--color-membro-menta": "#8FD0A8",
      "--color-membro-menta-tinta": "#E7F5EC",
      "--color-membro-menta-corsia": "#54936E",
      "--color-membro-blu": "#3F6FE0",
      "--color-membro-blu-tinta": "#E5ECFC",
      "--color-membro-blu-corsia": "#3F6FE0",
      "--color-membro-ambra": "#E8A15C",
      "--color-membro-ambra-tinta": "#FCEEDD",
      "--color-membro-ambra-corsia": "#B9762E",
      "--color-membro-sabbia": "#D9B88F",
      "--color-membro-sabbia-tinta": "#FAF5EF",
      "--color-membro-sabbia-corsia": "#A3845D",
      "--color-membro-azzurro": "#7CC7E0",
      "--color-membro-azzurro-tinta": "#EDF7FB",
      "--color-membro-azzurro-corsia": "#4792AA",
      "--color-membro-rosa": "#F0A3C0",
      "--color-membro-rosa-tinta": "#FDF2F6",
      "--color-membro-rosa-corsia": "#BC7390",
      "--color-membro-ardesia": "#68778D",
      "--color-membro-ardesia-tinta": "#EAECEF",
      "--color-membro-ardesia-corsia": "#68778D",
      "--color-membro-cannella": "#AF8273",
      "--color-membro-cannella-tinta": "#F5ECE8",
      "--color-membro-cannella-corsia": "#A67A6B",
      "--color-membro-neutro": "#B4BFBC",
      "--color-membro-neutro-tinta": "#EEF1EF",
      "--color-membro-neutro-corsia": "#55686C",
      // §6 sizes, radii, shadows, motion, links
      "--grid-margine-mobile": "24px",
      "--size-etichetta": "24px",
      "--size-campo": "56px",
      "--size-barra-alta": "56px",
      "--space-riga": "13px",
      "--space-link": "3px",
      "--border-link": "1.5px",
      "--radius-xl": "20px",
      "--radius-pulsante": "14px",
      "--radius-capsula": "28px",
      "--shadow-foglio": "0 -4px 16px -2px var(--color-ombra-forte)",
      "--shadow-menu":
        "0 1px 2px var(--color-ombra), 0 8px 20px -6px var(--color-ombra-forte)",
      "--shadow-disco": "0 2px 6px -1px var(--color-ombra-forte)",
      "--shadow-controllo": "0 1px 3px var(--color-ombra)",
      "--curva-entrata": "cubic-bezier(0.22, 1, 0.36, 1)",
      "--curva-scatto": "cubic-bezier(0.16, 1, 0.3, 1)",
      "--durata-apertura": "420ms",
      "--durata-barra": "520ms",
      "--durata-splash-breve": "1400ms",
      "--durata-splash-lungo": "2900ms",
    };
    const actual = await rootValues(page, Object.keys(wanted));
    for (const [name, value] of Object.entries(wanted)) {
      // var() is already resolved in the computed value: resolve the expected
      // one the same way, from the table itself.
      let expected = value;
      while (/var\((--[a-z0-9-]+)\)/.test(expected)) {
        expected = expected.replace(
          /var\((--[a-z0-9-]+)\)/g,
          (_, ref: string) => wanted[ref]!,
        );
      }
      expect(normalize(actual[name]!), name).toBe(normalize(expected));
    }
  });

  // #634: the four missing shades now exist (tavolozza, Passo 12).
  test("CA-11: i token spariti non esistono", async ({ page }) => {
    const gone = [
      "--color-membro-pomodoro",
      "--color-membro-salvia",
      "--color-membro-cobalto",
      "--color-membro-zafferano",
      "--color-membro-lampone",
      "--color-membro-ceruleo",
      "--color-membro-peonia",
      "--color-membro-basilico",
      "--font-parkinsans",
      "--font-host-grotesk",
    ];
    const values = await rootValues(page, gone);
    for (const name of gone) expect(values[name], name).toBe("");
  });

  test("CA-12: sulla galleria titolo pagina 700, etichetta 400, display 400", async ({
    page,
  }) => {
    await expect(page.getByTestId("t-titolo-pagina-esempio")).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(
      page.locator(".t-etichetta", { hasText: "OUTLOOK" }),
    ).toHaveCSS("font-weight", "400");
    await expect(page.getByTestId("t-display-esempio")).toHaveCSS(
      "font-weight",
      "400",
    );
  });

  test("CA-21: i contrasti di §7 calcolati sui token", async ({ page }) => {
    const names = [
      "--color-inchiostro",
      "--color-inchiostro-2",
      "--color-inchiostro-2-fondo",
      "--color-carta",
      "--color-carta-2",
      "--color-fondo-app",
      "--color-superficie",
      "--color-bianco",
      "--color-azione",
      "--color-azione-premuto",
      "--color-allerta",
      "--color-allerta-fondo",
      "--color-ok",
      "--color-scaduto",
      "--color-insieme",
      "--color-insieme-testo",
      "--color-adesso",
      "--color-adesso-tinta",
      "--color-filo-campo",
      "--color-info",
    ];
    const v = await rootValues(page, names);
    const rows: [string, string, number][] = [
      ["--color-inchiostro", "--color-carta", 4.5],
      ["--color-inchiostro", "--color-carta-2", 4.5],
      ["--color-inchiostro", "--color-fondo-app", 4.5],
      ["--color-inchiostro-2", "--color-carta", 4.5],
      ["--color-inchiostro-2", "--color-carta-2", 4.5],
      ["--color-inchiostro-2-fondo", "--color-fondo-app", 4.5],
      ["--color-bianco", "--color-azione", 4.5],
      ["--color-bianco", "--color-azione-premuto", 4.5],
      ["--color-bianco", "--color-allerta", 4.5],
      ["--color-allerta", "--color-superficie", 4.5],
      ["--color-allerta", "--color-allerta-fondo", 4.5],
      ["--color-ok", "--color-superficie", 4.5],
      ["--color-scaduto", "--color-superficie", 4.5],
      ["--color-insieme-testo", "--color-insieme", 4.5],
      ["--color-inchiostro", "--color-adesso", 4.5],
      ["--color-inchiostro", "--color-adesso-tinta", 4.5],
      ["--color-filo-campo", "--color-superficie", 3],
      // #634 (domanda 3): in light the field border is 2,93 on carta-2 and no
      // field sits on that ground, so the pairs on carta-2 and fondo-app go.
      ["--color-info", "--color-carta", 3],
      ["--color-info", "--color-carta-2", 3],
      ["--color-info", "--color-fondo-app", 3],
    ];
    for (const [fg, bg, minimum] of rows) {
      expect(
        contrast(v[fg]!, v[bg]!),
        `${fg} su ${bg} (minimo ${minimum})`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });
});

// ------------------------------------------------- colours of the people

/** Computed `--c`, `--c-tinta`, `--c-corsia`, `--c-iniziale` of `.membro-<name>`. */
async function memberVars(page: Page, names: string[]) {
  return page.evaluate((list) => {
    const out: Record<string, Record<string, string>> = {};
    for (const name of list) {
      const probe = document.createElement("span");
      probe.className = `membro-${name}`;
      document.body.append(probe);
      const style = getComputedStyle(probe);
      out[name] = Object.fromEntries(
        ["--c", "--c-tinta", "--c-corsia", "--c-iniziale"].map((variable) => [
          variable,
          style.getPropertyValue(variable).trim(),
        ]),
      );
      probe.remove();
    }
    return out;
  }, names);
}

test.describe("colori delle persone", () => {
  test("CA-16: gli avatar dei 10 colori hanno sfondo e iniziale giusti", async ({
    page,
  }) => {
    const avatars = page.getByTestId("avatar-dieci-colori").locator(".avatar");
    await expect(avatars).toHaveCount(10);
    const root = await rootValues(page, [
      "--color-inchiostro",
      "--color-bianco",
      ...MEMBER_COLOR_CODES.map((code) => `--color-membro-${SHADE[code]}`),
    ]);
    for (const [index, code] of MEMBER_COLOR_CODES.entries()) {
      const avatar = avatars.nth(index);
      await expect(avatar, `sfondo ${code}`).toHaveCSS(
        "background-color",
        rgbString(root[`--color-membro-${SHADE[code]}`]!),
      );
      const initial = WHITE_INITIAL.includes(code)
        ? "#FFFFFF"
        : root["--color-inchiostro"]!;
      await expect(avatar, `iniziale ${code}`).toHaveCSS(
        "color",
        rgbString(initial),
      );
    }
    expect(rgbString(root["--color-bianco"]!)).toBe("rgb(255, 255, 255)");
  });

  test("CA-17: la scelta del colore ha i nomi nuovi, nell'ordine", async ({
    page,
  }) => {
    const radios = page.getByTestId("scelta-colore-dieci").getByRole("radio");
    await expect(radios).toHaveCount(10);
    const wanted = [
      "Corallo (già di Laura)",
      "Glicine",
      "Menta",
      "Blu",
      "Ambra",
      "Sabbia",
      "Azzurro",
      "Rosa",
      "Ardesia",
      "Cannella",
    ];
    for (const [index, name] of wanted.entries()) {
      await expect(radios.nth(index)).toHaveAccessibleName(name);
    }
  });

  // #634: the four shades that used the neutral one have their own tint.
  test("CA-18: lampone, ceruleo, peonia e basilico hanno la propria tinta", async ({
    page,
  }) => {
    const tints: Record<string, string> = {
      lampone: "#faf5ef",
      ceruleo: "#edf7fb",
      peonia: "#fdf2f6",
      basilico: "#eaecef",
    };
    const vars = await memberVars(page, Object.keys(tints));
    for (const [name, tint] of Object.entries(tints)) {
      expect(normalize(vars[name]!["--c-tinta"]!), name).toBe(tint);
    }
  });

  test("CA-22: la corsia di ogni tinta ha contrasto 3:1 sui tre fondi e la stessa tonalità", async ({
    page,
  }) => {
    const codes = [...MEMBER_COLOR_CODES, "neutro"];
    const vars = await memberVars(page, codes);
    const base = await rootValues(page, [
      "--color-superficie",
      "--color-carta-2",
      "--color-corsia-vuota",
    ]);
    for (const code of codes) {
      const { "--c": colour, "--c-corsia": lane } = vars[code]!;
      expect(colour, `--c di ${code}`).not.toBe("");
      expect(lane, `--c-corsia di ${code}`).not.toBe("");
      for (const ground of Object.keys(base)) {
        expect(
          contrast(lane!, base[ground]!),
          `${code}: corsia su ${ground}`,
        ).toBeGreaterThanOrEqual(3);
      }
      // #634: the bar of "di casa" is the secondary ink (#55686C), no longer
      // a darker shade of the dot: the hue only holds for the ten colours.
      if (code === "neutro") continue;
      const gap = Math.abs(hueOf(colour!) - hueOf(lane!));
      expect(Math.min(gap, 360 - gap), `${code}: tonalità`).toBeLessThanOrEqual(
        2,
      );
    }
  });

  test("CA-21 (iniziali): l'iniziale ha 4,5:1 sul colore di ogni codice e del neutro", async ({
    page,
  }) => {
    const codes = [...MEMBER_COLOR_CODES, "neutro"];
    const vars = await memberVars(page, codes);
    for (const code of codes) {
      const { "--c": colour, "--c-iniziale": initial } = vars[code]!;
      expect(
        contrast(initial!, colour!),
        `${code}: iniziale su colore pieno`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
