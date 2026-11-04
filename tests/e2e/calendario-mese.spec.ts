import { test as plain } from "@playwright/test";
import { createEvent } from "../fixtures/calendario";
import {
  throwawayConfigured,
  throwawaySkipReason,
  createThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  alerts,
  cell,
  cells,
  chooseLens,
  current,
  dayHeading,
  expect,
  grid,
  h1,
  hydrated,
  isMobileProject,
  lensGroup,
  mainNav,
  monthPath,
  next,
  openMonth,
  PATH,
  prev,
  reload,
  reopen,
  selected,
  test,
  TUE,
  viewGroup,
} from "../fixtures/mese";

// Calendario · Mese (#27), part 1: access, structure, months, chosen day,
// views, keyboard, lens. Part 2 (dots, holidays) is in
// calendario-mese-punti.spec.ts, part 3 (list of the day) in
// calendario-mese-elenco.spec.ts, part 4 (states, link «Oggi», time zone,
// isolation, accessibility) in calendario-mese-stati.spec.ts.
//
// Written before the page exists, from the criteria CA-1 ... CA-38 of the
// comment «Criteri di accettazione: aggiornamento (01/11)» of the issue. The
// clock stands at martedì 20 ottobre 2026, 15:52 Europe/Rome.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /calendario/mese porta a /accesso",
    async ({ page }) => {
      await page.goto(PATH);
      await expect(page).toHaveURL(/\/accesso$/);
    },
  );

  plain(
    "CA-2: un utente senza Nest va su /onboarding",
    async ({ page, baseURL }) => {
      plain.skip(!throwawayConfigured(), throwawaySkipReason);
      const user = await createThrowawayUser("Carla");
      try {
        await user.signInContext(page.context(), baseURL as string);
        await page.goto(PATH);
        await expect(page).toHaveURL(/\/onboarding/);
      } finally {
        await user.remove();
      }
    },
  );
});

test.describe("struttura", () => {
  test("CA-3: titolo, scheda, navigazione, vista «Mese» e 35 giorni", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi);
    await expect(h1(page)).toHaveText("Ottobre 2026");
    await expect(page).toHaveTitle("FamilyNest · Calendario");
    await expect(
      mainNav(page).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", "true");
    await expect(
      viewGroup(page).getByRole("button", { name: "Mese" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(cells(page)).toHaveCount(35);
    await expect(cells(page).first()).toHaveAccessibleName(
      "28, lunedì 28 settembre, nessun impegno",
    );
    await expect(cells(page).last()).toHaveAccessibleName(
      "1, domenica 1 novembre, Ognissanti, nessun impegno",
    );
  });

  test("CA-4: il mese viene dall'indirizzo, se non è valido è quello di oggi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, { month: "2026-11" });
    await expect(h1(page)).toHaveText("Novembre 2026");
    await expect(cells(page)).toHaveCount(42);
    await expect(cells(page).first()).toHaveAccessibleName(
      /^26, lunedì 26 ottobre/,
    );
    await expect(cells(page).last()).toHaveAccessibleName(
      /^6, domenica 6 dicembre/,
    );

    await reopen(page, monthPath("2027-02"));
    await expect(h1(page)).toHaveText("Febbraio 2027");
    await expect(cells(page)).toHaveCount(28);
    await expect(cells(page).first()).toHaveAccessibleName(
      /^1, lunedì 1 febbraio/,
    );
    await expect(cells(page).last()).toHaveAccessibleName(
      /^28, domenica 28 febbraio/,
    );

    for (const wrong of ["xyz", "2026-13", "2026-1"]) {
      await reopen(page, monthPath(wrong));
      await expect(h1(page), `mese=${wrong}`).toHaveText("Ottobre 2026");
      await expect(alerts(page), `mese=${wrong}`).toHaveCount(0);
      await expect(
        page.getByText("Questa pagina non si è caricata"),
      ).toHaveCount(0);
    }
  });

  test("CA-5: una griglia di 42 giorni con il cambio dell'ora si legge", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Colazione fuori",
      day: "2028-10-29",
      from: "10:00",
      to: "11:00",
    });
    await openMonth(page, baseURL, bianchi, { month: "2028-10" });
    await expect(h1(page)).toHaveText("Ottobre 2028");
    await expect(cells(page)).toHaveCount(42);
    await expect(alerts(page)).toHaveCount(0);
    const sunday = grid(page).getByRole("gridcell", {
      name: /^29, domenica 29 ottobre/,
    });
    await expect(sunday.locator("[data-membro]")).toHaveCount(1);
    await expect(sunday.locator("[data-membro]")).toHaveAttribute(
      "data-membro",
      bianchi.members["Giulia"]!,
    );
  });
});

// ---------------------------------------------------- months, chosen day, views

