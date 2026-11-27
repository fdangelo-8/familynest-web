import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const BASE_PATH = "/design-system";

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_PATH);
});

// #196: the reference of the tokens is the exact copy of the :root of the app.
// docs/mockup/tokens.css stays as an archive and is no longer compared.
function tokensFromReference(): Record<string, string> {
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
  return tokens;
}

// The production build rewrites colors: #ffffff -> #fff and
// rgba(23,24,28,.3) -> #17181c4d (alpha rounded to 1/255). Same color, so
// both sides are compared as rgba with the alpha rounded to two decimals.
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

// Also ".5" and "0.5" are the same number.
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
          getComputedStyle(document.documentElement).getPropertyValue(name),
        ]),
      ),
    names,
  );
}

test.describe("token e base", () => {
  // #196: the lists of approved differences (#52, #74, #313) are gone, their
  // values are in docs/agenti/design/token.css, copy of the :root of the app.
  test("CA-1: i token coincidono con docs/agenti/design/token.css", async ({
    page,
  }) => {
    const tokens = tokensFromReference();
    const names = Object.keys(tokens);
    expect(names.length).toBeGreaterThan(200);
    const actual = await rootValues(page, names);
    for (const name of names) {
      if (name === "--font-titoli" || name === "--font-testo") continue;
      // The browser reports custom properties with var() already resolved.
      let source = tokens[name]!;
      while (/var\((--[a-z0-9-]+)\)/.test(source)) {
        source = source.replace(
          /var\((--[a-z0-9-]+)\)/g,
          (_, ref: string) => tokens[ref]!,
        );
      }
      const wanted = normalize(source);
      expect(normalize(actual[name]!), name).toBe(wanted);
    }

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
    // #634: the CSS minifier turns `color-scheme` into two helper properties.
    const extra = declared.filter(
      (name) => !names.includes(name) && !name.startsWith("--lightningcss-"),
    );
    expect(extra.sort()).toEqual([]);
  });

  test("CA-2: i font agganciati a next/font sono Figtree", async ({ page }) => {
    const tokens = tokensFromReference();
    const actual = await rootValues(page, ["--font-titoli", "--font-testo"]);
    expect(actual["--font-titoli"]).toContain("Figtree");
    expect(actual["--font-testo"]).toContain("Figtree");
    expect(actual["--font-titoli"]).not.toMatch(/Parkinsans|Host Grotesk/);
    expect(actual["--font-testo"]).not.toMatch(/Parkinsans|Host Grotesk/);
    // Same fallback families as the reference file, same order.
    const fallbacks = (value: string) =>
      value
        .split(",")
        .map((part) => part.trim().replace(/['"]/g, ""))
        .filter((part) => !/Figtree|var\(--font-figtree\)/.test(part));
    for (const name of ["--font-titoli", "--font-testo"]) {
      expect(fallbacks(actual[name]!), name).toEqual(fallbacks(tokens[name]!));
    }
  });

  test("CA-3: stile del body", async ({ page }) => {
    const body = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return {
        background: style.backgroundColor,
        color: style.color,
        size: style.fontSize,
        line: style.lineHeight,
        family: style.fontFamily,
      };
    });
    // #196: white pages, new ink, Figtree.
    expect(body.background).toBe("rgb(255, 255, 255)");
    expect(body.color).toBe("rgb(16, 38, 42)");
    expect(body.size).toBe("15px");
    expect(body.line).toBe("22px");
    expect(body.family).toContain("Figtree");
  });

  test("CA-4: font caricati e t-display", async ({ page }) => {
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family);
    });
    expect(loaded.some((family) => family.includes("Figtree"))).toBe(true);
    expect(
      loaded.filter((family) => /Parkinsans|Host.?Grotesk/i.test(family)),
    ).toEqual([]);
    const display = page.getByTestId("t-display-esempio");
    await expect(display).toHaveCSS("font-weight", "400");
    await expect(display).toHaveCSS("font-family", /Figtree/);
  });

  test("CA-5: nessuna richiesta a Google Fonts", async ({ page }) => {
    const hosts: string[] = [];
    page.on("request", (request) => hosts.push(new URL(request.url()).host));
    await page.goto("/accesso");
    await page.goto(BASE_PATH);
    expect(
      hosts.filter((host) => /fonts\.g(oogleapis|static)\.com/.test(host)),
    ).toEqual([]);
  });

  test("CA-6: misure dei titoli tra mobile e desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 });
    // #196: the page title is 30 px on mobile (was 32).
    await expect(page.getByTestId("t-titolo-pagina-esempio")).toHaveCSS(
      "font-size",
      "30px",
    );
    await expect(page.getByTestId("t-display-esempio")).toHaveCSS(
      "font-size",
      "44px",
    );
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(page.getByTestId("t-titolo-pagina-esempio")).toHaveCSS(
      "font-size",
      "40px",
    );
    await expect(page.getByTestId("t-display-esempio")).toHaveCSS(
      "font-size",
      "56px",
    );
  });

  test("CA-7: anello di focus con Tab", async ({ page }) => {
    const target = page.getByTestId("btn-primary-predefinito");
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    await expect(target).toHaveCSS("outline-style", "solid");
    // Chrome rounds 1.5px down to a whole device pixel at 1x.
    await expect(target).toHaveCSS("outline-width", /^1(\.5)?px$/);
    // #503 (computer.md, question 6): the global ring is --color-azione.
    await expect(target).toHaveCSS("outline-color", "rgb(15, 61, 68)");
    await expect(target).toHaveCSS("outline-offset", "2px");
  });

  test("CA-8: con riduci movimento niente animazioni", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".spinner").first()).toHaveCSS(
      "animation-name",
      "none",
    );
    await expect(page.locator(".skeleton").first()).toHaveCSS(
      "animation-name",
      "none",
    );
  });

  test("CA-9: ogni classe del mockup c'è, nessuna mock-*", async ({ page }) => {
    const css = readFileSync("docs/mockup/components.css", "utf8");
    const body = css.slice(0, css.indexOf("IMPALCATURA DEL MOCKUP"));
    const wanted = new Set<string>();
    for (const match of body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const name = match[1]!;
      if (
        !/^\d/.test(name) &&
        name !== "frame-mobile" &&
        name !== "frame-desktop"
      ) {
        wanted.add(name);
      }
    }
    const found = await page.evaluate(() => {
      const names = new Set<string>();
      const visit = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if ("selectorText" in rule) {
            for (const m of String(rule.selectorText).matchAll(
              /\.(-?[_a-zA-Z][\w-]*)/g,
            )) {
              names.add(m[1]!);
            }
          }
          if ("cssRules" in rule) visit((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets))
        visit(sheet.cssRules);
      return [...names];
    });
    const foundSet = new Set(found);
    const missing = [...wanted].filter((name) => !foundSet.has(name));
    expect(missing).toEqual([]);
    expect(found.filter((name) => name.startsWith("mock-"))).toEqual([]);
  });
});

