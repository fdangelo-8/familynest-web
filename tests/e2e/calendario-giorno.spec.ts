import { test as plain } from "@playwright/test";
import { createEvent } from "../fixtures/calendario";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  chooseLens,
  dayPath,
  dayTitle,
  FRI,
  h1,
  head,
  headNames,
  heads,
  hydrated,
  isMobileProject,
  lensGroup,
  mainNav,
  nextDay,
  only,
  open,
  PATH,
  previousDay,
  reopen,
  THU,
  todayLink,
  TUE,
  viewGroup,
  WED,
  alerts,
  boxOf,
  expect,
  test,
  region,
} from "../fixtures/giorno";

// Calendario · Giorno «chi è dove» (#26), part 1: access, days, views,
// columns, «Oggi». Part 2 (blocks, visibility, panel) is in
// calendario-giorno-blocchi.spec.ts, part 3 (free evenings, now line, states,
// time zone, isolation, accessibility) in calendario-giorno-stati.spec.ts.
//
// Written before the page exists, from the criteria of the issue as updated
// on 31/10 (CA-1 ... CA-44). «Today» is martedì 20 ottobre 2026, 15:52 Europe/
// Rome; every test creates its own throwaway Nest and the Nest is deleted with
// its users at the end of the test.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

// ------------------------------------------------------- access and structure

plain.describe("accesso", () => {
  plain(
    "CA-1: senza sessione /calendario/giorno porta a /accesso",
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
  test("CA-3: titolo, scheda del browser, navigazione e vista «Giorno»", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi);
    await expect(h1(page)).toHaveText(
      isMobileProject() ? "Martedì 20" : "Martedì 20 ottobre",
    );
    await expect(page).toHaveTitle("FamilyNest · Calendario");
    await expect(
      mainNav(page).getByRole("link", { name: "Calendario" }),
    ).toHaveAttribute("aria-current", "true");
    await expect(
      viewGroup(page).getByRole("button", { name: "Giorno" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-4: il giorno viene dall'indirizzo, se non è valido è oggi senza errori", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { path: dayPath(FRI) });
    await expect(h1(page)).toHaveText(dayTitle(FRI));
    if (isMobileProject()) await expect(h1(page)).toHaveText("Venerdì 23");
    for (const wrong of ["xyz", "2026-02-30"]) {
      await reopen(page, `${PATH}?giorno=${wrong}`);
      await expect(h1(page), `giorno=${wrong}`).toHaveText(dayTitle(TUE));
      await expect(alerts(page), `giorno=${wrong}`).toHaveCount(0);
      await expect(
        page.getByText("Questa pagina non si è caricata"),
      ).toHaveCount(0);
    }
  });
});

// -------------------------------------------------------------- days, views

test.describe("giorni e viste", () => {
  only(
    "mobile",
    "CA-5: le frecce cambiano giorno, indirizzo e cronologia",
    async ({ page, baseURL, bianchi }) => {
      await open(page, baseURL, bianchi, { pause: false });
      await hydrated(page);
      await nextDay(page).click();
      await expect(h1(page)).toHaveText("Mercoledì 21");
      await expect(page).toHaveURL(/\/calendario\/giorno\?giorno=2026-10-21$/);
      const url = new URL(page.url());
      expect(url.pathname + url.search).toBe(
        "/calendario/giorno?giorno=2026-10-21",
      );

      await page.reload();
      await expect(h1(page)).toHaveText("Mercoledì 21");

      await page.goBack();
      await expect(h1(page)).toHaveText("Martedì 20");

      await hydrated(page);
      await previousDay(page).click();
      await expect(h1(page)).toHaveText("Lunedì 19");
      await previousDay(page).click();
      await expect(h1(page)).toHaveText("Domenica 18");
    },
  );

  only(
    "desktop",
    "CA-6: da fine mese si passa al mese dopo",
    async ({ page, baseURL, bianchi }) => {
      await open(page, baseURL, bianchi, {
        path: dayPath("2026-10-31"),
        pause: false,
      });
      await expect(h1(page)).toHaveText("Sabato 31 ottobre");
      await hydrated(page);
      await nextDay(page).click();
      await expect(h1(page)).toHaveText("Domenica 1 novembre");
      await expect(page).toHaveURL(/giorno=2026-11-01/);
    },
  );

  test("CA-7: «Settimana» e «Mese» portano alla settimana e al mese del giorno", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { path: dayPath(THU) });
    await expect(
      viewGroup(page).getByRole("link", { name: "Settimana" }),
    ).toHaveAttribute("href", "/calendario?settimana=2026-10-19");
    await expect(
      viewGroup(page).getByRole("link", { name: "Mese" }),
    ).toHaveAttribute("href", "/calendario/mese?mese=2026-10");
  });
});

// ------------------------------------------------------------------ columns

