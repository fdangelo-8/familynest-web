import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  BISCOTTO,
  D1_TITLE,
  D2_TITLE,
  D3_TITLE,
  FULL_MIA,
  LAURA,
  LEO,
  LOAD_ERROR,
  MARCO,
  NOT_FOUND,
  PAGE_TITLE,
  PROFILE_TABLE,
  SOFIA,
  TODAY,
  childPath,
  counters,
  createDeadlines,
  createEvents,
  escapeRx,
  failRequests,
  h1,
  holdRequests,
  moveDeadline,
  openChild,
  openSheet,
  pageText,
  pencil,
  readProfile,
  recordResponses,
  removeDeadlines,
  section,
  setBirth,
  setSchoolDays,
  standardCase,
  subtitle,
  withAltraCasa,
  withFigli,
  writeProfile,
} from "../fixtures/figlio";
import { setClock } from "../fixtures/casa";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Profilo di un figlio" (#31, PR #245, /figli/<id>): one test or more for every
// acceptance criterion CA-1 ... CA-50 (the edit sheet, CA-26 and CA-29 ... CA-42,
// CA-48 ... CA-50 are in profilo-figlio-modifica.spec.ts; the links of
// «Il tuo Nest», CA-43 ... CA-45, are in il-tuo-nest.spec.ts, where they replace
// CA-8 and CA-9 of #17 and CA-38 of #18). Seeded users A, B, C only read; every
// test that writes uses its own throwaway Nests (U = Ugo, U2 = Vera, V = Vito),
// deleted at the end. A criterion without «anche 1280» holds at 390 px: on
// desktop it is skipped. The clock is fixed at martedì 20 ottobre 2026, 15:52
// (Europe/Rome) where the criterion says «orologio fermo».

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const only1280 = () => test.skip(isMobile(), "Criterio valido solo a 1280 px");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);
const needsSeed = (...keys: ("A" | "B" | "C")[]) =>
  test.skip(!usersConfigured(...keys), skipReason(...keys));

const SCADENZE = "/casa/scadenze";
const D1_NAME = `14 giorni alla scadenza: «${D1_TITLE}», urgente`;

// ------------------------------------------------------------------- helpers

const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });
const backLink = (page: Page) =>
  page.getByRole("link", { name: "Indietro", exact: true });
const weekRows = (page: Page) =>
  section(page, "Questa settimana").locator("li");

/** Number, text, link or not, and urgent dot of one counter. */
async function expectCounter(
  counter: Locator,
  number: string,
  info: string,
  options: { href?: string; dot?: boolean } = {},
) {
  await expect(counter.locator(".contatore__numero")).toHaveText(number);
  await expect(counter.locator(".contatore__info")).toHaveText(
    new RegExp(`^${escapeRx(info)}(?:[:,]|$)`),
  );
  const tag = await counter.evaluate((element) => element.tagName);
  if (options.href) {
    expect(tag).toBe("A");
    await expect(counter).toHaveAttribute("href", options.href);
  } else {
    expect(tag).not.toBe("A");
  }
  const dot = counter.locator(".pallino-urgente");
  if (options.dot) {
    await expect(dot).toHaveCount(1);
    await expect(dot).toHaveAttribute("aria-hidden", "true");
  } else {
    await expect(dot).toHaveCount(0);
  }
}

/** The page the server sent, as the browser receives it (no scripts run). */
async function htmlOf(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  return response.text();
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    )
    .map((violation) => violation.id);
}

// ---------------------------------------------------- accesso e isolamento