test.describe("icone", () => {
  // 81: «layout-grid» (the four squares of Spazi) joined the 80 of the mockup in F5.
  test("CA-12: uno sprite con 81 simboli, senza stethoscope", async ({
    page,
  }) => {
    await expect(
      page.locator('svg.sprite-icone[aria-hidden="true"]'),
    ).toHaveCount(1);
    await expect(page.locator("svg.sprite-icone symbol")).toHaveCount(81);
    await expect(page.locator("#i-stethoscope")).toHaveCount(0);
    await expect(page.locator("#i-calendar")).toHaveCount(1);
  });

  test("CA-13: taglie dell'icona", async ({ page }) => {
    const icons = page.locator("#icona svg.icona");
    await expect(icons).toHaveCount(3);
    const sizes = await icons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return [
          Math.round(box.width),
          Math.round(box.height),
          node.getAttribute("aria-hidden"),
          node.querySelector("use")?.getAttribute("href"),
        ];
      }),
    );
    expect(sizes).toEqual([
      [16, 16, "true", "#i-calendar"],
      [20, 20, "true", "#i-calendar"],
      [24, 24, "true", "#i-calendar"],
    ]);
  });
});

test.describe("bottoni", () => {
  test("CA-14: caricamento ignora i clic", async ({ page }) => {
    const button = page.getByTestId("btn-primary-caricamento");
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveClass(/is-caricamento/);
    await expect(button.locator(".spinner")).toHaveCount(1);
    await button.click({ force: true });
    await expect(page.getByTestId("btn-primary-clic")).toHaveText("Clic: 0");
    // Keyboard: the button is still focusable, Enter must not run the handler.
    await button.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("btn-primary-clic")).toHaveText("Clic: 0");
  });

  test("CA-15: disabilitato", async ({ page }) => {
    const button = page.getByTestId("btn-primary-disabilitato");
    await expect(button).toBeDisabled();
    await expect(button).toHaveCSS("opacity", "0.4");
    await button.click({ force: true });
    await expect(page.getByTestId("btn-primary-clic")).toHaveText("Clic: 0");
    await page.getByTestId("btn-primary-normale").click();
    await expect(page.getByTestId("btn-primary-clic")).toHaveText("Clic: 1");
  });

  test("CA-16: con href è un link, senza è un bottone", async ({ page }) => {
    const link = page.getByTestId("btn-link-link");
    expect(await link.evaluate((node) => node.tagName)).toBe("A");
    await expect(link).toHaveAttribute("href", BASE_PATH);
    const action = page.getByTestId("btn-link-azione");
    expect(await action.evaluate((node) => node.tagName)).toBe("BUTTON");
  });

  test("CA-17: area di tocco del bottone icona piccolo", async ({ page }) => {
    const small = page.getByTestId("btn-icona-piccolo");
    await small.scrollIntoViewIfNeeded();
    const box = (await small.boundingBox())!;
    expect(Math.round(box.width)).toBe(32);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [
      [-21, 0],
      [21, 0],
      [0, -21],
      [0, 21],
    ] as const) {
      const hit = await page.evaluate(
        ([x, y]) => {
          const element = document.elementFromPoint(x!, y!);
          return element?.closest("[data-testid]")?.getAttribute("data-testid");
        },
        [cx + dx, cy + dy],
      );
      expect(hit).toBe("btn-icona-piccolo");
    }
    const unlabeled = await page.evaluate(
      () =>
        [...document.querySelectorAll(".btn-icona")].filter(
          (node) => !node.getAttribute("aria-label")?.trim(),
        ).length,
    );
    expect(unlabeled).toBe(0);
  });
});

