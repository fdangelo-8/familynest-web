import { createEvent } from "../fixtures/impegni";
import { waitHydrated } from "../fixtures/profilo";
import {
  T,
  expect,
  expectReady,
  field,
  isMobile,
  openSearch,
  palette,
  recordSearch,
  ringOf,
  test,
  typeSearch,
  example,
  filters,
  pressedChips,
  chipTexts,
} from "../fixtures/ricerca";

// Ricerca (#40): how it opens, the normal state and the field (CA-1 ... CA-13, CA-61).
// Data: a throwaway Nest per test; dates relative to T, a Tuesday (fixtures/ricerca.ts).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const MAIN_NAV = { name: "Navigazione principale" };
const LENS_DESKTOP = "Cerca nel Nest (⌘K)";

test.describe("accesso e apertura", () => {
  test("CA-1: senza sessione /ricerca porta a /accesso", async ({ page }) => {
    await page.goto("/ricerca");
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test("CA-2: da /calendario la lente apre la pagina: titolo, campo vuoto con il fuoco, h1 nascosto, nessuna barra", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "La pagina intera c'è solo su mobile (390 px)");
    await nest.signIn(page, baseURL, "Marco");
    await page.goto("/calendario");
    const lens = page.getByRole("link", {
      name: "Cerca nel Nest",
      exact: true,
    });
    await waitHydrated(lens);
    await lens.click();

    await expect(page).toHaveURL(/\/ricerca$/);
    await expect(page).toHaveTitle("FamilyNest · Ricerca");
    await expectReady(page);
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveValue("");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Cerca nel Nest" }),
    ).toHaveCount(1);
    await expect(page.getByRole("navigation", MAIN_NAV)).toHaveCount(0);
    await expect(page.locator("header.barra")).toHaveCount(0);
    for (const name of ["Indietro", "Notifiche", "Cerca nel Nest"]) {
      await expect(
        page.getByRole("link", { name, exact: true }),
        name,
      ).toHaveCount(0);
    }
  });

  test("CA-3: su mobile la lente c'è in Casa, Calendario mese ed Esplora; non in Oggi, Nest e dettaglio impegno", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "La lente nella barra c'è solo su mobile (390 px)");
    const eventId = await createEvent(nest, "Marco", {
      title: "Riunione di classe",
      day: T,
      from: "17:00",
      to: "18:00",
      members: ["Sofia"],
    });
    await nest.signIn(page, baseURL, "Marco");
    const lens = page.getByRole("link", {
      name: "Cerca nel Nest",
      exact: true,
    });
    const without = ["/oggi", "/nest", `/impegni/${eventId}`];
    for (const path of without) {
      await page.goto(path);
      await expect(page.getByRole("main"), path).toBeVisible();
      await expect(lens, path).toHaveCount(0);
    }
    const withLens = [
      "/casa/spesa",
      "/casa/da-fare",
      "/casa/scadenze",
      "/calendario/mese",
      "/esplora",
    ];
    for (const path of withLens) {
      await page.goto(path);
      await expect(lens, path).toBeVisible();
    }
  });

  test("CA-4: su desktop Control+K apre il dialogo modale con il fuoco nel campo e «Calendario» resta attivo", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
    await nest.signIn(page, baseURL, "Marco");
    await page.goto("/calendario");
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(palette(page)).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(palette(page)).toHaveAttribute("aria-modal", "true");
    await expect(field(page)).toBeFocused();
    await expect(page).toHaveURL(/\/ricerca$/);
    await expect(
      page
        .getByRole("navigation", MAIN_NAV)
        .getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", /^(page|true)$/);
  });

  test("CA-5: su desktop Esc chiude il dialogo (non svuota il campo), l'indirizzo torna e il fuoco va alla lente", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
    await nest.signIn(page, baseURL, "Marco");
    await page.goto("/casa/spesa");
    const lens = page.getByRole("link", { name: LENS_DESKTOP, exact: true });
    await waitHydrated(lens);
    await lens.click();
    await expect(palette(page)).toBeVisible();
    await expect(field(page)).toBeFocused();
    await typeSearch(page, "nuoto");
    await page.keyboard.press("Escape");

    await expect(palette(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/casa\/spesa$/);
    await expect(lens).toBeFocused();
  });

  test("CA-6: su desktop /ricerca aperto a mano è il dialogo sopra Oggi; Esc porta a /oggi", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
    await openSearch(page, baseURL, nest);
    await expect(palette(page)).toBeVisible();
    await expect(
      page
        .getByRole("navigation", MAIN_NAV)
        .getByRole("link", { name: "Oggi" }),
    ).toHaveAttribute("aria-current", /^(page|true)$/);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/oggi$/);
  });

  test("CA-7: con il dialogo aperto Control+K e Meta+K non lo chiudono né lo riaprono: il testo resta", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
    await openSearch(page, baseURL, nest);
    await typeSearch(page, "nuoto");
    const input = field(page);
    await input.press("Control+k");
    await input.press("Meta+k");
    await expect(palette(page)).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("nuoto");
    await expect(page).toHaveURL(/\/ricerca$/);
  });

  test("CA-8: su mobile «Annulla» torna alla pagina di partenza; aperta a mano porta a /oggi", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "«Annulla» c'è solo su mobile (390 px)");
    await nest.signIn(page, baseURL, "Marco");
    await page.goto("/casa/da-fare");
    const lens = page.getByRole("link", {
      name: "Cerca nel Nest",
      exact: true,
    });
    await waitHydrated(lens);
    await lens.click();
    await expect(page).toHaveURL(/\/ricerca$/);
    await expectReady(page);
    await page.getByRole("link", { name: "Annulla", exact: true }).click();
    await expect(page).toHaveURL(/\/casa\/da-fare$/);

    await page.goto("/ricerca");
    await expectReady(page);
    await page.getByRole("link", { name: "Annulla", exact: true }).click();
    await expect(page).toHaveURL(/\/oggi$/);
  });
});