test.describe("accesso e isolamento", () => {
  test("CA-1: senza sessione /figli/<id> porta a /accesso", async ({
    page,
  }) => {
    only390();
    await page.goto(childPath(SOFIA));
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: C, senza Nest, arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsSeed("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(childPath(SOFIA));
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-3: B non vede Sofia e A non vede Leo: «Questa pagina non c’è» e nessun dato nell'HTML", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsSeed("A", "B");
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto(childPath(SOFIA));
    await expect(h1(page)).toHaveText(NOT_FOUND);
    const htmlB = await htmlOf(page, childPath(SOFIA));
    expect(htmlB).not.toMatch(/\bSofia\b/);
    expect(htmlB).not.toMatch(/Casa D(?:'|&#x27;|’)Angelo/);
    expect(htmlB).not.toContain("Rinnovo carta d");

    await page.context().clearCookies();
    await signInAs(page.context(), baseURL as string, "A");
    await page.goto(childPath(LEO));
    await expect(h1(page)).toHaveText(NOT_FOUND);
    const htmlA = await htmlOf(page, childPath(LEO));
    expect(htmlA).not.toMatch(/\bLeo\b/);
    expect(htmlA).not.toContain("Casa Bianchi");
  });

  test("CA-4: V non vede Mia: «Questa pagina non c’è», né HTML né risposte di rete con i suoi dati", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await withAltraCasa(async (altra) => {
        const responses = recordResponses(page);
        await altra.nest.signIn(page, baseURL, "Vito");
        await page.goto(childPath(ctx.mia));
        await expect(h1(page)).toHaveText(NOT_FOUND);
        const html = await htmlOf(page, childPath(ctx.mia));
        const seen = `${html}\n${await responses.text()}`;
        expect(seen).not.toMatch(/\bMia\b/);
        for (const text of [
          "Manzoni",
          "Bianchi",
          "234 5678",
          "Nuoto",
          "Rinnovo carta d",
        ]) {
          expect(seen, text).not.toContain(text);
        }
      });
    });
  });

  test("CA-5: V, con la propria sessione, non legge né scrive i dati di Mia", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await withAltraCasa(async (altra) => {
        const vito = altra.nest.users["Vito"]!.client;
        const before = await readProfile(ctx, ctx.mia);

        const profile = await vito
          .from("child_profiles")
          .select("*")
          .eq("member_id", ctx.mia);
        expect(profile.error).toBeNull();
        expect(profile.data).toEqual([]);
        const teachers = await vito
          .from("child_teachers")
          .select("*")
          .eq("member_id", ctx.mia);
        expect(teachers.error).toBeNull();
        expect(teachers.data).toEqual([]);

        const save = await vito.rpc("save_child_profile", {
          p_member_id: ctx.mia,
          p_name: "Intrusa",
          p_color: "peonia",
          p_teachers: [{ name: "Maestra Falsa" }],
          p_school_class: "9Z",
          p_shoe_size: "99",
        });
        expect(save.error).not.toBeNull();
        expect(save.error?.code).toBe("42501");

        const insert = await vito.from("child_profiles").insert({
          member_id: ctx.mia,
          school_name: "Scuola Falsa",
        });
        expect(insert.error).not.toBeNull();

        const after = await readProfile(ctx, ctx.mia);
        expect(after).toEqual(before);
        expect(after.member.name).toBe("Mia");
      });
    });
  });

  test("CA-6: adulti, animale, sé stessi, id non valido, id inesistente e /figli: «Questa pagina non c’è»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsSeed("A");
    await signInAs(page.context(), baseURL as string, "A");
    const paths = [
      childPath(LAURA),
      childPath(BISCOTTO),
      childPath(MARCO),
      "/figli/abc",
      childPath("c7d2a4e0-5b1f-4c3a-9e8d-123456789abc"),
      "/figli",
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(h1(page), path).toHaveText(NOT_FOUND);
      await expect(page.getByText(LOAD_ERROR), path).toHaveCount(0);
    }
  });
});

// ------------------------------------------------------- contenuto (normale)

