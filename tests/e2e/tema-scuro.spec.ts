import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  contrast,
  cssWithoutComments,
  normalize,
  readRoles,
  rgbOf,
  rootValues,
  setAspetto,
  settleTheme,
  tokenOfRole,
} from "../fixtures/tema";

// #634 (shared/tema-scuro): the dark palette in the tokens. Everything runs on
// /design-system, which is public. "Al buio" = data-aspetto="scuro" set by the
// test; "sistema scuro" = colorScheme "dark" without the attribute (CA-6..9).

const BASE_PATH = "/design-system";

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_PATH);
});

const MEMBERS: Record<string, string> = {
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
  neutro: "neutro",
};

// Table B of the requirement: tokens without a role of the palette.
const TABLE_B: Record<string, [string, string]> = {
  "--color-scelta-tenue": ["#E2E9E5", "#263639"],
  "--color-azione-premuto": ["#0A2D33", "#1F7D8A"],
  "--color-allerta-scuro": ["#A82A27", "#C4483A"],
  "--color-filo-barra": ["rgba(16,38,42,.1)", "#2B3A3C"],
  "--color-adesso-tinta": ["#FCEFC0", "#3A3112"],
  "--color-occupato-1": ["#ECEDE7", "#172224"],
  "--color-occupato-2": ["#E4E5DE", "#263639"],
  "--color-ok": ["#1B6B45", "#8FD0CB"],
  "--color-info": ["#3355CC", "#EAF2EE"],
  "--color-avviso": ["#A15C07", "#EAF2EE"],
  "--color-membro-neutro": ["#B4BFBC", "#B4BFBC"],
  "--color-notte-2": ["#2A2925", "#2A2925"],
  "--color-membro-sabbia-corsia": ["#A3845D", "#D9B88F"],
  "--color-membro-azzurro-corsia": ["#4792AA", "#7CC7E0"],
  "--color-membro-rosa-corsia": ["#BC7390", "#F0A3C0"],
  "--color-membro-ardesia-corsia": ["#68778D", "#68778D"],
  "--color-membro-sabbia-tinta": ["#FAF5EF", "#1E2B2E"],
  "--color-membro-azzurro-tinta": ["#EDF7FB", "#1E2B2E"],
  "--color-membro-rosa-tinta": ["#FDF2F6", "#1E2B2E"],
  "--color-membro-ardesia-tinta": ["#EAECEF", "#1E2B2E"],
};

