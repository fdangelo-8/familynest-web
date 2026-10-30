import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  PLACEHOLDERS,
  getActiveNavItem,
  getBarConfig,
  hasBottomNav,
  isCasaRoute,
} from "../../src/lib/app-routes";

// Functional tests for #63 "Componenti condivisi della Casa" (PR #71).
// Everything runs on the design-system gallery (no data, no login), on the
// pure functions of app-routes.ts and on static checks of the source files.
// Colors: ink = rgb(23, 24, 28), night-2 = rgb(42, 41, 37), milk = rgb(244, 242, 236).

const INK = "rgb(23, 24, 28)";
const NIGHT_2 = "rgb(42, 41, 37)";
const MILK = "rgb(244, 242, 236)";

const tid = (page: Page, id: string) => page.getByTestId(id);

/** Centre of an element in viewport coordinates, after scrolling it into view. */
async function centre(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element without a bounding box");
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    box,
  };
}

/** data-testid (or nearest labelled ancestor selector) of the element at a point. */
async function hitTestId(page: Page, x: number, y: number, selector: string) {
  return page.evaluate(
    ([px, py, sel]) => {
      const el = document.elementFromPoint(px as number, py as number);
      const hit = el?.closest(sel as string);
      return hit ? (hit.getAttribute("data-testid") ?? hit.textContent) : null;
    },
    [x, y, selector],
  );
}

function css(locator: Locator, property: string, pseudo?: string) {
  return locator.evaluate(
    (el, [prop, pse]) =>
      getComputedStyle(el, pse || null).getPropertyValue(prop as string),
    [property, pseudo ?? ""],
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system");
});

// ---------------------------------------------------------------- 1. Round check

test.describe("Spunta tonda", () => {
  test("CA-1: il tondo vuoto ha ruolo, nome, classe e misure del mockup", async ({
    page,
  }) => {
    const tondo = tid(page, "tondo-vuoto");
    await expect(
      page.getByRole("checkbox", { name: "Preso: Latte" }).first(),
    ).toBeVisible();
    await expect(tondo).toHaveAttribute("role", "checkbox");
    await expect(tondo).toHaveAccessibleName("Preso: Latte");
    await expect(tondo).toHaveAttribute("aria-checked", "false");
    await expect(tondo).toHaveClass(/(^|\s)tondo-spunta(\s|$)/);
    await expect(tondo).not.toHaveClass(/(^|\s)casella(\s|$)/);
    const box = await tondo.boundingBox();
    expect(box?.width).toBeCloseTo(22, 0);
    expect(box?.height).toBeCloseTo(22, 0);
    const radius = await css(tondo, "border-top-left-radius");
    const radiusPx = radius.endsWith("%")
      ? (parseFloat(radius) / 100) * 22
      : parseFloat(radius);
    expect(radiusPx).toBeGreaterThanOrEqual(11);
    expect(await css(tondo.locator(".icona"), "opacity")).toBe("0");
  });

  test("CA-2: il clic spunta e rimuove la spunta", async ({ page }) => {
    const tondo = tid(page, "tondo-vuoto");
    await tondo.click();
    await expect(tondo).toHaveAttribute("aria-checked", "true");
    expect(await css(tondo, "background-color")).toBe(INK);
    expect(await css(tondo.locator(".icona"), "opacity")).toBe("1");
    await tondo.click();
    await expect(tondo).toHaveAttribute("aria-checked", "false");
  });

  test("CA-3: Spazio e Invio invertono lo stato da tastiera", async ({
    page,
  }) => {
    const tondo = tid(page, "tondo-pieno");
    await expect(tondo).toHaveAttribute("aria-checked", "true");
    await tondo.focus();
    await page.keyboard.press("Space");
    await expect(tondo).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Enter");
    await expect(tondo).toHaveAttribute("aria-checked", "true");
  });

  test("CA-4: il tondo disabilitato non cambia stato", async ({ page }) => {
    const tondo = tid(page, "tondo-disabilitato");
    await tondo.click({ force: true });
    await expect(tondo).toHaveAttribute("aria-checked", "false");
    await expect(tondo).toBeDisabled();
    expect(await css(tondo, "opacity")).toBe("0.4");
    expect(await css(tondo, "cursor")).toBe("not-allowed");
  });

  test("CA-5: la casella quadrata non cambia (nessuna regressione)", async ({
    page,
  }) => {
    for (const id of [
      "casella-vuota",
      "casella-piena",
      "casella-disabilitata",
    ]) {
      const casella = tid(page, id);
      await expect(casella).toHaveClass(/(^|\s)casella(\s|$)/);
      await expect(casella).not.toHaveClass(/(^|\s)tondo-spunta(\s|$)/);
    }
  });
});