test.describe("contenuto dello stato normale", () => {
  test("CA-7: titolo, h1, avatar, riga sotto l'h1, barra e navigazione a 390 px", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

      await expect(page).toHaveTitle(PAGE_TITLE);
      await expect(h1(page)).toHaveCount(1);
      const avatar = page.locator("main .avatar--xl");
      await expect(avatar).toHaveText("M");
      await expect(avatar).toHaveClass(/\bmembro-salvia\b/);
      await expect(avatar).toHaveAttribute("aria-hidden", "true");
      await expect(subtitle(page)).toHaveText("9 anni · 4ª B, scuola Manzoni");
      await expect(backLink(page)).toBeVisible();
      await expect(pencil(page, "Mia")).toBeVisible();

      const nav = mainNav(page);
      await expect(nav).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Oggi", exact: true }),
      ).toHaveAttribute("aria-current", "true");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });
  });

  test("CA-8: a 1280 px navigazione alta senza voce attiva, niente «Indietro», bottone «Modifica il profilo» nella testa", async ({
    page,
    baseURL,
  }) => {
    only1280();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

      const nav = mainNav(page);
      await expect(nav).toBeVisible();
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
      await expect(backLink(page)).toHaveCount(0);
      await expect(h1(page)).toHaveCount(1);

      const button = pencil(page, "Mia");
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      await expect(button.locator(".btn__testo")).toHaveText(
        "Modifica il profilo",
      );
      await expect(button).toHaveAttribute("aria-haspopup", "dialog");
      await expect(
        page.locator(".profilo-testa").getByRole("button", {
          name: "Modifica il profilo di Mia",
          exact: true,
        }),
      ).toHaveCount(1);

      const heading = (await h1(page).boundingBox())!;
      const box = (await button.boundingBox())!;
      expect(box.x + 1).toBeGreaterThanOrEqual(heading.x + heading.width);
    });
  });

  for (const viewport of ["390", "1280"] as const) {
    test(`CA-9: i tre contatori (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await standardCase(ctx);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

        await expect(counters(page)).toHaveCount(3);
        const [first, second, third] = [0, 1, 2].map((i) =>
          counters(page).nth(i),
        );
        await expectCounter(first!, "3", "impegni questa settimana");
        await expectCounter(second!, "14", "giorni alla scadenza", {
          href: SCADENZE,
          dot: true,
        });
        await expect(counters(page).nth(1)).toHaveAccessibleName(D1_NAME);
        await expectCounter(third!, "55", "giorni al compleanno");
      });
    });

    test(`CA-10: «Questa settimana» con due righe link (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await standardCase(ctx);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

        const week = section(page, "Questa settimana");
        await expect(
          week.getByRole("link", { name: "Vedi nel calendario", exact: true }),
        ).toHaveAttribute("href", "/calendario");
        await expect(weekRows(page)).toHaveCount(2);
        const expected = [
          ["Gio", "Nuoto", "Giovedì alle 17:00, piscina comunale"],
          ["Sab", "Festa di Giulia", "Sabato alle 16:00, via Verdi 8"],
        ];
        for (const [index, [day, title, info]] of expected.entries()) {
          const row = weekRows(page).nth(index);
          await expect(row.getByRole("link")).toHaveCount(1);
          await expect(row.locator(".riga-lista__ora")).toHaveText(day!);
          await expect(row.locator(".riga-lista__titolo")).toHaveText(title!);
          await expect(row.locator(".riga-lista__info")).toHaveText(info!);
        }
        const text = await pageText(page);
        for (const absent of [
          "Pagella",
          "Calcetto",
          "Gita",
          "Prova del saggio",
        ]) {
          expect(text, absent).not.toContain(absent);
        }
      });
    });

    test(`CA-12: la sezione «Scuola» (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await standardCase(ctx);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

        const school = section(page, "Scuola");
        await expect(school.locator(".sezione__info")).toHaveText("4ª B");
        const rows = school.locator("li");
        await expect(rows).toHaveCount(3);

        const timetable = rows.nth(0);
        await expect(timetable.getByRole("link")).toHaveCount(0);
        await expect(timetable.locator(".riga-lista__titolo")).toHaveText(
          "8:15 – 16:15",
        );
        await expect(timetable.locator(".riga-lista__info")).toHaveText(
          "Dal lunedì al venerdì, mensa compresa",
        );

        const bianchi = rows.nth(1).getByRole("link");
        await expect(bianchi).toHaveAttribute("href", "tel:+390392345678");
        await expect(bianchi).toContainText("Maestra Bianchi");
        await expect(bianchi.locator(".riga-lista__info")).toHaveText(
          "Italiano e storia · 039 234 5678",
        );

        const rossi = rows.nth(2);
        await expect(rossi.getByRole("link")).toHaveCount(0);
        await expect(rossi.locator(".riga-lista__titolo")).toHaveText(
          "Maestro Rossi",
        );
        await expect(rossi.locator(".riga-lista__info")).toHaveCount(0);
      });
    });

    test(`CA-13: la sezione «Taglie» (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await standardCase(ctx);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

        const sizes = section(page, "Taglie");
        await expect(sizes.locator(".sezione__info")).toHaveText(
          "aggiornate a settembre",
        );
        await expect(sizes.locator(".chip")).toHaveText([
          "Scarpe 33",
          "Vestiti 9–10",
          "Pigiama 140",
        ]);
      });
    });

    test(`CA-14: niente Salute, pediatra, certificato, lista desideri; un solo link tel: (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await standardCase(ctx);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        await expect(section(page, "Taglie")).toBeVisible();

        expect(await pageText(page)).not.toMatch(
          /salute|ediatra|ertificato|medic|visibile solo ai genitori|lista desideri/i,
        );
        const phones = page.locator('a[href^="tel:"]');
        await expect(phones).toHaveCount(1);
        await expect(phones).toContainText("Maestra Bianchi");
      });
    });
  }

  test("CA-11: toccare la riga «Nuoto» porta al dettaglio dell'impegno", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const { events } = await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

      await weekRows(page)
        .filter({ hasText: "Nuoto" })
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/impegni/${events["E2"]}\\?giorno=2026-10-22$`),
      );
      await expect(
        page.getByRole("heading", { level: 1, name: "Nuoto" }),
      ).toBeVisible();
    });
  });

  test("CA-15: a 1280 px «Questa settimana» e «Scuola» a sinistra, «Taglie» a destra", async ({
    page,
    baseURL,
  }) => {
    only1280();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(section(page, "Taglie")).toBeVisible();

      const week = (await section(page, "Questa settimana").boundingBox())!;
      const school = (await section(page, "Scuola").boundingBox())!;
      const sizes = (await section(page, "Taglie").boundingBox())!;
      expect(sizes.x).toBeGreaterThanOrEqual(school.x + school.width);
      expect(sizes.x).toBeGreaterThanOrEqual(week.x + week.width);
      expect(week.x).toBeLessThan(sizes.x);
    });
  });

  test("CA-16: U2 vede anche «Occupato» e «Solo io» suoi; U non li riceve né nell'HTML né in rete", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);

      await openChild(page, baseURL, ctx, "Vera", ctx.mia, "Mia");
      await expect(counters(page)).toHaveCount(3);
      await expectCounter(
        counters(page).nth(0),
        "4",
        "impegni questa settimana",
      );
      await expectCounter(counters(page).nth(1), "5", "giorni alla scadenza", {
        href: SCADENZE,
        dot: true,
      });
      await expect(counters(page).nth(1)).toHaveAccessibleName(
        "5 giorni alla scadenza: «Comprare il regalo per Mia», urgente",
      );
      await expect(weekRows(page)).toHaveCount(3);
      const titles = weekRows(page).locator(".riga-lista__titolo");
      await expect(titles).toHaveText([
        "Prova del saggio",
        "Nuoto",
        "Festa di Giulia",
      ]);
      await expect(
        weekRows(page).nth(0).locator(".riga-lista__info"),
      ).toHaveText("Giovedì alle 10:00");

      await page.context().clearCookies();
      const responses = recordResponses(page);
      await ctx.nest.signIn(page, baseURL, "Ugo");
      await page.goto(childPath(ctx.mia));
      await expect(h1(page)).toHaveText("Mia");
      await expect(weekRows(page)).toHaveCount(2);
      const html = await htmlOf(page, childPath(ctx.mia));
      const seen = `${html}\n${await responses.text()}`;
      expect(seen).not.toContain("Prova del saggio");
      expect(seen).not.toContain("Comprare il regalo per Mia");
    });
  });
});