test.describe("campi e controlli", () => {
  test("CA-18: etichetta ed errore", async ({ page }) => {
    await expect(
      page.getByLabel("Nome", { exact: true }).first(),
    ).toBeVisible();
    const invalid = page.getByTestId("campo-errore");
    await expect(invalid).toHaveAttribute("aria-invalid", "true");
    const describedBy = await invalid.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
      "Scrivi il nome per continuare.",
    );
    await expect(invalid).toHaveCSS(
      "box-shadow",
      "rgb(179, 38, 30) 0px 0px 0px 1.5px inset",
    );
  });

  test("CA-19: data e ora", async ({ page }) => {
    const date = page.getByTestId("campo-data");
    const time = page.getByTestId("campo-ora");
    // F4c (#505): the date is a button that opens a calendar and the time a
    // text field with the numeric keypad, never the native controls.
    await expect(date).toHaveAttribute("aria-haspopup", "dialog");
    await expect(date).toHaveText(/Martedì 20 ottobre/);
    await expect(time).toHaveAttribute("type", "text");
    await expect(time).toHaveAttribute("inputmode", "numeric");
    await expect(time).toHaveValue("17:00");
    for (const field of [date, time, page.getByTestId("campo-predefinito")]) {
      // #503: --size-campo, the label sits inside the box. F4c (#505): the
      // date is a button whose text may wrap in a narrow pair, so it is the
      // minimum height that holds for it.
      await expect(field).toHaveCSS(
        field === date ? "min-height" : "height",
        "56px",
      );
      await expect(field).toHaveCSS("border-top-left-radius", "12px");
    }
  });

  test("CA-20: casella con clic e Spazio", async ({ page }) => {
    const box = page.getByTestId("casella-vuota");
    await expect(box).toHaveAttribute("role", "checkbox");
    await expect(box).toHaveAttribute("aria-label", /.+/);
    await expect(box).toHaveAttribute("aria-checked", "false");
    await box.click();
    await expect(box).toHaveAttribute("aria-checked", "true");
    await box.focus();
    await page.keyboard.press("Space");
    await expect(box).toHaveAttribute("aria-checked", "false");
  });

  test("CA-21: interruttore", async ({ page }) => {
    const toggle = page.getByTestId("toggle-spento");
    await expect(toggle).toHaveAttribute("role", "switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("toggle-stato")).toHaveText("Acceso");
  });

  test("CA-22: selettore a scelta unica", async ({ page }) => {
    const group = page.getByTestId("selettore-predefinito");
    await expect(group).toHaveAttribute("aria-label", /.+/);
    const pressed = group.getByRole("button", { pressed: true });
    await expect(pressed).toHaveText("Settimana");
    await group.getByRole("button", { name: "Mese" }).click();
    await expect(group.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(group.getByRole("button", { name: "Mese" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(group.getByRole("button", { name: "Giorno" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("CA-23: chip", async ({ page }) => {
    const chips = page.getByTestId("chip-predefinito").getByRole("button");
    await chips.nth(0).click();
    await chips.nth(1).click();
    // The pointer must not hover a chip: hover has its own color.
    await page.mouse.move(0, 0);
    for (const index of [0, 1]) {
      await expect(chips.nth(index)).toHaveAttribute("aria-pressed", "true");
      await expect(chips.nth(index)).toHaveCSS(
        "background-color",
        "rgb(16, 38, 42)",
      );
    }
    await chips.nth(0).hover();
    // #634: the mouse over a full control is --color-azione.
    await expect(chips.nth(0)).toHaveCSS("background-color", "rgb(15, 61, 68)");
    const statico = page.getByTestId("chip-statico");
    expect(await statico.evaluate((node) => node.tagName)).not.toBe("BUTTON");
    await expect(statico).not.toHaveAttribute("aria-pressed", /.*/);
  });
});

test.describe("persone, etichette e righe", () => {
  test("CA-24: avatar", async ({ page }) => {
    const size = async (id: string) =>
      Math.round(
        (await page.getByTestId(id).locator(".avatar").boundingBox())!.width,
      );
    expect([
      await size("avatar-xs"),
      await size("avatar-s"),
      await size("avatar-m"),
      await size("avatar-l"),
      await size("avatar-xl"),
      await size("avatar-punto"),
    ]).toEqual([18, 24, 32, 44, 72, 9]);
    await expect(
      page.getByTestId("avatar-punto").locator(".avatar"),
    ).toHaveText("");
    const laura = page.getByTestId("avatar-cobalto").locator(".avatar");
    await expect(laura).toHaveText("L");
    // #196: cobalto shows the blue tint #3F6FE0.
    await expect(laura).toHaveCSS("background-color", "rgb(63, 111, 224)");
    await expect(laura).toHaveAttribute("role", "img");
    await expect(laura).toHaveAttribute("aria-label", "Laura");
    await expect(
      page.getByTestId("avatar-con-nome").locator(".avatar"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("CA-25: le etichette non sono interattive", async ({ page }) => {
    const interactive = await page.evaluate(
      () =>
        [...document.querySelectorAll(".etichetta")].filter(
          (node) =>
            ["A", "BUTTON"].includes(node.tagName) ||
            node.hasAttribute("tabindex"),
        ).length,
    );
    expect(interactive).toBe(0);
  });

  test("CA-26: righe di lista", async ({ page }) => {
    const row = page.getByTestId("riga-lista-cliccabile");
    const parent = await row.evaluate((node) => ({
      tag: node.closest("li")?.tagName,
      list: node.closest("ul")?.classList.contains("lista"),
      height: node.getBoundingClientRect().height,
      interactive: node.closest("li")!.querySelectorAll("a,button").length,
    }));
    expect(parent.tag).toBe("LI");
    expect(parent.list).toBe(true);
    expect(parent.height).toBeGreaterThanOrEqual(56);
    expect(parent.interactive).toBe(1);

    const withBox = page.getByTestId("riga-lista-con-casella");
    expect(
      await withBox.evaluate((node) => ({
        controls: node.querySelectorAll("a,button").length,
        nested: node.querySelectorAll("a a,a button,button a,button button")
          .length,
      })),
    ).toEqual({ controls: 1, nested: 0 });
  });
});

test.describe("sovrapposizioni", () => {
  test("CA-27/28/29: foglio o modale", async ({ page }) => {
    const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
    const opener = page.getByRole("button", { name: "Apri foglio" });

    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(desktop ? /modale/ : /foglio/);
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".velo")).toHaveCount(1);
    await expect(page.getByLabel("Titolo")).toBeFocused();

    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }

    await dialog.getByRole("button", { name: "Chiudi" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();

    await opener.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();

    await opener.click();
    await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("CA-30: il foglio si chiude trascinando la testata", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "solo mobile");
    const opener = page.getByRole("button", { name: "Apri foglio" });
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });
    const drag = async (distance: number) => {
      // F4c (#505): no visible handle, the drag starts from the head.
      const handle = page.getByTestId("sheet-testa");
      const box = (await handle.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + distance / 2);
      await page.mouse.move(x, y + distance);
      await page.mouse.up();
    };

    await opener.click();
    const height = (await dialog.boundingBox())!.height;
    await drag(Math.floor(height * 0.1));
    await expect(dialog).toBeVisible();

    await drag(Math.ceil(height * 0.4));
    await expect(dialog).toHaveCount(0);
  });

  test("CA-31/32: dialogo di conferma", async ({ page }) => {
    const opener = page.getByTestId("dialogo-apri");
    const count = page.getByTestId("dialogo-conteggio");
    await opener.click();
    const dialog = page.getByRole("alertdialog", {
      name: "Eliminare «Nuoto Sofia»?",
    });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    const labels = await dialog.getByRole("button").allTextContents();
    expect(labels).toEqual([
      "Elimina tutti i prossimi",
      "Elimina solo questo",
      "Annulla",
    ]);
    await expect(dialog.getByRole("button", { name: "Annulla" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(count).toHaveText("Eliminazioni: 0");

    await opener.click();
    await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);

    await opener.click();
    await dialog.getByRole("button", { name: "Annulla" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(count).toHaveText("Eliminazioni: 0");

    await opener.click();
    await dialog.getByRole("button", { name: "Elimina solo questo" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(count).toHaveText("Eliminazioni: 1");
  });

  test("CA-33/34/35: toast", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-20T10:00:00Z") });
    await page.goto(BASE_PATH);
    // Stop the flow of time: only runFor() moves it (slow CI must not matter).
    await page.clock.pauseAt(new Date("2026-10-20T10:01:00Z"));
    const toast = page
      .getByRole("status")
      .filter({ hasText: "Chiamare il commercialista" });
    await page.getByTestId("toast-mostra").click();
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();

    const box = (await toast.boundingBox())!;
    const viewport = page.viewportSize()!;
    if (viewport.width >= 1024) {
      expect(Math.round(box.width)).toBe(400);
      expect(Math.round(viewport.width - (box.x + box.width))).toBe(40);
      expect(Math.round(viewport.height - (box.y + box.height))).toBe(32);
    } else {
      // #196: the page margin on a phone is 24 px (was 20).
      expect(Math.round(box.x)).toBe(24);
      expect(Math.round(viewport.width - (box.x + box.width))).toBe(24);
      expect(Math.round(viewport.height - (box.y + box.height))).toBe(104);
    }

    await page.clock.runFor(4900);
    await expect(toast).toBeVisible();
    await page.clock.runFor(100);
    await expect(toast).toHaveCount(0);

    await page.getByTestId("toast-mostra").click();
    await toast.getByRole("button", { name: "Annulla" }).click();
    await expect(toast).toHaveCount(0);
    await expect(page.getByTestId("toast-annullato")).toHaveText(
      "Annullato: 1",
    );

    await page.getByTestId("toast-mostra").click();
    await page.getByTestId("toast-mostra-altro").click();
    await expect(page.locator(".toast")).toHaveCount(1);
    await expect(page.locator(".toast")).toContainText("Link copiato");
  });
});

test.describe("stati", () => {
  test("CA-36: stato vuoto", async ({ page }) => {
    for (const id of ["stato-vuoto-predefinito", "stato-vuoto-grande"]) {
      const state = page.getByTestId(id);
      await expect(state.locator(".stato-vuoto__titolo")).not.toBeEmpty();
      await expect(state.locator(".stato-vuoto__testo")).not.toBeEmpty();
      expect(await state.locator("a,button").count()).toBeGreaterThan(0);
    }
    await expect(
      page.getByTestId("stato-vuoto-grande").locator(".stato-vuoto__icona"),
    ).toHaveCount(0);
  });

  test("CA-37: scheletri", async ({ page }) => {
    const group = page.getByTestId("gruppo-skeleton");
    await expect(group).toHaveAttribute("aria-busy", "true");
    const visible = await group
      .locator(".skeleton")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.getAttribute("aria-hidden") === "true"),
      );
    expect(visible).toBe(true);
    await expect(group.getByText("Caricamento in corso")).toHaveCount(1);
  });

  test("CA-38: ruoli degli avvisi", async ({ page }) => {
    await expect(page.getByTestId("avviso-errore")).toHaveAttribute(
      "role",
      "alert",
    );
    for (const id of ["avviso-avviso", "avviso-info", "avviso-ok"]) {
      await expect(page.getByTestId(id)).toHaveAttribute("role", "status");
    }
  });

  test("CA-39: errore di pagina", async ({ page }) => {
    const error = page.getByTestId("errore-pagina");
    await expect(error).toHaveAttribute("role", "alert");
    await error.getByRole("button", { name: "Riprova" }).click();
    await expect(page.getByTestId("errore-pagina-conteggio")).toHaveText(
      "Riprova: 1",
    );
  });
});

test.describe("isolamento", () => {
  test("CA-46: pagina pubblica, noindex, nessun dato", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const response = await page.goto(BASE_PATH);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Design system",
    );
  });

  test("CA-48 (parte): nessuno scorrimento orizzontale", async ({ page }) => {
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("CA-11: stessi stili del mockup", () => {
  // Section id, selector of the first element with the root class and the
  // properties to skip. `ours` is a document-wide selector for components
  // that the gallery renders outside of the section (open overlays).
  type Spec = {
    id: string;
    selector: string;
    skip?: string[];
    ours?: string;
    mock?: string;
    // Approved difference (#52): only the color of the box-shadow may differ.
    // Both colors are asserted separately by the compare function.
    shadowColor?: { ours: string; mock: string };
    // Approved difference (#313, text up to 200%): buttons that may wrap have
    // padding-block var(--space-2) instead of 0. At 100% the size is the same
    // (min-height), so only the left and right padding are compared.
    inlinePaddingOnly?: boolean;
  };
  const STATIC_SECTIONS: Spec[] = [
    // Height follows the wrapping of the sample text (line-height is checked).
    { id: "t-display", selector: ".t-display", skip: ["height"] },
    { id: "icona", selector: "svg.icona" },
    // #503 (Componenti 2.0, decision of 24/11/2026): primary, secondary,
    // tenue, the fields, the notices and the toast take the form of Fable;
    // the properties listed in `skip` are the approved differences.
    {
      id: "btn-primary",
      selector: ".btn-primary",
      inlinePaddingOnly: true,
      skip: [
        "background-color",
        "color",
        "border",
        "border-top-left-radius",
        "font-size",
        "font-weight",
      ],
    },
    {
      id: "btn-secondary",
      selector: ".btn-secondary",
      inlinePaddingOnly: true,
      skip: [
        "border",
        "box-shadow",
        "border-top-left-radius",
        "font-size",
        "font-weight",
      ],
    },
    { id: "btn-chiaro", selector: ".btn-chiaro", inlinePaddingOnly: true },
    { id: "btn-tenue", selector: ".btn-tenue", skip: ["background-color"] },
    {
      id: "btn-tratteggiato",
      selector: ".btn-tratteggiato",
      inlinePaddingOnly: true,
    },
    // The first .btn-link of the mockup sits on a dark (tema-notte) frame, the
    // gallery shows it on paper: the secondary link is on paper in both.
    { id: "btn-link", selector: ".btn-link--secondario" },
    { id: "btn-pericolo", selector: ".btn-pericolo" },
    {
      id: "btn-pericolo-pieno",
      selector: ".btn-pericolo-pieno",
      // #503, §1 of docs/specifiche/503-componenti-base.md: same measures as
      // the primary (radius 14, 16 px, weight 600): approved differences.
      skip: ["border-top-left-radius", "font-size", "font-weight"],
    },
    { id: "btn-icona", selector: ".btn-icona" },
    // The mockup shows the spinner only on the dark frame, the gallery on
    // paper: the inherited text color is context, not the component.
    { id: "spinner", selector: ".spinner", skip: ["color"] },
    // #52: the only approved difference from the mockup is the resting border
    // color of the fields (--color-filo-campo instead of --color-filo-2).
    {
      id: "campo",
      selector: ".campo__input",
      // #634: --color-filo-campo #869390 and --color-filo-2 #C3CCC9.
      shadowColor: { ours: "rgb(134,147,144)", mock: "rgb(195,204,201)" },
      // #503: the label sits inside the box (56 px, 16/22 value, the box
      // draws the white background).
      skip: [
        "height",
        "padding",
        "font-size",
        "line-height",
        "background-color",
      ],
    },
    { id: "casella", selector: ".casella" },
    // #503: the off switch has the border of the field around it.
    { id: "toggle", selector: ".toggle", skip: ["box-shadow"] },
    { id: "selettore", selector: ".selettore" },
    // #504 (F4b, decision of 24/11/2026): the pill is 40 px high, a capsule,
    // with a thin border and the text at 16/22 600; the properties listed in
    // `skip` are the approved differences.
    {
      id: "chip",
      selector: ".chip--statico",
      skip: [
        "height",
        "padding",
        "border-top-left-radius",
        "font-size",
        "font-weight",
        "line-height",
        "border",
        "box-shadow",
      ],
    },
    { id: "avatar", selector: '.avatar:not([class*="avatar--"])' },
    { id: "etichetta", selector: ".etichetta" },
    // The first .scheda of the mockup is a list container (no padding): the
    // padded card is the comparable one, its height depends on the content.
    { id: "scheda", selector: ".scheda--imbottita", skip: ["height"] },
    { id: "riga-lista", selector: ".riga-lista", skip: ["height"] },
    // The height of the empty state depends on text wrapping and the font:
    // every other style is still compared.
    { id: "stato-vuoto", selector: ".stato-vuoto", skip: ["height"] },
    { id: "stato-vuoto", selector: ".stato-vuoto__titolo", skip: ["height"] },
    // The first skeletons of the mockup are on the dark frame: the large one
    // is on paper in both.
    // #634: the skeleton takes --color-scheletro (#DCE2DF), not carta-2: at
    // night carta-2 on the page would be invisible.
    {
      id: "skeleton",
      selector: ".skeleton--grande",
      skip: ["background-color"],
    },
    // One per variant; the height depends on how the text wraps.
    // The mockup shows the error one on the dark frame: the inherited text
    // color (and the border color that follows it) is context there.
    // #503: notices have a grey or pink background, radius 12 and no ring.
    {
      id: "avviso",
      selector: ".avviso--errore",
      skip: [
        "height",
        "color",
        "border",
        "background-color",
        "border-top-left-radius",
        "box-shadow",
      ],
    },
    ...[".avviso--avviso", ".avviso--info", ".avviso--ok"].map((selector) => ({
      id: "avviso",
      selector,
      skip: [
        "height",
        "background-color",
        "border-top-left-radius",
        "box-shadow",
      ],
    })),
    { id: "errore-pagina", selector: ".errore-pagina", skip: ["height"] },
  ];
  const PROPS = [
    "background-color",
    "color",
    "border-top-left-radius",
    "height",
    "padding",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "box-shadow",
    "border",
  ];

  async function read(page: Page, selectors: string[]) {
    return page.evaluate(
      ({ list, props }) =>
        list.map((selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          return Object.fromEntries(
            props.map((p) => [p, style.getPropertyValue(p)]),
          );
        }),
      { list: selectors, props: PROPS },
    );
  }

  async function compare(
    page: Page,
    width: number,
    specs: Spec[],
    prepare: () => Promise<void>,
  ) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(BASE_PATH);
    await prepare();
    const ours = await read(
      page,
      specs.map((spec) => spec.ours ?? `#${spec.id} ${spec.selector}`),
    );
    await page.goto(`file://${process.cwd()}/docs/mockup/design-system.html`);
    // #196: the values of the tokens come from docs/agenti/design/token.css
    // (the mockup keeps its own components and its old tokens as an archive).
    // The new :root is laid over the mockup; the two font tokens point to the
    // variable of next/font, which the mockup page does not have.
    // The database codes now show a new shade (#196, §5): the mockup gets the
    // same `.membro-*` classes as the app, so the code -> shade mapping is the
    // approved one and every other avatar style is still compared.
    const memberClasses = (
      readFileSync("src/app/components.css", "utf8").match(
        /\.membro-[a-z]+\s*\{[^}]*\}/g,
      ) ?? []
    ).join("\n");
    await page.addStyleTag({
      content:
        readFileSync("docs/agenti/design/token.css", "utf8").replace(
          /--font-(titoli|testo):[^;]+;/g,
          "",
        ) + memberClasses,
    });
    const theirs = await read(
      page,
      specs.map((spec) => spec.mock ?? `#${spec.id} ${spec.selector}`),
    );
    specs.forEach((spec, index) => {
      const label = `${spec.id} ${spec.selector}`;
      expect(theirs[index], `${label} nel mockup`).not.toBeNull();
      expect(ours[index], `${label} nell'app`).not.toBeNull();
      const drop = (values: Record<string, string> | null) =>
        Object.fromEntries(
          Object.entries(values ?? {}).filter(
            ([key]) => !(spec.skip ?? []).includes(key),
          ),
        );
      const split = (values: Record<string, string> | null) => {
        const rest = drop(values);
        if (spec.inlinePaddingOnly && rest["padding"]) {
          // Computed shorthand: "a", "a b", "a b c" or "a b c d".
          const parts = rest["padding"].split(" ");
          const right = parts[1] ?? parts[0]!;
          const left = parts[3] ?? right;
          rest["padding"] = `${right} ${left}`;
        }
        if (!spec.shadowColor) return { rest, color: "" };
        const shadow = rest["box-shadow"] ?? "";
        const match = shadow.match(/^(rgba?\([^)]*\))\s*(.*)$/);
        expect(match, `${label}: box-shadow ${shadow}`).not.toBeNull();
        return {
          rest: { ...rest, "box-shadow": match![2]! },
          color: normalize(match![1]!),
        };
      };
      const mine = split(ours[index]!);
      const other = split(theirs[index]!);
      expect(mine.rest, label).toEqual(other.rest);
      if (spec.shadowColor) {
        expect(mine.color, `${label}: colore del bordo nell'app`).toBe(
          normalize(spec.shadowColor.ours),
        );
        expect(other.color, `${label}: colore del bordo nel mockup`).toBe(
          normalize(spec.shadowColor.mock),
        );
      }
    });
  }

  test("i componenti hanno gli stessi stili del mockup a 390 px", async ({
    page,
  }) => {
    await compare(page, 390, STATIC_SECTIONS, async () => {});
  });

  test("foglio aperto: stessi stili del mockup a 390 px", async ({ page }) => {
    await compare(
      page,
      390,
      [
        {
          id: "foglio",
          selector: ".foglio",
          ours: ".foglio",
          // F4c (#505): the sheet has no padding of its own (the head, the
          // body and the foot have theirs) and no handle: approved difference.
          skip: ["height", "padding"],
        },
      ],
      async () => {
        await page.getByRole("button", { name: "Apri foglio" }).click();
        await expect(
          page.getByRole("dialog", { name: "Aggiungi" }),
        ).toBeVisible();
      },
    );
  });

  test("modale aperta: stessi stili del mockup a 1280 px", async ({ page }) => {
    await compare(
      page,
      1280,
      [
        {
          id: "modale",
          selector: ".modale",
          ours: ".modale",
          skip: ["height"],
        },
      ],
      async () => {
        await page.getByRole("button", { name: "Apri foglio" }).click();
        await expect(
          page.getByRole("dialog", { name: "Aggiungi" }),
        ).toBeVisible();
      },
    );
  });

  test("dialogo aperto: stessi stili del mockup a 390 px", async ({ page }) => {
    await compare(
      page,
      390,
      [
        {
          id: "dialogo",
          selector: ".dialogo",
          ours: ".dialogo",
          skip: ["height"],
        },
      ],
      async () => {
        await page.getByTestId("dialogo-apri").click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
      },
    );
  });

  test("toast visibile: stessi stili del mockup a 390 px", async ({ page }) => {
    // The first toast of the mockup is the one without «Annulla».
    await compare(
      page,
      390,
      [
        {
          id: "toast",
          selector: ".toast",
          ours: ".toast",
          // #503: the message is --color-inchiostro with white text.
          skip: ["height", "background-color", "color", "border"],
        },
      ],
      async () => {
        await page.getByTestId("toast-mostra-altro").click();
        await expect(page.locator(".toast")).toBeVisible();
      },
    );
  });
});

test.describe("sovrapposizioni: casi composti", () => {
  test("il contenuto del foglio sopravvive al cambio di larghezza", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Apri foglio" }).click();
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });
    await page.getByLabel("Titolo").fill("Nuoto Sofia");
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(dialog).toHaveClass(/modale/);
    await expect(page.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
    await page.getByLabel("Titolo").focus();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toHaveClass(/foglio/);
    await expect(page.getByLabel("Titolo")).toHaveValue("Nuoto Sofia");
  });

  test("Esc e Tab agiscono solo sul dialogo in cima", async ({ page }) => {
    await page.getByRole("button", { name: "Apri foglio" }).click();
    const sheet = page.getByRole("dialog", { name: "Aggiungi" });
    const opener = page.getByTestId("foglio-elimina");
    await opener.click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await confirm.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(opener).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("durante l'uscita le azioni non si eseguono due volte", async ({
    page,
  }) => {
    await page.getByTestId("dialogo-apri").click();
    const action = page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Elimina solo questo" });
    await action.dispatchEvent("click");
    await action.dispatchEvent("click");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("dialogo-conteggio")).toHaveText(
      "Eliminazioni: 1",
    );
  });
});

// Corrections approved by Francesco (#52, proposals 2-5 of #43).
test.describe("correzioni approvate (#52)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  type Rgb = [number, number, number];

  const hex = (value: string): Rgb => {
    const m = value.trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) throw new Error(`not a #rrggbb color: ${value}`);
    const n = parseInt(m[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /** Computed color ("rgb(r, g, b)") or "#rrggbb" to a number triple. */
  const rgb = (value: string): Rgb => {
    if (value.startsWith("#")) return hex(value);
    const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) throw new Error(`not an rgb color: ${value}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };

  const luminance = ([r, g, b]: Rgb) => {
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };

  /** WCAG 2.x contrast ratio, truncated to two decimals as in the issue. */
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(rgb(a)), luminance(rgb(b))];
    const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    return Math.floor(ratio * 100) / 100;
  };

  /** The ratio quoted in the issue, which rounds some values and truncates others. */
  const expectRatio = (a: string, b: string, quoted: number) =>
    expect(Math.abs(contrast(a, b) - quoted)).toBeLessThanOrEqual(0.011);

  const sameColor = (actual: string, wanted: string) =>
    expect(rgb(actual)).toEqual(hex(wanted));

  /** "rgb(…) 0px 0px 0px 1px inset" to its parts. */
  const shadow = (value: string) => {
    const m = value.match(/^(rgba?\([^)]*\))\s+0px 0px 0px ([\d.]+)px inset$/);
    expect(m, `box-shadow inatteso: ${value}`).not.toBeNull();
    return { color: m![1]!, width: Number(m![2]) };
  };

  const rootToken = (page: Page, name: string) =>
    page.evaluate(
      (n) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(n)
          .trim()
          .toLowerCase(),
      name,
    );

  const style = (page: Page, selector: string, property: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

  /** Adds month grid cells (not in the gallery) to the page. */
  async function addCells(page: Page, classes: string[]) {
    await page.evaluate((list) => {
      const grid = document.createElement("div");
      grid.className = "griglia-mese";
      grid.id = "griglia-test";
      list.forEach((cls, i) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `griglia-mese__cella ${cls}`;
        cell.setAttribute("aria-label", `cella ${i}`);
        cell.dataset.testid = `cella-${i}`;
        const number = document.createElement("span");
        number.className = "griglia-mese__numero";
        number.textContent = "28";
        cell.append(number);
        grid.append(cell);
      });
      document.body.append(grid);
    }, classes);
  }

  async function addQuickField(page: Page) {
    await page.evaluate(() => {
      const wrap = document.createElement("div");
      wrap.className = "campo-rapido";
      wrap.id = "campo-rapido-test";
      const input = document.createElement("input");
      input.className = "campo-rapido__input";
      input.setAttribute("aria-label", "Aggiungi");
      input.placeholder = "Aggiungi";
      wrap.append(input);
      document.body.append(wrap);
    });
  }

  /** Style rules of every loaded sheet, flattened, with their media chain. */
  async function allRules(page: Page) {
    return page.evaluate(() => {
      const out: {
        selector: string;
        background: string;
        color: string;
        inHover: boolean;
      }[] = [];
      const visit = (rules: CSSRuleList, inHover: boolean) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            out.push({
              selector: rule.selectorText,
              background:
                rule.style.getPropertyValue("background") ||
                rule.style.getPropertyValue("background-color"),
              color: rule.style.getPropertyValue("color"),
              inHover,
            });
          } else if (rule instanceof CSSMediaRule) {
            visit(
              rule.cssRules,
              inHover || /hover:\s*hover/.test(rule.conditionText),
            );
          } else if ("cssRules" in rule) {
            visit((rule as CSSGroupingRule).cssRules, inHover);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          visit(sheet.cssRules, false);
        } catch {
          // cross-origin sheet: not ours
        }
      }
      return out;
    });
  }

  // ---- Punto 2: bordo dei campi ----

  test("CA-1 (#52): --color-filo-campo vale #869390 con contrasto >= 3:1", async ({
    page,
  }) => {
    // #634: the value follows the palette, #869390 (3,19:1 on white). On the
    // quiet grey it is 2,93: no field sits on that ground (spec 634, §7).
    expect(await rootToken(page, "--color-filo-campo")).toBe("#869390");
    expect(contrast("#869390", "#FFFFFF")).toBeGreaterThanOrEqual(3);
    expectRatio("#869390", "#FFFFFF", 3.19);
    expectRatio("#869390", "#F4F6F4", 2.93);
  });

  test("CA-2 (#52): il campo vuoto ha il bordo a riposo #869390", async ({
    page,
  }) => {
    const input = page.locator("#campo .campo__input").first();
    await input.fill("");
    await input.blur();
    await expect(input).toHaveValue("");
    const value = shadow(
      await style(page, "#campo .campo__input", "box-shadow"),
    );
    expect(value.width).toBe(1);
    sameColor(value.color, "#869390");
  });

  test("CA-3 (#52): il campo rapido ha il bordo a riposo #869390", async ({
    page,
  }) => {
    await addQuickField(page);
    const value = shadow(await style(page, "#campo-rapido-test", "box-shadow"));
    expect(value.width).toBe(1);
    sameColor(value.color, "#869390");
  });

  test("CA-4 (#52): il focus con Tab mostra l'anello inchiostro", async ({
    page,
  }) => {
    const input = page.locator("#campo .campo__input").first();
    await input.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    const value = shadow(
      await style(page, "#campo .campo__input", "box-shadow"),
    );
    // --border-medio (1.5px in tokens.css), thicker than the resting 1px.
    expect(value.width).toBeGreaterThan(1);
    sameColor(value.color, "#10262a");
  });

  test("CA-5 (#52): il campo in errore ha l'anello allerta", async ({
    page,
  }) => {
    const gallery = shadow(
      await style(page, "[data-testid=campo-errore]", "box-shadow"),
    );
    expect(gallery.width).toBeGreaterThan(1);
    sameColor(gallery.color, "#b3261e");

    await page.evaluate(() => {
      const wrap = document.createElement("div");
      wrap.className = "campo campo--errore";
      const input = document.createElement("input");
      input.className = "campo__input";
      input.id = "errore-test";
      input.setAttribute("aria-label", "Errore");
      wrap.append(input);
      document.body.append(wrap);
    });
    const created = shadow(await style(page, "#errore-test", "box-shadow"));
    expect(created.width).toBeGreaterThan(1);
    sameColor(created.color, "#b3261e");
  });

  test("CA-6 (#52): --color-filo-2 e i suoi usi non cambiano", async ({
    page,
  }) => {
    // #196: the value is now #C3CCC9, the uses are the same.
    expect(await rootToken(page, "--color-filo-2")).toBe("#c3ccc9");
    const secondary = await page
      .locator("#btn-secondary .btn-secondary")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.boxShadow} | ${s.borderTopColor}`;
      });
    // #503: the secondary button has a 1 px --color-inchiostro border now;
    // --color-filo-2 stays on the dashed button and the off switch.
    expect(secondary).toContain("rgb(16, 38, 42)");
    const dashed = await page
      .locator("#btn-tratteggiato .btn-tratteggiato")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.boxShadow} | ${s.borderTopColor}`;
      });
    expect(dashed).toContain("rgb(195, 204, 201)");
    const toggleOff = page
      .locator("#toggle .toggle:not([aria-checked='true'])")
      .first();
    sameColor(
      await toggleOff.evaluate((el) => getComputedStyle(el).backgroundColor),
      "#c3ccc9",
    );
  });

  // ---- Punto 3: giorni fuori dal mese ----

  test("CA-7 (#52): il numero fuori mese è #55686C, contrasto >= 4,5:1", async ({
    page,
  }) => {
    await addCells(page, ["griglia-mese__cella--fuori"]);
    const color = await style(
      page,
      "#griglia-test .griglia-mese__numero",
      "color",
    );
    // #196: secondary ink #55686C, 5,86:1 on white and 5,40:1 on the quiet grey.
    sameColor(color, "#55686c");
    expect(contrast("#55686C", "#F4F6F4")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#55686C", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expectRatio("#55686C", "#F4F6F4", 5.4);
    expectRatio("#55686C", "#FFFFFF", 5.86);
  });

  test("CA-8 (#52): il numero fuori mese è visibile, opaco, con testo 28", async ({
    page,
  }) => {
    await addCells(page, ["griglia-mese__cella--fuori"]);
    const number = page.locator("#griglia-test .griglia-mese__numero");
    await expect(number).toBeVisible();
    await expect(number).toHaveCSS("opacity", "1");
    await expect(number).toHaveText("28");
    await expect(page.getByRole("button", { name: "cella 0" })).toBeVisible();
  });

  test("CA-9 (#52): le combinazioni di colore dei numeri", async ({ page }) => {
    await addCells(page, [
      "griglia-mese__cella--fuori griglia-mese__cella--festa",
      "griglia-mese__cella--weekend",
      "griglia-mese__cella--oggi",
      "",
    ]);
    const read = (i: number) =>
      page
        .getByTestId(`cella-${i}`)
        .locator(".griglia-mese__numero")
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return { color: s.color, background: s.backgroundColor };
        });
    sameColor((await read(0)).color, "#b3261e");
    sameColor((await read(1)).color, "#55686c");
    const today = await read(2);
    sameColor(today.color, "#ffffff"); // #634: --color-latte
    sameColor(today.background, "#10262a");
    sameColor((await read(3)).color, "#10262a");
  });

  test("CA-10 (#52): la regola fuori mese non usa più inchiostro-3", async ({
    page,
  }) => {
    const rules = (await allRules(page)).filter((r) =>
      r.selector
        .split(",")
        .map((part) => part.trim())
        .includes(".griglia-mese__cella--fuori .griglia-mese__numero"),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.color).not.toBe("");
      expect(rule.color.toLowerCase()).not.toMatch(/8a8d93|138,\s*141,\s*147/);
      expect(rule.color).not.toContain("--color-inchiostro-3");
      expect(rule.color.toLowerCase()).toMatch(
        /--color-inchiostro-2|5a5d64|90,\s*93,\s*100/,
      );
    }
  });

  // ---- Punto 4: bottone rosso pieno ----

  const danger = "[data-testid=btn-pericolo-pieno-predefinito]";

  test("CA-11 (#52): --color-allerta-scuro vale #A82A27 ed è leggibile", async ({
    page,
  }) => {
    expect(await rootToken(page, "--color-allerta-scuro")).toBe("#a82a27");
    expect(luminance(hex("#A82A27"))).toBeLessThan(luminance(hex("#B3261E")));
    expect(contrast("#A82A27", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expectRatio("#A82A27", "#FFFFFF", 6.94);
  });

  test("CA-12 (#52): passaggio del mouse sul bottone rosso (desktop)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "solo con un puntatore");
    const button = page.locator(danger);
    await expect(button).toHaveCSS("background-color", "rgb(179, 38, 30)");
    await button.hover();
    await expect(button).toHaveCSS("background-color", "rgb(168, 42, 39)");
    await expect(button).toHaveCSS("color", "rgb(255, 255, 255)");
    await page.mouse.move(1, 1);
    await expect(button).toHaveCSS("background-color", "rgb(179, 38, 30)");
  });

  for (const how of ["disabled", "aria-disabled"] as const) {
    test(`CA-13 (#52): bottone rosso con ${how}, nessun cambio di fondo`, async ({
      page,
    }) => {
      const button = page.locator(danger);
      await button.evaluate((el, mode) => {
        if (mode === "disabled") el.setAttribute("disabled", "");
        else el.setAttribute("aria-disabled", "true");
      }, how);
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // The pointer really is over the button, so :hover applies.
      expect(await button.evaluate((el) => el.matches(":hover"))).toBe(true);
      await expect(button).toHaveCSS("background-color", "rgb(179, 38, 30)");
      await page.mouse.down();
      try {
        await expect(button).toHaveCSS("background-color", "rgb(179, 38, 30)");
      } finally {
        await page.mouse.up();
      }
    });
  }

  test("CA-14 (#52): le regole :hover del bottone rosso stanno in hover: hover", async ({
    page,
  }) => {
    const rules = await allRules(page);
    const forDanger = rules.filter((r) =>
      /\.btn-pericolo-pieno[^,]*:hover/.test(r.selector),
    );
    const darker = forDanger.filter((r) =>
      /a82a27|168,\s*42,\s*39|--color-allerta-scuro/i.test(r.background),
    );
    expect(darker.length).toBeGreaterThan(0);
    expect(forDanger.filter((r) => !r.inHover)).toEqual([]);
    // The red link does not change on hover.
    const link = rules.filter(
      (r) =>
        /\.btn-pericolo(?![-\w])[^,]*:hover/.test(r.selector) &&
        (r.background !== "" || r.color !== ""),
    );
    expect(link).toEqual([]);
  });

  test("CA-15 (#52): tenendo premuto il bottone rosso il fondo è #A82A27", async ({
    page,
  }) => {
    const button = page.locator(danger);
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      expect(await button.evaluate((el) => el.matches(":active"))).toBe(true);
      await expect(button).toHaveCSS("background-color", "rgb(168, 42, 39)");
    } finally {
      await page.mouse.up();
    }
  });

  // ---- Punto 5: dialogo al centro ----

  test("CA-16 (#52): il dialogo è al centro dello schermo", async ({
    page,
  }) => {
    await page.getByTestId("dialogo-apri").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const view = page.viewportSize()!;
    // Poll: the box settles once the entrance animation is over.
    await expect
      .poll(async () => {
        const b = (await dialog.boundingBox())!;
        return Math.abs(b.y + b.height / 2 - view.height / 2) <= 1;
      })
      .toBe(true);
    const b = (await dialog.boundingBox())!;
    expect(view.height - (b.y + b.height)).toBeGreaterThanOrEqual(16);
  });

  test("CA-17 (#52): la guida non dice più «Su mobile in basso»", () => {
    for (const file of ["design-system.md", "design-system.html"]) {
      const text = readFileSync(`docs/mockup/${file}`, "utf8");
      expect(text, file).not.toContain("Su mobile in basso");
      expect(text, file).toContain("Al centro dello schermo a ogni larghezza");
    }
  });

  // Only meaningful on the branch of #52: on any other branch the list of
  // changed files says nothing about this issue.
  test("CA-22 (#52): il ramo non tocca database, tipi e mockup CSS", async () => {
    // It must behave in every context, so it never throws and never skips:
    // - `safe.directory=*` because the CI container runs the checkout as a
    //   different user than its owner ("dubious ownership" made the old
    //   version fail on main);
    // - on main, on other branches, or without history (shallow checkout, no
    //   origin/main) outside the branch of #52 there is nothing to compare;
    // - on the branch of #52 it never passes without reading the diff: if
    //   origin/main is missing (CI checkouts are shallow) it fetches it, and if
    //   the diff still cannot be computed the test fails with a clear message.
    const run = (args: string[]): string | null => {
      try {
        return execFileSync("git", ["-c", "safe.directory=*", ...args], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return null;
      }
    };
    const branch =
      process.env.GITHUB_HEAD_REF ||
      run(["rev-parse", "--abbrev-ref", "HEAD"]) ||
      "";
    if (!/correzioni-design-system$/.test(branch)) {
      return;
    }
    let diff = run(["diff", "--name-only", "origin/main...HEAD"]);
    if (diff === null) {
      run([
        "fetch",
        "--no-tags",
        "--deepen=200",
        "origin",
        "+main:refs/remotes/origin/main",
      ]);
      diff = run(["diff", "--name-only", "origin/main...HEAD"]);
    }
    expect(
      diff,
      "storia comune con origin/main non disponibile: CA-22 non verificabile",
    ).not.toBeNull();
    const changed = (diff ?? "").split("\n").filter(Boolean);
    expect(changed.length).toBeGreaterThan(0);
    expect(
      changed.filter(
        (f) =>
          f.startsWith("supabase/") ||
          f === "src/types/database.ts" ||
          f === "docs/mockup/tokens.css" ||
          f === "docs/mockup/components.css",
      ),
    ).toEqual([]);
  });
});

test.describe("riga passata leggibile (#241)", () => {
  for (const id of ["riga-passata-normale", "riga-passata-insieme"]) {
    test(`${id}: opacità 1 e testo secondario`, async ({ page }) => {
      await page.goto("/design-system?pezzi-pagine=1");
      const row = page.getByTestId(id);
      const read = (sel: string | null) =>
        (sel ? row.locator(sel) : row).evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-inchiostro-2)";
          document.body.appendChild(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          const cs = getComputedStyle(el);
          return { opacity: cs.opacity, color: cs.color, expected };
        });
      for (const sel of [
        null,
        ".riga-evento__ora",
        ".riga-evento__titolo",
        ".riga-evento__info",
      ]) {
        const r = await read(sel);
        expect(r.opacity).toBe("1");
        expect(r.color).toBe(r.expected);
      }
    });
  }
});