test.describe("stato normale", () => {
  test("CA-9: su mobile a campo vuoto: chip dei filtri senza numeri, Persone nell'ordine del Nest, Prova a cercare", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "I chip e le Persone ci sono solo su mobile");
    await openSearch(page, baseURL, nest);
    await expect
      .poll(() => chipTexts(page))
      .toEqual(["Tutto", "Impegni", "Spesa", "Da fare", "Scadenze"]);
    await expect.poll(() => pressedChips(page)).toEqual(["Tutto"]);
    const chips = filters(page).getByRole("button");
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
    for (const index of [1, 2, 3, 4]) {
      await expect(chips.nth(index)).toHaveAttribute("aria-pressed", "false");
    }

    const people = page.getByTestId("ricerca-persone").getByRole("button");
    const names = ["Tu", "Laura", "Sofia", "Tommaso", "Biscotto"];
    await expect(people).toHaveCount(names.length);
    for (const [index, name] of names.entries()) {
      await expect(people.nth(index)).toHaveAccessibleName(name);
      await expect(people.nth(index)).not.toHaveAttribute("aria-pressed");
    }

    const examples = page.getByTestId("ricerca-esempi");
    await expect(
      examples.getByRole("heading", { level: 2, name: "Prova a cercare" }),
    ).toBeVisible();
    const texts = ["questo weekend", "cose di Sofia", "scade a novembre"];
    const buttons = examples.getByRole("button");
    await expect(buttons).toHaveCount(texts.length);
    for (const [index, text] of texts.entries()) {
      await expect(buttons.nth(index)).toHaveAccessibleName(text);
      await expect(buttons.nth(index)).not.toHaveAttribute("aria-pressed");
    }
  });

  test("CA-10: su desktop a campo vuoto non ci sono chip dei filtri né Persone; c'è Prova a cercare", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(isMobile(), "La palette c'è solo su desktop (1280 px)");
    await openSearch(page, baseURL, nest);
    await expect(example(page, "questo weekend")).toBeVisible();
    await expect(palette(page).getByText("Prova a cercare")).toBeVisible();
    await expect(page.getByTestId("ricerca-filtri")).toHaveCount(0);
    await expect(page.getByTestId("ricerca-persone")).toHaveCount(0);
    await expect(palette(page).getByText("Persone")).toHaveCount(0);
  });

  test("CA-11: su mobile il chip di una persona scrive «cose di <Nome>» e cerca; «Tu» scrive il proprio nome", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "Le Persone ci sono solo su mobile");
    await createEvent(nest, "Marco", {
      title: "Nuoto Sofia",
      day: T,
      from: "17:00",
      to: "18:30",
      members: ["Sofia"],
    });
    await nest.todo("Marco", {
      title: "Comprare le scarpe",
      assignee: "Tommaso",
    });
    await nest.deadline("Marco", {
      title: "Iscrizione al corso di nuoto",
      due: T,
      forMember: "Sofia",
    });
    await openSearch(page, baseURL, nest);
    const people = page.getByTestId("ricerca-persone");

    await people.getByRole("button", { name: "Sofia", exact: true }).click();
    await expect(field(page)).toHaveValue("cose di Sofia");
    await expect(
      page.getByTestId("ricerca-gruppo-event").getByText("Nuoto Sofia"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("ricerca-gruppo-deadline")
        .getByText("Iscrizione al corso di nuoto"),
    ).toBeVisible();
    await expect(page.getByText("Comprare le scarpe")).toHaveCount(0);

    await field(page).fill("");
    await people.getByRole("button", { name: "Tu", exact: true }).click();
    await expect(field(page)).toHaveValue("cose di Marco");
  });

  test("CA-12: con un solo carattere non parte nessuna richiesta e restano Persone e Prova a cercare", async ({
    page,
    baseURL,
    nest,
  }) => {
    test.skip(!isMobile(), "Le Persone ci sono solo su mobile");
    await openSearch(page, baseURL, nest);
    const search = recordSearch(page);
    await typeSearch(page, "n");
    // The clock is installed by openSearch: this moves it past the 250 ms of the wait.
    await page.clock.runFor(2000);
    await expect(page.getByTestId("ricerca-persone")).toBeVisible();
    await expect(page.getByTestId("ricerca-esempi")).toBeVisible();
    await expect(page.getByTestId("ricerca-caricamento")).toHaveCount(0);
    expect(search.calls).toEqual([]);
  });

  test("CA-13: il campo accetta al massimo 100 caratteri", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openSearch(page, baseURL, nest);
    const input = field(page);
    await input.pressSequentially("a".repeat(120));
    await expect(input).toHaveValue("a".repeat(100));
    await expect(input).toHaveAttribute("maxlength", "100");
  });
});

test.describe("fuoco del campo", () => {
  test("CA-61: il contenitore .campo-ricerca ha l'anello di fuoco visibile solo con il fuoco nel campo", async ({
    page,
    baseURL,
    nest,
  }) => {
    await openSearch(page, baseURL, nest);
    const container = page.locator(".campo-ricerca");
    await expect(field(page)).toBeFocused();
    await expect
      .poll(async () => {
        const ring = await ringOf(container);
        return ring.style !== "none" && ring.width > 0;
      })
      .toBe(true);

    await field(page).evaluate((input) => (input as HTMLElement).blur());
    await expect(field(page)).not.toBeFocused();
    await expect
      .poll(async () => {
        const ring = await ringOf(container);
        return ring.style === "none" || ring.width === 0;
      })
      .toBe(true);
  });
});