// -------------------------------------------------- regole di calcolo e varianti

test.describe("regole di calcolo e varianti", () => {
  test("CA-17: senza D1 il secondo contatore è «42 giorni alla scadenza», senza pallino", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await createEvents(ctx);
      await createDeadlines(ctx, ["D2", "D4"]);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

      await expectCounter(counters(page).nth(1), "42", "giorni alla scadenza", {
        href: SCADENZE,
      });
      await expect(counters(page).nth(1)).toHaveAccessibleName(
        `42 giorni alla scadenza: «${D2_TITLE}»`,
      );
    });
  });

  test("CA-18: scadute, di oggi e senza scadenze", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await createEvents(ctx);
      const ids = await createDeadlines(ctx, ["D1", "D2", "D3", "D4"]);
      const second = () => counters(page).nth(1);

      // D3 (15/10) is the oldest: it comes first, 5 days late.
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expectCounter(second(), "5", "giorni di ritardo", {
        href: SCADENZE,
        dot: true,
      });
      await expect(counters(page).nth(1)).toHaveAccessibleName(
        `5 giorni di ritardo: «${D3_TITLE}», urgente`,
      );

      // D3 moved to 19/10: one day late.
      await moveDeadline(ctx, ids["D3"]!, "2026-10-19");
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(second(), "1", "giorno di ritardo", {
        href: SCADENZE,
        dot: true,
      });

      // Without D3 and with D1 on 20/10: today.
      await removeDeadlines(ctx, [ids["D3"]!]);
      await moveDeadline(ctx, ids["D1"]!, "2026-10-20");
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(second(), "Oggi", "la scadenza", {
        href: SCADENZE,
        dot: true,
      });

      // No deadline at all.
      await removeDeadlines(ctx, [ids["D1"]!, ids["D2"]!, ids["D4"]!]);
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(second(), "—", "nessuna scadenza");
      await expect(second().locator(".contatore__numero")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });
  });

  test("CA-19: compleanno oggi, domani e senza data di nascita", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      const third = () => counters(page).nth(2);

      await setBirth(ctx.admin, ctx.mia, "2016-10-20");
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expectCounter(third(), "Oggi", "il compleanno");
      await expect(subtitle(page)).toHaveText("10 anni · 4ª B, scuola Manzoni");

      await setBirth(ctx.admin, ctx.mia, "2016-10-21");
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(third(), "1", "giorno al compleanno");

      await setBirth(ctx.admin, ctx.mia, null);
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(third(), "—", "manca la data di nascita");
      await expect(third().locator(".contatore__numero")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      await expect(subtitle(page)).toHaveText("4ª B, scuola Manzoni");
    });
  });

  test("CA-20: settimana libera e «Nessun altro impegno questa settimana.»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");

      await expectCounter(
        counters(page).nth(0),
        "0",
        "impegni questa settimana",
      );
      const week = section(page, "Questa settimana");
      await expect(week.getByText("Settimana libera, per ora")).toBeVisible();
      await expect(
        week.getByText(
          "Mia non ha impegni questa settimana. Aggiungi un impegno.",
        ),
      ).toBeVisible();
      await expect(
        week.getByRole("link", { name: "Aggiungi un impegno", exact: true }),
      ).toHaveAttribute("href", "/aggiungi");
      await expect(page.locator('a[href^="/impegni/"]')).toHaveCount(0);

      await createEvents(ctx, ["E1"]);
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expectCounter(
        counters(page).nth(0),
        "1",
        "impegno questa settimana",
      );
      await expect(
        section(page, "Questa settimana").getByText(
          "Nessun altro impegno questa settimana.",
        ),
      ).toBeVisible();
      await expect(page.locator('a[href^="/impegni/"]')).toHaveCount(0);
    });
  });

  test("CA-21: il testo dei giorni di scuola", async ({ page, baseURL }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const info = () =>
        section(page, "Scuola")
          .locator("li")
          .first()
          .locator(".riga-lista__info");

      const cases: [number[], string | null, string][] = [
        [
          [1, 3, 5],
          "mensa compresa",
          "Lunedì, mercoledì e venerdì, mensa compresa",
        ],
        [[6], "mensa compresa", "Il sabato, mensa compresa"],
        [[7], "mensa compresa", "La domenica, mensa compresa"],
        [
          [1, 2, 3, 4, 5, 6, 7],
          "mensa compresa",
          "Dal lunedì alla domenica, mensa compresa",
        ],
        [[2, 3, 4], "mensa compresa", "Dal martedì al giovedì, mensa compresa"],
        [[1, 2], "mensa compresa", "Lunedì e martedì, mensa compresa"],
        [
          [1, 2, 3, 4, 5, 6],
          "mensa compresa",
          "Dal lunedì al sabato, mensa compresa",
        ],
        [[1, 2, 3, 4, 5], null, "Dal lunedì al venerdì"],
      ];
      for (const [days, note, expected] of cases) {
        await setSchoolDays(ctx, ctx.mia, days, note);
        await page.reload();
        await expect(h1(page)).toHaveText("Mia");
        await expect(info(), expected).toHaveText(expected);
      }
    });
  });

  test("CA-22: solo la classe, oppure solo le taglie", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, { schoolClass: "4ª B" });
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(subtitle(page)).toHaveText("9 anni · 4ª B");
      const school = section(page, "Scuola");
      await expect(school.locator(".sezione__info")).toHaveText("4ª B");
      await expect(school.locator("li")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 2, name: "Taglie", exact: true }),
      ).toHaveCount(0);

      await writeProfile(ctx, ctx.mia, { shoe: "33" });
      await page.reload();
      await expect(h1(page)).toHaveText("Mia");
      await expect(subtitle(page)).toHaveText("9 anni");
      await expect(section(page, "Taglie")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Scuola", exact: true }),
      ).toHaveCount(0);
    });
  });

  test("CA-23: le taglie dell'anno scorso dicono anche l'anno", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, {
        ...FULL_MIA,
        sizesUpdatedAt: "2025-09-15T10:00:00Z",
      });
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(
        section(page, "Taglie").locator(".sezione__info"),
      ).toHaveText("aggiornate a settembre 2025");
    });
  });
});