test.describe("colonne", () => {
  test("CA-8: con «Nest» le colonne sono Tu, Paolo, Anna, Leo; con «Io» solo Tu", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(region(page)).toBeVisible();
    await expect(headNames(page)).toHaveText(["Tu", "Paolo", "Anna", "Leo"]);
    await chooseLens(page, "Io");
    await expect(headNames(page)).toHaveText(["Tu"]);
    await expect(
      lensGroup(page).getByRole("button", { name: /Io$/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("CA-9: gli animali hanno la colonna solo se hanno impegni nel giorno", async ({
    page,
    baseURL,
    casa,
  }) => {
    await createEvent(casa, "Marco", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, casa, { who: "Marco", lens: "nest" });
    await expect(region(page)).toBeVisible();
    await expect(headNames(page)).toHaveText([
      "Tu",
      "Laura",
      "Sofia",
      "Tommaso",
    ]);
    await expect(head(page, "Biscotto")).toHaveCount(0);

    await createEvent(casa, "Marco", {
      title: "Passeggiata",
      day: TUE,
      from: "17:00",
      to: "18:00",
      participants: ["Biscotto"],
    });
    await reopen(page, PATH);
    await expect(region(page)).toBeVisible();
    await expect(headNames(page)).toHaveText([
      "Tu",
      "Laura",
      "Sofia",
      "Tommaso",
      "Biscotto",
    ]);
  });

  test("CA-10: con 10 persone le colonne ci stanno senza scorrere la pagina", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    const extra = [
      ["Anita", "zafferano"],
      ["Bruno", "lampone"],
      ["Carlo", "ceruleo"],
      ["Dora", "peonia"],
      ["Elio", "basilico"],
      ["Fede", "cannella"],
    ] as const;
    const giulia = bianchi.users.Giulia!;
    for (const [name, color] of extra) {
      const { error } = await giulia.admin.from("household_members").insert({
        household_id: bianchi.householdId,
        kind: "child",
        name,
        color,
      });
      if (error) throw new Error(`Membro di prova non aggiunto: ${name}`);
    }
    await createEvent(bianchi, "Giulia", {
      title: "Riunione di team",
      day: TUE,
      from: "10:00",
      to: "11:00",
    });
    await open(page, baseURL, bianchi, { lens: "nest" });
    await expect(region(page)).toBeVisible();
    await expect(heads(page)).toHaveCount(10);
    const viewport = page.viewportSize()!;
    for (const item of await heads(page).all()) {
      const box = await boxOf(item);
      if (isMobileProject()) {
        expect(box.width, "testa larga almeno 70 px").toBeGreaterThanOrEqual(
          70,
        );
      } else {
        expect(box.x, "testa dentro la finestra").toBeGreaterThanOrEqual(0);
        expect(
          box.x + box.width,
          "testa dentro la finestra",
        ).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth, "la pagina non scorre di lato").toBeLessThanOrEqual(
      viewport.width,
    );
  });
});

// ------------------------------------------------------------------- «Oggi»

test.describe("tornare a oggi", () => {
  async function arrowsOrder(page: import("@playwright/test").Page) {
    return page
      .locator(".periodo__frecce")
      .locator("a, button")
      .evaluateAll((items) =>
        items.map(
          (el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
        ),
      );
  }

  test("CA-40: «Oggi» c'è solo se il giorno non è oggi e riporta a oggi", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { path: dayPath(THU), pause: false });
    await expect(todayLink(page)).toBeVisible();
    await expect(todayLink(page)).toHaveAttribute("href", PATH);
    expect(await arrowsOrder(page)).toEqual([
      "Oggi",
      "Giorno precedente",
      "Giorno successivo",
    ]);
    await hydrated(page);
    await todayLink(page).click();
    await expect(h1(page)).toHaveText(dayTitle(TUE));
    const url = new URL(page.url());
    expect(url.pathname + url.search).toBe(PATH);
    await expect(todayLink(page)).toHaveCount(0);
    await expect(h1(page)).toBeFocused();
    expect(await arrowsOrder(page)).toEqual([
      "Giorno precedente",
      "Giorno successivo",
    ]);
  });

  test("CA-40: su oggi il link «Oggi» non c'è", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { pause: false });
    await expect(h1(page)).toHaveText(dayTitle(TUE));
    await expect(todayLink(page)).toHaveCount(0);
  });

  test("CA-40: arrivando a oggi con la freccia il link sparisce e il fuoco resta sulla freccia", async ({
    page,
    baseURL,
    bianchi,
  }) => {
    await open(page, baseURL, bianchi, { path: dayPath(WED), pause: false });
    await expect(todayLink(page)).toBeVisible();
    await hydrated(page);
    await previousDay(page).click();
    await expect(h1(page)).toHaveText(dayTitle(TUE));
    await expect(todayLink(page)).toHaveCount(0);
    await expect(previousDay(page)).toBeFocused();
  });
});