// Tokens replaced by a role: nobody may use them (table C of the requirement).
const SUPERSEDED = [
  "--color-fondo-app",
  "--color-anello-scelta",
  "--color-filo-tenue",
  "--color-inchiostro-2-fondo",
  "--color-corsia-vuota",
  "--color-scaduto",
  "--color-azione-premuto", // spec 634, §2 and §3 C
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Declarations of the rule that starts at `opening` (balanced braces). */
function blockAfter(css: string, opening: string): string {
  const start = css.indexOf(opening);
  expect(start, `blocco ${opening}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`blocco non chiuso: ${opening}`);
}

const declarations = (block: string) =>
  [...block.matchAll(/(--[a-z0-9-]+|color-scheme)\s*:\s*([^;]+);/g)].map(
    (match) => `${match[1]}:${normalize(match[2]!)}`,
  );

// ----------------------------------------------------------------- valori

test.describe("valori dei token", () => {
  test("CA-1: in chiaro ogni ruolo vale il suo valore chiaro", async ({
    page,
  }) => {
    const roles = readRoles();
    expect(roles).toHaveLength(75);
    const tokens = roles.map((role) => tokenOfRole(role.nome));
    const actual = await rootValues(page, tokens);
    for (const role of roles) {
      const token = tokenOfRole(role.nome);
      expect(normalize(actual[token]!), `${role.nome} -> ${token}`).toBe(
        normalize(role.chiaro),
      );
    }
  });

  test("CA-2: al buio ogni ruolo vale il suo valore scuro", async ({
    page,
  }) => {
    await setAspetto(page, "scuro");
    const roles = readRoles();
    const actual = await rootValues(
      page,
      roles.map((role) => tokenOfRole(role.nome)),
    );
    for (const role of roles) {
      const token = tokenOfRole(role.nome);
      const wanted = role.uguale_nei_due_temi ? role.chiaro : role.scuro;
      expect(normalize(actual[token]!), `${role.nome} -> ${token}`).toBe(
        normalize(wanted),
      );
    }
    expect(normalize(actual["--color-membro-blu-corsia"]!)).toBe("#4e7be2");
  });

  test("CA-3: i token senza ruolo valgono i valori della tabella B", async ({
    page,
  }) => {
    const names = Object.keys(TABLE_B);
    const light = await rootValues(page, names);
    await setAspetto(page, "scuro");
    const dark = await rootValues(page, names);
    for (const [name, [lightValue, darkValue]] of Object.entries(TABLE_B)) {
      expect(normalize(light[name]!), `${name} chiaro`).toBe(
        normalize(lightValue),
      );
      expect(normalize(dark[name]!), `${name} scuro`).toBe(
        normalize(darkValue),
      );
    }
  });

  test("CA-4: i due blocchi scuri sono identici, e token.css li copia", () => {
    const app = cssWithoutComments("src/app/globals.css");
    const reference = cssWithoutComments("docs/agenti/design/token.css");
    const attribute = declarations(
      blockAfter(app, ':root[data-aspetto="scuro"]'),
    );
    const system = declarations(
      blockAfter(
        blockAfter(app, "@media (prefers-color-scheme: dark)") + "}",
        ':root:not([data-aspetto="chiaro"])',
      ),
    );
    expect(attribute.length).toBeGreaterThan(60);
    expect(system).toEqual(attribute);
    for (const css of [app, reference]) {
      expect(declarations(blockAfter(css, ":root {")).length).toBeGreaterThan(
        200,
      );
    }
    // token.css has the same three blocks as globals.css.
    expect(
      declarations(blockAfter(reference, ':root[data-aspetto="scuro"]')),
    ).toEqual(attribute);
    expect(declarations(blockAfter(reference, ":root {"))).toEqual(
      declarations(blockAfter(app, ":root {")),
    );
  });

  test("CA-5: nessun ruolo --c-* fuori da .membro-*, nessun token superato in uso", () => {
    const roleNames = readRoles()
      .map((role) => role.nome)
      .filter((name) => name !== "--c-iniziale");
    const files = walk("src").filter((file) => /\.(css|tsx?)$/.test(file));
    for (const file of files) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const name of roleNames) {
        expect(
          new RegExp(`${name}\\s*:`).test(text),
          `${name} definito in ${file}`,
        ).toBe(false);
      }
      for (const token of SUPERSEDED) {
        if (file.endsWith("src/app/globals.css")) continue;
        expect(
          text.includes(`var(${token})`),
          `${token} usato in ${file}`,
        ).toBe(false);
      }
    }
    // --c-iniziale only inside the .membro-* classes.
    const components = cssWithoutComments("src/app/components.css");
    for (const match of components.matchAll(
      /([^{}]+)\{[^{}]*--c-iniziale\s*:[^{}]*\}/g,
    )) {
      expect(match[1]!.trim(), "--c-iniziale").toMatch(/^\.membro-/);
    }
  });
});

// -------------------------------------------------------------- accensione

test.describe("accensione del tema", () => {
  // The theme is plain CSS: no script of the page runs. The attribute is put
  // with page.evaluate, which does not depend on the scripts of the page.
  test.describe("senza JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("CA-6: data-aspetto scuro con il sistema chiaro", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await setAspetto(page, "scuro");
      expect((await rootValues(page, ["--color-carta"]))["--color-carta"]).toBe(
        "#0f1819",
      );
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      ).toBe("dark");
    });

    test("CA-7: data-aspetto chiaro con il sistema scuro", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await setAspetto(page, "chiaro");
      expect(
        normalize(
          (await rootValues(page, ["--color-carta"]))["--color-carta"]!,
        ),
      ).toBe("#ffffff");
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      ).toBe("light");
    });

    for (const value of [null, "sistema", "blu"]) {
      test(`CA-8/9: attributo ${value ?? "assente"}: segue il sistema`, async ({
        page,
      }) => {
        await setAspetto(page, value);
        await page.emulateMedia({ colorScheme: "dark" });
        expect(
          (await rootValues(page, ["--color-carta"]))["--color-carta"],
        ).toBe("#0f1819");
        await page.emulateMedia({ colorScheme: "light" });
        expect(
          normalize(
            (await rootValues(page, ["--color-carta"]))["--color-carta"]!,
          ),
        ).toBe("#ffffff");
      });
    }
  });

  test("CA-10 e CA-11: il cambio è immediato e non tocca i dati del browser", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    const snapshot = () =>
      page.evaluate(() => ({
        cookie: document.cookie,
        local: JSON.stringify({ ...localStorage }),
        session: JSON.stringify({ ...sessionStorage }),
      }));
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const before = await snapshot();
    const light = await background();
    await setAspetto(page, "scuro");
    expect(normalize(await background())).toBe("#0f1819");
    await setAspetto(page, null);
    expect(await background()).toBe(light);
    expect(await snapshot()).toEqual(before);
  });

  test("CA-12: i modelli delle mail non hanno il tema scuro", () => {
    const files = [
      ...walk("docs/mockup/mail").filter((file) => file.endsWith(".html")),
      ...walk("src").filter(
        (file) => /mail/i.test(file) && /\.(html|tsx?)$/.test(file),
      ),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("prefers-color-scheme");
      expect(text, file).not.toContain("data-aspetto");
    }
  });
});

// ------------------------------------------------- riempimenti e componenti

test.describe("riempimenti", () => {
  test("CA-13: components.css non usa l'inchiostro come fondo pieno", () => {
    const css = cssWithoutComments("src/app/components.css");
    expect(css).not.toMatch(
      /(?:background|background-color|fill)\s*:\s*var\(--color-(?:inchiostro|allerta)\)/,
    );
    for (const rule of css.matchAll(/\{([^{}]*)\}/g)) {
      const body = rule[1]!;
      if (/background(?:-color)?\s*:\s*var\(--color-pieno\)/.test(body)) {
        expect(body).not.toMatch(/color\s*:\s*var\(--color-superficie\)/);
        expect(body).not.toContain("--color-latte-2");
      }
      // Dark text over a fixed light ground must follow the role, not the theme.
      if (
        /background(?:-color)?\s*:\s*var\((?:--color-latte|--c|--color-adesso)\)/.test(
          body,
        )
      ) {
        expect(body).not.toMatch(
          /(?:^|[;\s])color\s*:\s*var\(--color-inchiostro\)/,
        );
      }
    }
    // No colour written by hand.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(/);
  });

  test("CA-14: al buio i pieni sono verdi con il testo bianco", async ({
    page,
  }) => {
    await setAspetto(page, "scuro");
    // A chip of the plain group, pressed (the pointer must not hover it).
    await page
      .getByTestId("chip-predefinito")
      .getByRole("button")
      .first()
      .click();
    await page.mouse.move(0, 0);
    await settleTheme(page);
    const read = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, color: style.color };
        });
    for (const selector of [
      ".btn-primary",
      '.toggle[aria-checked="true"]',
      '.chip:not(.chip--persona)[aria-pressed="true"]',
      '.casella[aria-checked="true"]',
    ]) {
      const value = await read(selector);
      expect(normalize(value.background), selector).toBe("#1f7d8a");
      if (!selector.startsWith(".toggle")) {
        expect(normalize(value.color), `${selector} testo`).toBe("#ffffff");
      }
    }
    // Round tick: checked, the disc is green and the mark is white.
    await page.getByTestId("tondo-vuoto").click();
    await page.mouse.move(0, 0);
    await settleTheme(page);
    const tick = await read('.tondo-spunta[aria-checked="true"]');
    expect(normalize(tick.background), "spunta fondo").toBe("#1f7d8a");
    expect(normalize(tick.color), "spunta segno").toBe("#ffffff");
    // Switch on: the knob (::after) is white, not the colour of the surface.
    const knob = await page
      .locator('.toggle[aria-checked="true"]')
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").backgroundColor);
    expect(normalize(knob), "pallino").toBe("#ffffff");
    const danger = await read(".btn-pericolo-pieno");
    expect(normalize(danger.background)).toBe("#c4483a");
    expect(normalize(danger.color)).toBe("#ffffff");
    await page.getByTestId("toast-mostra").click();
    const toast = page.locator(".toast").first();
    await expect(toast).toBeVisible();
    expect(
      normalize(
        await toast.evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    ).toBe("#2f4448");
  });

  test("CA-14/15: bordo del campo e anello del fuoco nei due temi", async ({
    page,
  }) => {
    const field = page.locator("#campo .campo__input").first();
    const border = () => field.evaluate((el) => getComputedStyle(el).boxShadow);
    // The ring of a focused button: keyboard focus, so :focus-visible applies.
    const ringOf = async (target: Locator) => {
      await target.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      return page.evaluate(
        () => getComputedStyle(document.activeElement!).outlineColor,
      );
    };
    const ring = () =>
      ringOf(page.getByRole("button", { name: "Apri foglio" }));
    // On the brand ground (inside .tema-notte) the ring is --color-latte.
    const brandRing = () => ringOf(page.getByTestId("btn-chiaro-predefinito"));
    expect(rgbHex(await border())).toBe("#869390");
    expect(rgbHex(await ring())).toBe("#0f3d44");
    expect(rgbHex(await brandRing())).toBe("#ffffff");
    await setAspetto(page, "scuro");
    expect(rgbHex(await border())).toBe("#7e9496");
    expect(rgbHex(await ring())).toBe("#f2f7f5");
    expect(rgbHex(await brandRing())).toBe("#ffffff");
  });

  test("CA-15: in chiaro il pulsante principale è #10262a con il testo #ffffff", async ({
    page,
  }) => {
    // Values written from the palette (tavolozza.json, --c-pieno and --c-su),
    // not read back from the CSS.
    await page.mouse.move(0, 0);
    await settleTheme(page);
    const primary = await page
      .locator(".btn-primary")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      });
    expect(rgbHex(primary.background)).toBe("#10262a");
    expect(rgbHex(primary.color)).toBe("#ffffff");
  });

  test("CA-16: al buio il testo sopra il verde è bianco", async ({ page }) => {
    await setAspetto(page, "scuro");
    const wrong = await page.evaluate(() => {
      const found: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>("body *")) {
        const style = getComputedStyle(element);
        if (style.backgroundColor !== "rgb(31, 125, 138)") continue;
        const hasText = Array.from(element.childNodes).some(
          (node) => node.nodeType === 3 && node.textContent!.trim() !== "",
        );
        const hasIcon = element.querySelector(".icona") !== null;
        if ((hasText || hasIcon) && style.color !== "rgb(255, 255, 255)") {
          found.push(`${element.className} ${style.color}`);
        }
      }
      return found;
    });
    expect(wrong).toEqual([]);
  });

  test("CA-17: vuoto e avviso d'errore al buio", async ({ page }) => {
    await setAspetto(page, "scuro");
    const empty = page
      .getByTestId("base-vuoto-box")
      .locator(".stato-vuoto-box");
    expect(
      normalize(await empty.evaluate((el) => getComputedStyle(el).color)),
    ).toBe("#eaf2ee");
    const alert = page.getByTestId("avviso-errore");
    const colors = await alert.evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      icon: getComputedStyle(el.querySelector(".icona")!).color,
      text: getComputedStyle(el).color,
    }));
    expect(normalize(colors.background)).toBe("#3a1e1b");
    expect(normalize(colors.icon)).toBe("#ff9d90");
    expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

/** "rgb(r, g, b) 0px 0px 0px 1px inset" -> "#rrggbb". */
function rgbHex(shadow: string): string {
  const [r, g, b] = rgbOf(shadow.trim());
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// ----------------------------------------------------------------- persone

async function memberColors(page: Page) {
  type Colors = {
    c: string;
    corsia: string;
    tinta: string;
    spento: string;
    iniziale: string;
  };
  return page.evaluate((codes) => {
    const out: Record<string, Colors> = {};
    for (const code of codes) {
      const probe = document.createElement("span");
      probe.className = `membro-${code}`;
      document.body.append(probe);
      const read = (variable: string) => {
        probe.style.backgroundColor = `var(${variable})`;
        return getComputedStyle(probe).backgroundColor;
      };
      out[code] = {
        c: read("--c"),
        corsia: read("--c-corsia"),
        tinta: read("--c-tinta"),
        spento: read("--c-spento"),
        iniziale: read("--c-iniziale"),
      };
      probe.remove();
    }
    return out;
  }, Object.keys(MEMBERS));
}

const hex = (value: string) => {
  const [r, g, b] = rgbOf(value);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

test.describe("persone", () => {
  test("CA-18: pieno uguale nei due temi, barretta e fondo dal tema", async ({
    page,
  }) => {
    const light = await memberColors(page);
    await setAspetto(page, "scuro");
    const dark = await memberColors(page);
    for (const code of Object.keys(MEMBERS)) {
      expect(dark[code]!.c, `${code} pieno`).toBe(light[code]!.c);
    }
    // Table A/B: the bar at night is the full colour (Tommaso: #4E7BE2).
    for (const code of Object.keys(MEMBERS)) {
      if (code === "cobalto") continue;
      if (code === "neutro") continue;
      expect(hex(dark[code]!.corsia), `${code} barretta`).toBe(
        hex(dark[code]!.c),
      );
    }
    expect(hex(dark.cobalto!.corsia)).toBe("#4e7be2");
    expect(hex(dark.pomodoro!.tinta)).toBe("#452f29");
    expect(hex(dark.lampone!.tinta)).toBe("#1e2b2e");
    expect(hex(light.lampone!.tinta)).toBe("#faf5ef");
  });

  test("CA-19: --c-spento è il 30% del pieno sopra la carta del tema", async ({
    page,
  }) => {
    const check = (
      colors: Awaited<ReturnType<typeof memberColors>>,
      carta: string,
      label: string,
    ) => {
      for (const [code, value] of Object.entries(colors)) {
        const full = rgbOf(value.c);
        const base = rgbOf(carta);
        const spento = rgbOf(value.spento);
        full.forEach((channel, index) => {
          const wanted = Math.round(channel * 0.3 + base[index]! * 0.7);
          expect(
            Math.abs(spento[index]! - wanted),
            `${label} ${code} canale ${index}`,
          ).toBeLessThanOrEqual(1);
        });
      }
    };
    const light = await memberColors(page);
    check(light, "#ffffff", "chiaro");
    expect(hex(light.pomodoro!.spento)).toMatch(/^#fbd[56]c[de]$/);
    await setAspetto(page, "scuro");
    const dark = await memberColors(page);
    check(dark, "#0f1819", "scuro");
  });

  test("CA-20: le iniziali dei pallini hanno almeno 4,5:1", async ({
    page,
  }) => {
    for (const theme of ["chiaro", "scuro"] as const) {
      await setAspetto(page, theme);
      const colors = await memberColors(page);
      const ink = hex(
        (await rootValues(page, ["--color-inchiostro"]))["--color-inchiostro"]!,
      );
      for (const [code, value] of Object.entries(colors)) {
        expect(
          contrast(value.iniziale, value.c),
          `${theme} ${code} scelto`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(ink, value.spento),
          `${theme} ${code} non scelto`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("CA-21: la barretta sul fondo dell'impegno ha almeno 3:1", async ({
    page,
  }) => {
    for (const theme of ["chiaro", "scuro"] as const) {
      await setAspetto(page, theme);
      const colors = await memberColors(page);
      for (const [code, value] of Object.entries(colors)) {
        expect(
          contrast(value.corsia, value.tinta),
          `${theme} ${code}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// --------------------------------------------------------------- contrasti

const PAGE_GROUNDS = [
  "--color-carta",
  "--color-superficie",
  "--color-carta-2",
  "--color-premuto",
];

const TEXT_PAIRS: [string, string[]][] = [
  ["--color-inchiostro", PAGE_GROUNDS],
  ["--color-inchiostro-medio", PAGE_GROUNDS],
  ["--color-inchiostro-2", PAGE_GROUNDS],
  ["--color-link", ["--color-carta", "--color-superficie"]],
  [
    "--color-allerta",
    ["--color-carta", "--color-superficie", "--color-allerta-fondo"],
  ],
  [
    "--color-latte",
    [
      "--color-pieno",
      "--color-fumetto",
      "--color-allerta-pieno",
      "--color-notte",
    ],
  ],
  ["--color-latte-2", ["--color-fumetto", "--color-notte"]],
  ["--color-insieme-testo", ["--color-insieme"]],
  ["--color-segnaposto-testo", ["--color-segnaposto"]],
  ["--color-adesso-testo", ["--color-adesso"]],
  [
    "--color-inchiostro",
    [
      "--color-membro-corallo-tinta",
      "--color-membro-glicine-tinta",
      "--color-membro-menta-tinta",
      "--color-membro-blu-tinta",
      "--color-membro-ambra-tinta",
      "--color-membro-sabbia-tinta",
      "--color-membro-azzurro-tinta",
      "--color-membro-rosa-tinta",
      "--color-membro-ardesia-tinta",
      "--color-membro-cannella-tinta",
      "--color-membro-neutro-tinta",
    ],
  ],
];

const ELEMENT_PAIRS: [string, string, string?][] = [
  ["--color-filo-campo", "--color-carta"],
  ["--color-filo-campo", "--color-superficie"],
  ["--color-fuoco", "--color-carta"],
  ["--color-fuoco", "--color-superficie"],
  ["--color-fuoco", "--color-carta-2"],
  ["--color-pieno", "--color-carta"],
  ["--color-pieno", "--color-superficie"],
  ["--color-pieno", "--color-carta-2"],
  ["--color-allerta-pieno", "--color-carta"],
  ["--color-conferma", "--color-carta"],
  ["--color-conferma", "--color-superficie"],
  ["--color-insieme-bordo", "--color-insieme"],
  ["--color-piano-icona-1", "--color-conferma"],
  ["--color-piano-icona-2", "--color-inchiostro"],
];

test.describe("contrasti", () => {
  for (const theme of ["chiaro", "scuro"] as const) {
    test(`CA-22: coppie di testo almeno 4,5:1 (${theme})`, async ({ page }) => {
      await setAspetto(page, theme);
      const names = [
        ...new Set(TEXT_PAIRS.flatMap(([fg, bgs]) => [fg, ...bgs])),
      ];
      const values = await rootValues(page, names);
      for (const [fg, backgrounds] of TEXT_PAIRS) {
        for (const bg of backgrounds) {
          expect(
            contrast(values[fg]!, values[bg]!),
            `${theme}: ${fg} su ${bg}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test(`CA-23: coppie di elementi almeno 3:1 (${theme})`, async ({
      page,
    }) => {
      await setAspetto(page, theme);
      const names = [...new Set(ELEMENT_PAIRS.flatMap(([a, b]) => [a, b]))];
      const values = await rootValues(page, names);
      for (const [fg, bg] of ELEMENT_PAIRS) {
        // The disc of Plus Max is the ink of the theme: pair spelled in §7 of
        // the spec with the colour the icon really sits on.
        expect(
          contrast(values[fg]!, values[bg]!),
          `${theme}: ${fg} su ${bg}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test("CA-23 (eccezioni): ognuna col suo motivo", async ({ page }) => {
    const values = await rootValues(page, [
      "--color-pieno",
      "--color-premuto",
      "--color-filo-campo",
      "--color-carta-2",
    ]);
    // pieno su premuto, al buio: 2,61. Il verde non è mai l'unico segnale:
    // c'è sempre la spunta o il testo (risposta 202).
    await setAspetto(page, "scuro");
    const dark = await rootValues(page, ["--color-pieno", "--color-premuto"]);
    expect(
      contrast(dark["--color-pieno"]!, dark["--color-premuto"]!),
    ).toBeGreaterThan(2.5);
    // filo-campo su carta-2, in chiaro: 2,93. Nessun campo sta su quel fondo
    // (domanda 3 dell'analista, §7 della specifica).
    expect(
      contrast(values["--color-filo-campo"]!, values["--color-carta-2"]!),
    ).toBeGreaterThan(2.9);
  });
});

// -------------------------------------------------------------------- gancio

test.describe("solo-chiaro e solo-scuro", () => {
  test.use({ javaScriptEnabled: false });

  const visible = (page: Page, id: string) => page.getByTestId(id).isVisible();

  test("CA-25: si vede solo l'immagine del tema in uso", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await setAspetto(page, null);
    expect(await visible(page, "solo-chiaro")).toBe(true);
    expect(await visible(page, "solo-scuro")).toBe(false);
    await setAspetto(page, "scuro");
    expect(await visible(page, "solo-chiaro")).toBe(false);
    expect(await visible(page, "solo-scuro")).toBe(true);
    await page.emulateMedia({ colorScheme: "dark" });
    await setAspetto(page, null);
    expect(await visible(page, "solo-chiaro")).toBe(false);
    expect(await visible(page, "solo-scuro")).toBe(true);
    await setAspetto(page, "chiaro");
    expect(await visible(page, "solo-chiaro")).toBe(true);
    expect(await visible(page, "solo-scuro")).toBe(false);
  });
});

// ------------------------------------------------------------ diff della PR

// CA-27 and CA-28 read the diff of the branch against origin/main. Meaningful
// only on the branch of #634 (elsewhere the list of changed files says nothing
// about this issue). If the shared history is missing the test fails, never
// returns early (LEZIONI).
function gitOut(args: string[]): string | null {
  try {
    return execFileSync("git", ["-c", "safe.directory=*", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function onTemaScuroBranch(): boolean {
  const branch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    gitOut(["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ||
    "";
  return /(^|\/)tema-scuro$/.test(branch);
}

function diffAgainstMain(flags: string[], paths: string[] = []): string {
  const args = ["diff", ...flags, "origin/main...HEAD", "--", ...paths];
  let out = gitOut(args);
  if (out === null) {
    gitOut([
      "fetch",
      "--no-tags",
      "--deepen=200",
      "origin",
      "+main:refs/remotes/origin/main",
    ]);
    out = gitOut(args);
  }
  expect(
    out,
    "storia comune con origin/main non disponibile: CA-27/CA-28 non verificabili",
  ).not.toBeNull();
  return out ?? "";
}

test.describe("diff della PR", () => {
  // The two tests share the git history (the first one may deepen the shallow
  // clone): same worker, one after the other, and only on the desktop project
  // (the diff does not depend on the viewport; two workers fetching at the
  // same time would lock each other out).
  test.describe.configure({ mode: "serial" });

  test("CA-27: la PR non aggiunge test.skip né test.fixme", ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "il diff non dipende dal viewport: gira una volta sola",
    );
    test.skip(!onTemaScuroBranch(), "vale solo sul branch di #634");
    // This file is left out: it quotes the patterns it looks for.
    const added = diffAgainstMain(
      ["-U0"],
      ["tests", ":(exclude)tests/e2e/tema-scuro.spec.ts"],
    )
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
    // A conditional skip (condition first) is the project's way to guard a
    // test that needs seeded users; an unconditional skip (title first, or
    // no argument) and every fixme are forbidden.
    const forbidden = added.filter((line) =>
      /\.fixme\b|\.skip\s*\(\s*(["'`]|\))|\.skip\s*;|\.describe\.skip\b/.test(
        line,
      ),
    );
    expect(forbidden).toEqual([]);
  });

  test("CA-28: la PR tocca solo i file ammessi, niente supabase né pagine", ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "il diff non dipende dal viewport: gira una volta sola",
    );
    test.skip(!onTemaScuroBranch(), "vale solo sul branch di #634");
    const files = diffAgainstMain(["--name-only"]).split("\n").filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const allowed = [
      /^src\/app\/globals\.css$/,
      /^src\/app\/components\.css$/,
      /^docs\/agenti\/design\/token\.css$/,
      /^docs\/design\/tavolozza\.json$/,
      /^\.claude\/skills\/design-system\//,
      /^src\/app\/design-system\/Gallery\.tsx$/,
      /^tests\//,
    ];
    const outside = files.filter((f) => !allowed.some((re) => re.test(f)));
    expect(outside).toEqual([]);
    expect(files.filter((f) => f.startsWith("supabase/"))).toEqual([]);
  });
});