// ------------------------------------------------------------- stato vuoto

test.describe("stato vuoto", () => {
  for (const viewport of ["390", "1280"] as const) {
    test(`CA-24: Nico senza dati: «Completa il profilo di Nico» e due bottoni (${viewport} px)`, async ({
      page,
      baseURL,
    }) => {
      test.skip(isMobile() !== (viewport === "390"), `Caso a ${viewport} px`);
      needsThrowaway();
      await withFigli(async (ctx) => {
        await openChild(page, baseURL, ctx, "Ugo", ctx.nico, "Nico");

        await expect(subtitle(page)).toHaveText("9 anni");
        await expect(
          page.getByText("Completa il profilo di Nico"),
        ).toBeVisible();
        await expect(
          page.getByText(
            "Scuola, maestre, taglie: quello che serve sapere quando qualcuno chiede «che numero porta?».",
          ),
        ).toBeVisible();
        await expect(page.getByRole("main").getByRole("button")).toHaveText([
          "Aggiungi la scuola",
          "Aggiungi le taglie",
        ]);

        const text = await pageText(page);
        for (const absent of [
          "pediatra",
          "giorni al compleanno",
          "Questa settimana",
        ]) {
          expect(text, absent).not.toContain(absent);
        }
        for (const title of ["Scuola", "Taglie"]) {
          await expect(
            page.getByRole("heading", { level: 2, name: title, exact: true }),
          ).toHaveCount(0);
        }
        if (viewport === "1280") {
          await expect(pencil(page, "Nico")).toHaveCount(0);
        }
      });
    });
  }

  test("CA-25: Nico con il solo impegno «Calcetto»: contatori, settimana e poi «Completa il profilo»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await createEvents(ctx, ["E4"]);
      await openChild(page, baseURL, ctx, "Ugo", ctx.nico, "Nico");

      await expect(counters(page)).toHaveCount(3);
      await expectCounter(
        counters(page).nth(0),
        "1",
        "impegno questa settimana",
      );
      const rows = weekRows(page);
      await expect(rows).toHaveCount(1);
      await expect(rows.first().locator(".riga-lista__titolo")).toHaveText(
        "Calcetto",
      );
      await expect(rows.first().locator(".riga-lista__info")).toHaveText(
        "Mercoledì alle 18:00",
      );
      const title = page.getByText("Completa il profilo di Nico");
      await expect(title).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Aggiungi la scuola", exact: true }),
      ).toBeVisible();
      const week = (await section(page, "Questa settimana").boundingBox())!;
      const empty = (await title.boundingBox())!;
      expect(empty.y).toBeGreaterThan(week.y + week.height - 1);
    });
  });
});