test.describe("mesi, giorno scelto e viste", () => {
  test("CA-6: le frecce cambiano mese, indirizzo, cronologia e fuoco", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    test.skip(!isMobileProject(), "Il criterio dice mobile");
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    await next(page).click();
    await expect(h1(page)).toHaveText("Novembre 2026");
    await expect(page).toHaveURL(/\/calendario\/mese\?mese=2026-11$/);
    await expect(next(page)).toBeFocused();

    await reload(page);
    await expect(h1(page)).toHaveText("Novembre 2026");

    await page.goBack();
    await expect(h1(page)).toHaveText("Ottobre 2026");

    await hydrated(page);
    await prev(page).click();
    await expect(h1(page)).toHaveText("Settembre 2026");
    await prev(page).click();
    await expect(h1(page)).toHaveText("Agosto 2026");
  });

  test("CA-6: da dicembre si passa a gennaio dell'anno dopo", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi, { month: "2026-12" });
    await hydrated(page);
    await next(page).click();
    await expect(h1(page)).toHaveText("Gennaio 2027");
    await expect(page).toHaveURL(/mese=2027-01/);
  });

  test("CA-7: oggi è il giorno scelto; in un altro mese lo è il 1°", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Allenamento",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Giulia", "Leo"],
    });
    await openMonth(page, baseURL, bianchi);
    await expect(selected(page)).toHaveCount(1);
    await expect(selected(page)).toHaveAccessibleName(
      "20, martedì 20 ottobre, oggi, 1 impegno: tu e Leo",
    );
    await expect(current(page)).toHaveCount(1);
    await expect(current(page)).toHaveAccessibleName(
      "20, martedì 20 ottobre, oggi, 1 impegno: tu e Leo",
    );
    await expect(dayHeading(page)).toHaveText("Martedì 20");

    await hydrated(page);
    await next(page).click();
    await expect(h1(page)).toHaveText("Novembre 2026");
    await expect(selected(page)).toHaveCount(1);
    await expect(selected(page)).toHaveAccessibleName(
      "1, domenica 1 novembre, Ognissanti, nessun impegno",
    );
    await expect(current(page)).toHaveCount(0);
    await expect(dayHeading(page)).toHaveText("Domenica 1");
  });

  test("CA-8: toccare un giorno lo sceglie senza cambiare pagina, anche di un altro mese", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    const url = page.url();
    await grid(page)
      .getByRole("gridcell", { name: /^23, venerdì 23 ottobre/ })
      .click();
    await expect(selected(page)).toHaveCount(1);
    await expect(selected(page)).toHaveAccessibleName(
      /^23, venerdì 23 ottobre/,
    );
    await expect(dayHeading(page)).toHaveText("Venerdì 23");
    expect(page.url()).toBe(url);

    await grid(page)
      .getByRole("gridcell", { name: /^1, domenica 1 novembre/ })
      .click();
    await expect(dayHeading(page)).toHaveText("Domenica 1 novembre");
    await expect(h1(page)).toHaveText("Ottobre 2026");
    expect(page.url()).toBe(url);
  });

  test("CA-9: «Giorno» e «Settimana» seguono il giorno scelto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    const day = viewGroup(page).getByRole("link", { name: "Giorno" });
    const week = viewGroup(page).getByRole("link", { name: "Settimana" });
    await expect(day).toHaveAttribute(
      "href",
      "/calendario/giorno?giorno=2026-10-20",
    );
    await expect(week).toHaveAttribute(
      "href",
      "/calendario?settimana=2026-10-19",
    );
    await grid(page)
      .getByRole("gridcell", { name: /^29, giovedì 29 ottobre/ })
      .click();
    await expect(day).toHaveAttribute(
      "href",
      "/calendario/giorno?giorno=2026-10-29",
    );
    await expect(week).toHaveAttribute(
      "href",
      "/calendario?settimana=2026-10-26",
    );
  });

  test("CA-10: la griglia è una sola fermata del Tab e si guida con le frecce", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "Il criterio dice desktop");
    await openMonth(page, baseURL, bianchi);
    await hydrated(page);
    const day20 = cell(page, TUE);
    // Tab from the view switcher: the next stop is the grid, on the chosen day.
    await viewGroup(page).getByRole("button", { name: "Mese" }).focus();
    await expect(async () => {
      await page.keyboard.press("Tab");
      await expect(day20).toBeFocused({ timeout: 500 });
    }).toPass();
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('[role="grid"]'),
    );
    expect(inside, "un altro Tab porta fuori dalla griglia").toBe(false);

    await day20.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const day28 = grid(page).getByRole("gridcell", {
      name: /^28, mercoledì 28 ottobre/,
    });
    await expect(day28).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(day28).toHaveAttribute("aria-selected", "true");
    await expect(dayHeading(page)).toHaveText("Mercoledì 28");

    await page.keyboard.press("ArrowLeft");
    const day27 = grid(page).getByRole("gridcell", {
      name: /^27, martedì 27 ottobre/,
    });
    await expect(day27).toBeFocused();
    await page.keyboard.press("Space");
    await expect(day27).toHaveAttribute("aria-selected", "true");
    await expect(dayHeading(page)).toHaveText("Martedì 27");
  });

  test("CA-11: cambiare lente non cambia indirizzo né giorno scelto", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    test.skip(isMobileProject(), "Il criterio dice desktop");
    await openMonth(page, baseURL, bianchi, { lens: "nest" });
    await hydrated(page);
    const url = page.url();
    await chooseLens(page, "Io");
    await expect(
      lensGroup(page).getByRole("button", { name: /Io$/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(page.url()).toBe(url);
    await expect(selected(page)).toHaveAccessibleName(
      /^20, martedì 20 ottobre/,
    );
  });
});
