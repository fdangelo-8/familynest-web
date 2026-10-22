import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const BASE_PATH = "/design-system";

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_PATH);
});

function tokensFromMockup(): Record<string, string> {
  const css = readFileSync("docs/mockup/tokens.css", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
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
  test("CA-1: i token coincidono con tokens.css", async ({ page }) => {
    const tokens = tokensFromMockup();
    const names = Object.keys(tokens);
    expect(names).toHaveLength(202);
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
  });

  test("CA-2: i font agganciati a next/font", async ({ page }) => {
    const tokens = tokensFromMockup();
    const actual = await rootValues(page, ["--font-titoli", "--font-testo"]);
    expect(actual["--font-titoli"]).toContain("Parkinsans");
    expect(actual["--font-testo"]).toContain("Host Grotesk");
    // Same fallback families as tokens.css, same order.
    const fallbacks = (value: string) =>
      value
        .split(",")
        .map((part) => part.trim().replace(/['"]/g, ""))
        .filter((part) => !/Parkinsans|Host Grotesk/.test(part));
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
    expect(body.background).toBe("rgb(241, 242, 238)");
    expect(body.color).toBe("rgb(23, 24, 28)");
    expect(body.size).toBe("15px");
    expect(body.line).toBe("22px");
    expect(body.family).toContain("Host Grotesk");
  });

  test("CA-4: font caricati e t-display", async ({ page }) => {
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family);
    });
    expect(loaded.some((family) => family.includes("Parkinsans"))).toBe(true);
    expect(loaded.some((family) => family.includes("Host Grotesk"))).toBe(true);
    const display = page.getByTestId("t-display-esempio");
    await expect(display).toHaveCSS("font-weight", "300");
    await expect(display).toHaveCSS("font-family", /Parkinsans/);
  });

  test("CA-5: nessuna richiesta a Google Fonts", async ({ page }) => {
    const hosts: string[] = [];
    page.on("request", (request) => hosts.push(new URL(request.url()).host));
    await page.goto("/");
    await page.goto(BASE_PATH);
    expect(
      hosts.filter((host) => /fonts\.g(oogleapis|static)\.com/.test(host)),
    ).toEqual([]);
  });

  test("CA-6: misure dei titoli tra mobile e desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 });
    await expect(page.getByTestId("t-titolo-pagina-esempio")).toHaveCSS(
      "font-size",
      "32px",
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
    await expect(target).toHaveCSS("outline-color", "rgb(51, 85, 204)");
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
  test("CA-12: uno sprite con 79 simboli, senza stethoscope", async ({
    page,
  }) => {
    await expect(
      page.locator('svg.sprite-icone[aria-hidden="true"]'),
    ).toHaveCount(1);
    await expect(page.locator("svg.sprite-icone symbol")).toHaveCount(79);
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
      "rgb(200, 50, 47) 0px 0px 0px 1.5px inset",
    );
  });

  test("CA-19: data e ora", async ({ page }) => {
    const date = page.getByTestId("campo-data");
    const time = page.getByTestId("campo-ora");
    await expect(date).toHaveAttribute("type", "date");
    await expect(time).toHaveAttribute("type", "time");
    await expect(date).toHaveValue("2026-10-20");
    await expect(time).toHaveValue("17:00");
    for (const field of [date, time, page.getByTestId("campo-predefinito")]) {
      await expect(field).toHaveCSS("height", "52px");
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
        "rgb(23, 24, 28)",
      );
    }
    await chips.nth(0).hover();
    await expect(chips.nth(0)).toHaveCSS("background-color", "rgb(42, 41, 37)");
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
    await expect(laura).toHaveCSS("background-color", "rgb(92, 127, 224)");
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

  test("CA-30: il foglio si chiude trascinando la maniglia", async ({
    page,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, "solo mobile");
    const opener = page.getByRole("button", { name: "Apri foglio" });
    const dialog = page.getByRole("dialog", { name: "Aggiungi" });
    const drag = async (distance: number) => {
      const handle = page.getByTestId("sheet-maniglia");
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
      expect(Math.round(box.x)).toBe(20);
      expect(Math.round(viewport.width - (box.x + box.width))).toBe(20);
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
  const SECTIONS: Array<[string, string]> = [
    ["btn-primary", ".btn-primary"],
    ["btn-secondary", ".btn-secondary"],
    ["btn-tenue", ".btn-tenue"],
    ["btn-tratteggiato", ".btn-tratteggiato"],
    ["btn-pericolo", ".btn-pericolo"],
    ["btn-pericolo-pieno", ".btn-pericolo-pieno"],
    ["btn-icona", ".btn-icona"],
    ["casella", ".casella"],
    ["toggle", ".toggle"],
    ["etichetta", ".etichetta"],
    ["avatar", '.avatar:not([class*="avatar--"])'],
    ["chip", ".chip--statico"],
    ["campo", ".campo__input"],
    ["selettore", ".selettore"],
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

  async function read(page: Page) {
    return page.evaluate(
      ({ sections, props }) =>
        Object.fromEntries(
          sections.map(([id, selector]) => {
            const element = document.querySelector(`#${id} ${selector}`);
            const style = element ? getComputedStyle(element) : null;
            return [
              id,
              style
                ? Object.fromEntries(
                    props.map((p) => [p, style.getPropertyValue(p)]),
                  )
                : null,
            ];
          }),
        ),
      { sections: SECTIONS, props: PROPS },
    );
  }

  test("i componenti hanno gli stessi valori del mockup a 390 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_PATH);
    const ours = await read(page);
    await page.goto(`file://${process.cwd()}/docs/mockup/design-system.html`);
    const theirs = await read(page);
    for (const [id] of SECTIONS) {
      expect(theirs[id], `${id} nel mockup`).not.toBeNull();
      expect(ours[id], id).toEqual(theirs[id]);
    }
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