// ------------------------------------------------------ caricamento ed errore

test.describe("caricamento ed errore", () => {
  test("CA-27: lettura trattenuta: scheletri, nessun h1, matita inattiva; poi compare «Mia»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      const hold = await holdRequests(page, PROFILE_TABLE);
      await setClock(page, TODAY);
      await ctx.nest.signIn(page, baseURL, "Ugo");
      await page.goto(childPath(ctx.mia));

      const loading = page
        .locator('main [aria-busy="true"]')
        .filter({ hasText: "Caricamento in corso" });
      await expect(loading).toHaveCount(1);
      await expect(h1(page).filter({ hasText: "Mia" })).toHaveCount(0);
      if (isMobile()) {
        const bar = pencil(page, "Mia");
        await expect(bar).toBeVisible();
        await bar.click({ force: true });
        await expect(page.getByRole("dialog")).toHaveCount(0);
      } else {
        await expect(pencil(page, "Mia")).toHaveCount(0);
      }

      hold.release();
      await expect(h1(page)).toHaveText("Mia");
      await expect(loading).toHaveCount(0);
      if (isMobile()) {
        // The touch that came while loading did not leave an open sheet behind.
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
    });
  });

  test("CA-28: lettura in errore 500: pagina non caricata, nessuna matita, «Riprova» mostra «Mia»", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      await failRequests(page, PROFILE_TABLE);
      await setClock(page, TODAY);
      await ctx.nest.signIn(page, baseURL, "Ugo");
      await page.goto(childPath(ctx.mia));

      await expect(page.getByText(LOAD_ERROR)).toBeVisible();
      const retry = page.getByRole("button", { name: "Riprova", exact: true });
      await expect(retry).toBeVisible();
      await expect(pencil(page, "Mia")).toHaveCount(0);
      const text = await pageText(page);
      for (const absent of [
        "Questa settimana",
        "Scuola",
        "giorni al compleanno",
      ]) {
        expect(text, absent).not.toContain(absent);
      }

      await page.unroute(PROFILE_TABLE);
      await retry.click();
      await expect(h1(page)).toHaveText("Mia");
      await expect(page.getByText(LOAD_ERROR)).toHaveCount(0);
    });
  });
});