// ------------------------------------------------------------ 2. Section switcher

test.describe("Selettore di Casa con voci-link", () => {
  test("CA-6: struttura del gruppo, bottone attuale, link e conteggi", async ({
    page,
  }) => {
    const group = tid(page, "selettore-link");
    await expect(group).toHaveAttribute("role", "group");
    await expect(group).toHaveAccessibleName("Sezione della casa");
    const voci = group.locator(".selettore__voce");
    await expect(voci).toHaveCount(3);

    const spesa = voci.nth(0);
    await expect(spesa).toHaveRole("button");
    await expect(spesa).toHaveAccessibleName("Spesa 4");
    await expect(spesa).toHaveAttribute("aria-pressed", "true");

    const daFare = voci.nth(1);
    await expect(daFare).toHaveRole("link");
    await expect(daFare).toHaveAccessibleName("Da fare");
    await expect(daFare).toHaveAttribute("href", "/casa/da-fare");
    await expect(daFare).not.toHaveAttribute("aria-pressed", /.*/);
    await expect(daFare.locator(".selettore__conteggio")).toHaveCount(0);

    const scadenze = voci.nth(2);
    await expect(scadenze).toHaveRole("link");
    await expect(scadenze).toHaveAccessibleName("Scadenze 99+");
    await expect(scadenze).toHaveAttribute("href", "/casa/scadenze");
    await expect(scadenze).not.toHaveAttribute("aria-pressed", /.*/);
    await expect(scadenze.locator(".selettore__conteggio")).toHaveText("99+");
    await expect(scadenze.locator(".selettore__conteggio")).toHaveText(
      /^99\+$/,
    );
  });

  test("CA-7: il bottone attuale non fa niente", async ({ page }) => {
    const spesa = tid(page, "selettore-link").getByRole("button", {
      name: "Spesa 4",
    });
    await spesa.click();
    await expect(page).toHaveURL(/\/design-system$/);
    await expect(spesa).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-8: il link ha l'aspetto di una voce non scelta; il bottone attuale è inchiostro", async ({
    page,
  }) => {
    const daFare = tid(page, "selettore-link").getByRole("link", {
      name: "Da fare",
    });
    const riferimento = tid(page, "selettore-predefinito").getByRole("button", {
      name: "Mese",
    });
    for (const prop of [
      "height",
      "font-size",
      "font-weight",
      "color",
      "background-color",
    ]) {
      expect(await css(daFare, prop), prop).toBe(await css(riferimento, prop));
    }
    expect(await css(daFare, "text-decoration-line")).toBe("none");
    const spesa = tid(page, "selettore-link").getByRole("button", {
      name: "Spesa 4",
    });
    expect(await css(spesa, "background-color")).toBe(INK);
    expect(await css(spesa, "color")).toBe(MILK);
  });

  test("CA-9: il passaggio del mouse rende il testo del link inchiostro", async ({
    page,
  }) => {
    const daFare = tid(page, "selettore-link").getByRole("link", {
      name: "Da fare",
    });
    await daFare.hover();
    await expect.poll(() => css(daFare, "color")).toBe(INK);
  });

  test("CA-10: Tab scorre le voci e Invio sul link lascia la galleria", async ({
    page,
  }) => {
    const group = tid(page, "selettore-link");
    await group.getByRole("button", { name: "Spesa 4" }).focus();
    await page.keyboard.press("Tab");
    await expect(group.getByRole("link", { name: "Da fare" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      group.getByRole("link", { name: "Scadenze 99+" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(group.getByRole("link", { name: "Da fare" })).toBeFocused();
    await page.keyboard.press("Enter");
    // /casa/da-fare without a session sends the visitor to the login page.
    await expect(page).toHaveURL(/\/accesso/);
  });
});

// ------------------------------------------------------------------ 3. Quick add

test.describe("Campo rapido", () => {
  test("CA-11: struttura del campo rapido, senza bottoni", async ({ page }) => {
    const form = tid(page, "campo-rapido-normale");
    expect(await form.evaluate((el) => el.tagName)).toBe("FORM");
    await expect(form).toHaveAccessibleName("Aggiungi alla spesa…");
    const input = form.getByRole("textbox", { name: "Aggiungi alla spesa…" });
    await expect(input).toHaveAttribute("placeholder", "Aggiungi alla spesa…");
    await expect(input).toHaveAttribute("maxlength", "80");
    await expect(form.locator("label")).toHaveClass(/visivamente-nascosto/);
    await expect(form.getByRole("button")).toHaveCount(0);
    await expect(form.locator("button")).toHaveCount(0);
  });

  test("CA-12: Invio aggiunge, svuota, tiene il fuoco e non ricarica", async ({
    page,
  }) => {
    const other = tid(page, "campo-predefinito");
    const sentinel = "valore che deve restare";
    await other.fill(sentinel);
    const form = tid(page, "campo-rapido-normale");
    const input = form.getByRole("textbox");
    await input.fill("Pomodori");
    await input.press("Enter");
    await expect(tid(page, "campo-rapido-inviati")).toHaveText(
      "Inviati: Pomodori",
    );
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(page).toHaveURL(/\/design-system$/);
    await expect(other).toHaveValue(sentinel);
  });

  test("CA-13: il testo viene ripulito dagli spazi", async ({ page }) => {
    const input = tid(page, "campo-rapido-normale").getByRole("textbox");
    await input.fill("Pomodori");
    await input.press("Enter");
    await input.fill("   Basilico   fresco  ");
    await input.press("Enter");
    await expect(tid(page, "campo-rapido-inviati")).toHaveText(
      "Inviati: Pomodori | Basilico fresco",
    );
  });

  test("CA-14: testo vuoto o solo spazi non invia niente", async ({ page }) => {
    const input = tid(page, "campo-rapido-normale").getByRole("textbox");
    const inviati = tid(page, "campo-rapido-inviati");
    await input.press("Enter");
    await expect(inviati).toHaveText("Inviati: nessuno");
    await input.fill("   ");
    await input.press("Enter");
    await expect(inviati).toHaveText("Inviati: nessuno");
    await expect(input).toHaveValue("   ");
  });

  test("CA-15: massimo 80 caratteri", async ({ page }) => {
    const input = tid(page, "campo-rapido-normale").getByRole("textbox");
    await input.focus();
    const typed = "abcdefghij".repeat(9);
    await page.keyboard.type(typed);
    await expect(input).toHaveValue(typed.slice(0, 80));
    await page.keyboard.press("Enter");
    const text = (await tid(page, "campo-rapido-inviati").textContent()) ?? "";
    expect(text.replace("Inviati: ", "")).toHaveLength(80);
  });

  test("CA-16: anello a riposo e con il fuoco", async ({ page }) => {
    const form = tid(page, "campo-rapido-normale");
    const input = form.getByRole("textbox");
    const piu = form.locator(".campo-rapido__piu");
    const ring = async () => css(form, "box-shadow");

    // Rest: thin ring, plus not on ink.
    expect(await ring()).toMatch(/0px 0px 0px 1px/);
    expect(await css(piu, "background-color")).not.toBe(INK);

    // Focus.
    await input.focus();
    await expect.poll(ring).toContain(INK);
    expect(await ring()).toMatch(/0px 0px 0px 1\.5px/);
    expect(await css(piu, "background-color")).toBe(INK);
    expect(await css(piu, "color")).toBe(MILK);

    // Focus leaves, field still empty: back to rest.
    await input.blur();
    await expect.poll(ring).toMatch(/0px 0px 0px 1px/);
    expect(await ring()).not.toContain("1.5px");
    expect(await css(piu, "background-color")).not.toBe(INK);
  });

  test("CA-16b: da tastiera, Tab porta il fuoco sul campo con l'anello inchiostro", async ({
    page,
  }) => {
    const form = tid(page, "campo-rapido-normale");
    const input = form.getByRole("textbox");
    // Last control before the quick-add field in the gallery.
    // (a time field has several inner segments: Tab until the quick-add field.)
    await tid(page, "campo-ora").focus();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      if (await input.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(input).toBeFocused();
    await expect.poll(() => css(form, "box-shadow")).toContain(INK);
  });

  test("CA-17: con un testo scritto l'aspetto attivo resta senza fuoco", async ({
    page,
  }) => {
    const form = tid(page, "campo-rapido-normale");
    const input = form.getByRole("textbox");
    await input.fill("Latte");
    await input.blur();
    await expect(form).toHaveClass(/campo-rapido--attivo/);
    const ring = await css(form, "box-shadow");
    expect(ring).toContain(INK);
    expect(ring).toMatch(/0px 0px 0px 1\.5px/);
  });

  test("CA-18: il campo con active ha l'aspetto attivo a riposo", async ({
    page,
  }) => {
    const form = tid(page, "campo-rapido-attivo");
    await expect(form).toHaveAccessibleName("Cosa manca in casa?");
    await expect(form).toHaveClass(/campo-rapido--attivo/);
    const ring = await css(form, "box-shadow");
    expect(ring).toContain(INK);
    expect(ring).toMatch(/0px 0px 0px 1\.5px/);
    expect(
      await css(form.locator(".campo-rapido__piu"), "background-color"),
    ).toBe(INK);
  });
});

// ------------------------------------------------------------------------ 4. Toast

test.describe("Toast con grassetto all'inizio e icona a scelta", () => {
  test("CA-19: toast con grassetto iniziale, icona forbici e Annulla", async ({
    page,
  }) => {
    await tid(page, "toast-mostra-inizio").click();
    const toast = page.getByTestId("toast");
    await expect(toast).toHaveCount(1);
    const testo = toast.locator(".toast__testo");
    await expect(testo).toHaveText("3 cose tolte dalla lista.");
    expect(await testo.evaluate((el) => el.firstElementChild?.tagName)).toBe(
      "B",
    );
    await expect(testo.locator("> b")).toHaveText("3 cose");
    await expect(toast.locator("svg use")).toHaveAttribute(
      "href",
      /#i-scissors$/,
    );
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
  });

  test("CA-20: Annulla chiude il toast e incrementa il contatore", async ({
    page,
  }) => {
    const contatore = tid(page, "toast-annullato");
    await expect(contatore).toHaveText("Annullato: 0");
    await tid(page, "toast-mostra-inizio").click();
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByTestId("toast")).toHaveCount(0);
    await expect(contatore).toHaveText("Annullato: 1");
  });

  test("CA-21: toast senza icona e senza Annulla", async ({ page }) => {
    await tid(page, "toast-mostra-senza-icona").click();
    const toast = page.getByTestId("toast");
    await expect(toast.locator(".toast__testo")).toHaveText(
      "Latte è già in lista.",
    );
    expect(
      await toast
        .locator(".toast__testo")
        .evaluate((el) => el.firstElementChild?.tagName),
    ).toBe("B");
    await expect(toast.locator(".toast__testo > b")).toHaveText("Latte");
    await expect(toast.locator("svg")).toHaveCount(0);
    await expect(toast.getByRole("button", { name: "Annulla" })).toHaveCount(0);
  });

  test("CA-22: il toast esistente mantiene icona check e grassetto finale", async ({
    page,
  }) => {
    await tid(page, "toast-mostra").click();
    const toast = page.getByTestId("toast");
    await expect(toast.locator("svg use")).toHaveAttribute("href", /#i-check$/);
    const testo = toast.locator(".toast__testo");
    await expect(testo).toHaveText("Fatto: Chiamare il commercialista");
    expect(await testo.evaluate((el) => el.lastElementChild?.tagName)).toBe(
      "B",
    );
    await expect(testo.locator("> b")).toHaveText("Chiamare il commercialista");
    await expect(toast.getByRole("button", { name: "Annulla" })).toBeVisible();
    // The existing toast tests (5 seconds, pause, one at a time) stay in
    // tests/e2e/design-system.spec.ts and run in the same suite, unchanged.
  });
});

// -------------------------------------------------------------------- 5. Routes

test.describe("Rotte di Casa e segnaposto", () => {
  test("CA-23: isCasaRoute riconosce solo le pagine di Casa che esistono", () => {
    for (const path of ["/casa/spesa", "/casa/da-fare", "/casa/scadenze"]) {
      expect(isCasaRoute(path), path).toBe(true);
    }
    for (const path of [
      "/casa",
      "/casa/pippo",
      "/casalinga",
      "/casa/da-farex",
    ]) {
      expect(isCasaRoute(path), path).toBe(false);
    }
  });

  test("CA-24: voce attiva, barra e navigazione di Da fare e Scadenze", () => {
    for (const path of ["/casa/da-fare", "/casa/scadenze"]) {
      expect(getActiveNavItem(path, "mobile"), path).toBe("casa");
      expect(getActiveNavItem(path, "desktop"), path).toBe("casa");
      expect(getBarConfig(path), path).toEqual({
        kind: "section",
        center: "title",
        actions: ["search", "bell"],
      });
      expect(hasBottomNav(path), path).toBe(true);
    }
    expect(getActiveNavItem("/casa/pippo", "mobile")).toBeNull();
    expect(getActiveNavItem("/casa/pippo", "desktop")).toBeNull();
  });

  test("CA-25: PLACEHOLDERS di Da fare e Scadenze", () => {
    expect(PLACEHOLDERS["casa-da-fare"]).toEqual({
      title: "Casa",
      browserTitle: "FamilyNest · Casa · Da fare",
      icon: "square-check",
      text: "Qui ci saranno le cose da fare della casa. Stiamo preparando questa pagina.",
      backToToday: true,
    });
    expect(PLACEHOLDERS["casa-scadenze"]).toEqual({
      title: "Casa",
      browserTitle: "FamilyNest · Casa · Scadenze",
      icon: "file-clock",
      text: "Qui ci saranno le scadenze della casa. Stiamo preparando questa pagina.",
      backToToday: true,
    });
  });

  // Da fare is a real page since #23 (CasaPage, no placeholder): its own checks.
  test("CA-26: la pagina da-fare ha metadata, requireNest e CasaPage (non più il segnaposto)", () => {
    const file = "src/app/(app)/casa/da-fare/page.tsx";
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toContain('title: "FamilyNest · Casa · Da fare"');
    expect(source).toContain("<CasaPage");
    expect(source).not.toContain("PlaceholderPage");
    // requireNest() is the first statement of the page function.
    const body = source.slice(source.indexOf("export default"));
    const open = body.indexOf("{", body.indexOf(")"));
    expect(
      body
        .slice(open + 1)
        .replace(/^(\s*\/\/[^\n]*\n)+/, "")
        .trimStart(),
    ).toMatch(/^const frame = await requireNest\(\)/);
  });

  // Scadenze is still a placeholder: #24 (PR #123) turns it into a real page
  // and then drops this check.
  for (const [dir, key] of [["scadenze", "casa-scadenze"]] as const) {
    test(`CA-26: la pagina ${dir} ha metadata, requireNest e PlaceholderPage`, () => {
      const file = `src/app/(app)/casa/${dir}/page.tsx`;
      expect(existsSync(file)).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source).toContain(`PLACEHOLDERS["${key}"].browserTitle`);
      expect(source).toMatch(/title:\s*PLACEHOLDERS\[/);
      expect(source).toContain(`<PlaceholderPage pageKey="${key}"`);
      // requireNest() is the first statement of the page function.
      const body = source.slice(source.indexOf("export default"));
      const open = body.indexOf("{", body.indexOf(")"));
      expect(
        body
          .slice(open + 1)
          .replace(/^(\s*\/\/[^\n]*\n)+/, "")
          .trimStart(),
      ).toMatch(/^await requireNest\(\)/);
    });
  }

  test("CA-27: senza sessione Da fare e Scadenze portano a /accesso", async ({
    page,
  }) => {
    for (const path of ["/casa/da-fare", "/casa/scadenze"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/accesso/);
    }
  });
});

// ---------------------------------------------------------------------- 6. Strappo

test.describe("Strappo", () => {
  test("CA-28: la lama a riposo", async ({ page }) => {
    const lama = tid(page, "strappo-riposo").getByRole("button", {
      name: "Togli dalla lista le 3 cose prese",
    });
    const transform = await css(lama, "transform");
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
    expect(await css(lama, "transition-property")).toBe("transform");
    expect(await css(lama, "transition-duration")).toBe("0.2s");
    expect(await css(lama, "transition-timing-function")).toBe(
      "cubic-bezier(0.32, 0.72, 0, 1)",
    );
    expect(await css(lama, "cursor")).toBe("grab");
    expect(await css(lama, "background-color")).toBe(INK);
  });

  test("CA-29: la lama trascinata è spostata di 88 px senza transizione", async ({
    page,
  }) => {
    const strappo = tid(page, "strappo-trascinato");
    await expect(strappo).toHaveClass(/is-trascinato/);
    const lama = strappo.locator(".strappo__lama");
    expect(await css(lama, "transform")).toBe("matrix(1, 0, 0, 1, 88, 0)");
    expect(await css(lama, "transition-duration")).toBe("0s");
    expect(await css(lama, "cursor")).toBe("grabbing");
  });

  test("CA-30: passaggio del mouse e premuto danno il fondo notte-2", async ({
    page,
  }) => {
    const lama = tid(page, "strappo-riposo").locator(".strappo__lama");
    await lama.hover();
    await expect.poll(() => css(lama, "background-color")).toBe(NIGHT_2);
    await page.mouse.move(0, 0);
    await expect.poll(() => css(lama, "background-color")).toBe(INK);
    await lama.hover();
    await page.mouse.down();
    try {
      await expect.poll(() => css(lama, "background-color")).toBe(NIGHT_2);
    } finally {
      await page.mouse.up();
    }
  });

  test("CA-31: con movimento ridotto la lama non ha transizione", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: testInfo.project.use.viewport ?? null,
      baseURL: testInfo.project.use.baseURL,
    });
    const page = await context.newPage();
    await page.goto("/design-system");
    const lama = tid(page, "strappo-riposo").locator(".strappo__lama");
    expect(await css(lama, "transition-duration")).toBe("0s");
    await context.close();
  });
});

// -------------------------------------------------------- 7. Accessibilità e CSS

test.describe("Accessibilità e regole CSS", () => {
  test("CA-32: nessuna violazione serious o critical con il toast visibile e un solo h1", async ({
    page,
  }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await tid(page, "toast-mostra-inizio").click();
    await expect(page.getByTestId("toast")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("CA-33: il controllo statico «nessun valore scritto a mano» esiste ed è in esecuzione", () => {
    // The check itself lives in design-system-static.spec.ts ("CA-10") and runs
    // in the same suite. Here we make sure it has not been removed or renamed.
    const source = readFileSync(
      "tests/e2e/design-system-static.spec.ts",
      "utf8",
    );
    expect(source).toContain(
      "CA-10: nessun valore scritto a mano fuori da :root",
    );
  });

  test("CA-34: le regole nuove stanno dopo «STATI AGGIUNTI DAL DESIGNER»; quelle copiate non cambiano", () => {
    const css = readFileSync("src/app/components.css", "utf8");
    const marker = css.indexOf("STATI AGGIUNTI DAL DESIGNER");
    expect(marker).toBeGreaterThan(0);
    const before = css.slice(0, marker);
    const after = css.slice(marker);

    const compact = (text: string) => text.replace(/\s+/g, "");
    const afterC = compact(after);
    const beforeC = compact(before);

    // New rules, all after the marker.
    const mustBeAfter = [
      ".campo-rapido:focus-within{",
      ".campo-rapido:focus-within.campo-rapido__piu{",
      ".tondo-spunta:disabled",
      ".strappo__lama{transform:translateX(var(--strappo-avanzamento,0));transition:transformvar(--durata-rapida)var(--curva);}",
      ".strappo.is-trascinato.strappo__lama{transition:none;cursor:grabbing;}",
      ".selettore__voce{overflow:visible;clip-path:",
    ];
    for (const rule of mustBeAfter) {
      expect(afterC, rule).toContain(rule);
      expect(beforeC, rule).not.toContain(rule);
    }

    // Touch-area list: both new selectors sit in it, after the marker.
    const touch = after.slice(after.indexOf("Area di tocco di almeno 44 x 44"));
    const firstList = compact(touch.slice(0, touch.indexOf("{")));
    expect(firstList).toContain(".tondo-spunta");
    expect(firstList).toContain(".selettore__voce");
    const secondList = compact(
      touch.slice(
        touch.indexOf("}") + 1,
        touch.indexOf("{", touch.indexOf("}")),
      ),
    );
    expect(secondList).toContain(".tondo-spunta::before");
    expect(secondList).toContain(".selettore__voce::before");

    // opacity: 1 of the counter, after the marker.
    expect(afterC).toMatch(/\.selettore__conteggio\{opacity:1;\}/);

    // Copied rules are identical to docs/mockup/components.css. Known and
    // approved difference: the border of .campo-rapido uses --color-filo-campo
    // (#52) instead of --color-filo-2.
    const rules = (text: string) =>
      [
        ...text
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .matchAll(/([^{}]+)\{([^{}]*)\}/g),
      ]
        .map((m) => [compact(m[1]!), compact(m[2]!).replace(/;$/, "")] as const)
        .filter(([selector]) =>
          /^\.(tondo-spunta|campo-rapido|selettore|strappo)/.test(selector),
        );
    const copied = new Set(rules(before).map(([s, body]) => `${s}|${body}`));
    const mockup = rules(readFileSync("docs/mockup/components.css", "utf8"));
    expect(mockup.length).toBeGreaterThan(15);
    const missing = mockup
      .map(([s, body]) => `${s}|${body}`)
      .filter((rule) => {
        if (copied.has(rule)) return false;
        const approved = rule.replace(
          /--color-filo-2\)$/,
          "--color-filo-campo)",
        );
        return !(rule.startsWith(".campo-rapido|") && copied.has(approved));
      });
    expect(missing).toEqual([]);
  });
});

// ------------------------------------------------------------------ 8. Touch areas

test.describe("Aree di tocco", () => {
  test("CA-35: il tondo resta 22 x 22 e ha un ::before invisibile di 44 px", async ({
    page,
  }) => {
    const tondo = tid(page, "tondo-vuoto");
    const box = await tondo.boundingBox();
    expect(box?.width).toBeCloseTo(22, 0);
    expect(box?.height).toBeCloseTo(22, 0);
    expect(await css(tondo, "position")).toBe("relative");
    expect(await css(tondo, "content", "::before")).toMatch(/^(""|"")$/);
    expect(await css(tondo, "position", "::before")).toBe("absolute");
    expect(await css(tondo, "width", "::before")).toBe("44px");
    expect(await css(tondo, "height", "::before")).toBe("44px");
    expect(await css(tondo, "background-color", "::before")).toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(await css(tondo, "border-top-width", "::before")).toBe("0px");
    expect(await css(tondo, "border-top-style", "::before")).toBe("none");
    expect(await css(tondo, "box-shadow", "::before")).toBe("none");
  });

  test("CA-36: cliccando fuori dal tondo ma dentro i 44 px si cambia lo stato", async ({
    page,
  }) => {
    const tondo = tid(page, "tondo-vuoto");
    const { cx, cy } = await centre(tondo);
    expect(await hitTestId(page, cx + 20, cy, "[data-testid]")).toBe(
      "tondo-vuoto",
    );
    expect(await hitTestId(page, cx, cy - 20, "[data-testid]")).toBe(
      "tondo-vuoto",
    );
    await page.mouse.click(cx + 20, cy);
    await expect(tondo).toHaveAttribute("aria-checked", "true");
    await page.mouse.click(cx, cy - 20);
    await expect(tondo).toHaveAttribute("aria-checked", "false");
  });

  test("CA-37: in una lista le aree di tocco di due righe non si toccano", async ({
    page,
  }) => {
    const uno = tid(page, "tondo-riga-1");
    const due = tid(page, "tondo-riga-2");
    await uno.scrollIntoViewIfNeeded();
    const a = await centre(uno);
    const b = await centre(due);
    // Areas are 44 x 44 centred on the circles: they do not intersect.
    const areaA = { top: a.cy - 22, bottom: a.cy + 22 };
    const areaB = { top: b.cy - 22, bottom: b.cy + 22 };
    expect(areaA.bottom).toBeLessThan(areaB.top);
    // Midpoint belongs to neither circle.
    const mid = (a.cy + b.cy) / 2;
    const midHit = await hitTestId(
      page,
      a.cx,
      mid,
      '[data-testid^="tondo-riga-"]',
    );
    expect(midHit).toBeNull();
    // The point to the right is still the first circle, not the text "Latte".
    expect(await hitTestId(page, a.cx + 20, a.cy, "[data-testid]")).toBe(
      "tondo-riga-1",
    );
    expect(
      await hitTestId(page, a.cx + 20, a.cy, ".riga-lista__testo"),
    ).toBeNull();
    // Clicking below the first circle toggles only the first.
    await page.mouse.click(a.cx, a.cy + 20);
    await expect(uno).toHaveAttribute("aria-checked", "true");
    await expect(due).toHaveAttribute("aria-checked", "false");
  });

  test("CA-38: le voci del selettore restano 32 px; il ::before è 44 px e il taglio è una clip-path", async ({
    page,
  }) => {
    const group = tid(page, "selettore-link");
    expect((await group.boundingBox())?.height).toBeCloseTo(40, 0);
    const voci = group.locator(".selettore__voce");
    await expect(voci).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      const voce = voci.nth(i);
      const box = await voce.boundingBox();
      expect(box?.height).toBeCloseTo(32, 0);
      expect(await css(voce, "position")).toBe("relative");
      expect(await css(voce, "overflow")).toBe("visible");
      expect(await css(voce, "clip-path")).not.toBe("none");
      expect(await css(voce, "content", "::before")).toBe('""');
      expect(await css(voce, "position", "::before")).toBe("absolute");
      expect(await css(voce, "height", "::before")).toBe("44px");
      expect(parseFloat(await css(voce, "width", "::before"))).toBeCloseTo(
        box!.width,
        0,
      );
      expect(await css(voce, "background-color", "::before")).toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect(await css(voce, "border-top-style", "::before")).toBe("none");
      expect(await css(voce, "box-shadow", "::before")).toBe("none");
    }
  });

  test("CA-39: l'area sopra e sotto la voce appartiene al link; le voci affiancate non si rubano il tocco", async ({
    page,
  }) => {
    const group = tid(page, "selettore-link");
    const spesa = group.getByRole("button", { name: "Spesa 4" });
    const daFare = group.getByRole("link", { name: "Da fare" });
    const { cx, cy, box } = await centre(daFare);
    const inLink = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => {
          const el = document.elementFromPoint(px as number, py as number);
          const voce = el?.closest(".selettore__voce");
          return voce ? (voce.textContent ?? "").trim() : null;
        },
        [x, y],
      );
    expect(await inLink(cx, cy - 20)).toMatch(/^Da fare/);
    expect(await inLink(cx, cy + 20)).toMatch(/^Da fare/);

    const spesaBox = (await spesa.boundingBox())!;
    const edge = (spesaBox.x + spesaBox.width + box.x) / 2;
    expect(await inLink(edge - 2, cy)).toMatch(/^Spesa/);
    expect(await inLink(edge + 2, cy)).toMatch(/^Da fare/);
  });

  test("CA-40: anche le voci del selettore predefinito hanno 44 px di area", async ({
    page,
  }) => {
    const group = tid(page, "selettore-predefinito");
    const settimana = group.getByRole("button", { name: "Settimana" });
    // "Settimana" starts pressed: press another one first so the click is meaningful.
    await group.getByRole("button", { name: "Mese" }).click();
    await expect(settimana).toHaveAttribute("aria-pressed", "false");
    const { cx, cy } = await centre(settimana);
    await page.mouse.click(cx, cy - 20);
    await expect(settimana).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Giorno", "Mese"]) {
      await expect(group.getByRole("button", { name })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  test("CA-41: l'aspetto non cambia a nessuna larghezza (tondo 22 px, voci 32 px)", async ({
    page,
  }) => {
    const tondo = await tid(page, "tondo-vuoto").boundingBox();
    expect(tondo?.width).toBeCloseTo(22, 0);
    expect(tondo?.height).toBeCloseTo(22, 0);
    const voci = tid(page, "selettore-link").locator(".selettore__voce");
    for (let i = 0; i < 3; i += 1) {
      expect((await voci.nth(i).boundingBox())?.height).toBeCloseTo(32, 0);
    }
  });
});

// ------------------------------------------------------------------ 9. Counter

test.describe("Conteggio leggibile", () => {
  test("CA-42: il conteggio delle voci non scelte ha opacità 1", async ({
    page,
  }) => {
    const group = tid(page, "selettore-link");
    const scadenze = group
      .getByRole("link", { name: "Scadenze 99+" })
      .locator(".selettore__conteggio");
    expect(await css(scadenze, "opacity")).toBe("1");
    expect(await css(scadenze, "color")).toBe("rgb(90, 93, 100)");
    const spesa = group
      .getByRole("button", { name: "Spesa 4" })
      .locator(".selettore__conteggio");
    expect(await css(spesa, "opacity")).toBe("0.5");

    const conteggio = tid(page, "selettore-conteggio");
    for (const name of [/^Da fare/, /^Scadenze/]) {
      const count = conteggio
        .getByRole("button", { name })
        .locator(".selettore__conteggio");
      expect(await css(count, "opacity"), String(name)).toBe("1");
    }
  });
});