// ------------------------------------------------------------- accessibilità

test.describe("accessibilità (axe)", () => {
  test("CA-46: profilo completo di Mia, nessuna violazione serious o critical", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(section(page, "Taglie")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("CA-46: Nico nello stato vuoto, nessuna violazione serious o critical", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openChild(page, baseURL, ctx, "Ugo", ctx.nico, "Nico");
      await expect(page.getByText("Completa il profilo di Nico")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test("CA-46: caricamento trattenuto, nessuna violazione serious o critical", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await writeProfile(ctx, ctx.mia, FULL_MIA);
      const hold = await holdRequests(page, PROFILE_TABLE);
      await setClock(page, TODAY);
      await ctx.nest.signIn(page, baseURL, "Ugo");
      await page.goto(childPath(ctx.mia));
      await expect(
        page
          .locator('main [aria-busy="true"]')
          .filter({ hasText: "Caricamento in corso" }),
      ).toHaveCount(1);
      try {
        expect(await seriousViolations(page)).toEqual([]);
      } finally {
        hold.release();
      }
    });
  });

  test("CA-46: modulo di modifica aperto, nessuna violazione serious o critical", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await openSheet(page, "Mia");
      await waitForAnimationsToEnd(page);
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
});

// ----------------------------------------------------------------- privacy

test.describe("privacy", () => {
  test("Privacy: nelle risposte di rete non arriva la data di nascita di altri membri", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    // Adults have no birth date (database check): the other child and the pet do.
    const others = { Nico: "2020-04-02", Fido: "2019-03-03" };
    await withFigli(async (ctx) => {
      await standardCase(ctx);
      const responses = recordResponses(page);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(section(page, "Taglie")).toBeVisible();
      const seen = await responses.text();

      // The test is not empty: the date of the open child does arrive.
      expect(seen).toContain("2016-12-14");
      for (const [name, date] of Object.entries(others)) {
        expect(seen, `data di ${name}`).not.toContain(date);
      }
      expect(await htmlOf(page, childPath(ctx.mia))).not.toMatch(
        /2020-04-02|2019-03-03/,
      );
    }, others);
  });
});
