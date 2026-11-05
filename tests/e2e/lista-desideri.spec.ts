import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { romeInstant } from "../fixtures/casa";
import {
  IDEAS,
  LIST_TITLE,
  T_I1,
  T_I2,
  T_I3,
  T_I4,
  T_I5,
  addTrigger,
  anonClient,
  createList,
  disableButton,
  insertIdea,
  insertLink,
  ideasOfNest,
  mainAdd,
  nextDecember14,
  occasionRow,
  openList,
  seedList,
  shareBlock,
  shareButton,
  addDialog,
  field,
  ideaRows,
  listPath,
  wishH1,
} from "../fixtures/desideri";
import {
  LOAD_ERROR,
  NOT_FOUND,
  SOFIA,
  TODAY,
  h1,
  pageText,
  recordResponses,
  section,
  withAltraCasa,
  withFigli,
} from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Lista desideri" (#32, PR #279, /figli/<id>/lista-desideri): accesso e
// isolamento (CA-1 ... CA-7), contenuto dello stato normale (CA-8 ... CA-15) e
// stato vuoto (CA-16 ... CA-18). L'aggiunta e la modifica delle idee
// (CA-19 ... CA-33) sono in lista-desideri-aggiungi.spec.ts; la condivisione, la
// sezione nel profilo, la notifica, la durata dei dati e la privacy
// (CA-34 ... CA-53) in lista-desideri-condividi.spec.ts. Valgono i testi della
// specifica grafica dove i CA differiscono (decisione del coordinatore del
// 05/11). Utenti del seed A, B, C solo in lettura; ogni test che scrive usa i
// propri Nest usa e getta (U = Ugo, U2 = Vera, V = Vito), cancellati alla fine.
// Un criterio senza «anche 1280» vale a 390 px: a 1280 è saltato.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const only1280 = () => test.skip(isMobile(), "Criterio valido solo a 1280 px");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);
const needsSeed = (...keys: ("A" | "B" | "C")[]) =>
  test.skip(!usersConfigured(...keys), skipReason(...keys));

const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });
const backLink = (page: Page) =>
  page.getByRole("link", { name: "Indietro", exact: true });

/** The page the server sent, as the browser receives it (no scripts run). */
async function htmlOf(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  return response.text();
}

// ---------------------------------------------------- accesso e isolamento

test.describe("accesso e isolamento", () => {
  test("CA-1: senza sessione la lista porta a /accesso", async ({ page }) => {
    only390();
    await page.goto(listPath(SOFIA));
    await expect(page).toHaveURL(/\/accesso/);
  });

  test("CA-2: C, senza Nest, arriva a /onboarding", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsSeed("C");
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(listPath(SOFIA));
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("CA-3: B non vede la lista di Sofia: «Questa pagina non c’è» e nessun dato nell'HTML", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsSeed("A", "B");
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto(listPath(SOFIA));
    await expect(h1(page)).toHaveText(NOT_FOUND);
    const html = await htmlOf(page, listPath(SOFIA));
    expect(html).not.toMatch(/\bSofia\b/);
    expect(html).not.toMatch(/Casa D(?:'|&#x27;|’)Angelo/);
  });

  test("CA-4: animale, adulto (anche sé stessi), id non valido e id casuale: «Questa pagina non c’è», mai l'errore di caricamento", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await ctx.nest.signIn(page, baseURL, "Ugo");
      const paths = [
        listPath(ctx.fido),
        listPath(ctx.nest.members["Ugo"]!),
        "/figli/abc/lista-desideri",
        listPath("c7d2a4e0-5b1f-4c3a-9e8d-123456789abc"),
      ];
      for (const path of paths) {
        await page.goto(path);
        await expect(h1(page), path).toHaveText(NOT_FOUND);
        await expect(page.getByText(LOAD_ERROR), path).toHaveCount(0);
      }
    });
  });

  test("CA-5: V non vede la lista di Mia: «Questa pagina non c’è», né HTML né risposte di rete con i suoi dati", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await withAltraCasa(async (altra) => {
        const responses = recordResponses(page);
        await altra.nest.signIn(page, baseURL, "Vito");
        await page.goto(listPath(ctx.mia));
        await expect(h1(page)).toHaveText(NOT_FOUND);
        const html = await htmlOf(page, listPath(ctx.mia));
        const seen = `${html}\n${await responses.text()}`;
        expect(seen).not.toMatch(/\bMia\b/);
        expect(seen).not.toContain("Diario segreto");
        expect(seen).not.toContain("Nonna Anna");
        expect(await pageText(page)).not.toMatch(/\bMia\b/);
      });
    });
  });

  test("CA-6: V, con la propria sessione, non legge né scrive la lista di Mia", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      const link = await insertLink(ctx, wish.listId, {
        occasion: nextDecember14(),
      });
      await withAltraCasa(async (altra) => {
        const vito = altra.nest.users["Vito"]!.client;

        for (const table of [
          "wishlists",
          "wishlist_items",
          "wishlist_item_photos",
          "wishlist_share_links",
          "wishlist_reservations",
        ]) {
          const read = await vito.from(table).select("household_id");
          expect(read.data ?? [], table).toEqual([]);
        }

        const add = await vito.rpc("add_wishlist_item", {
          p_member_id: ctx.mia,
          p_title: "Intrusa",
        });
        expect(add.error?.code).toBe("42501");
        const share = await vito.rpc("share_wishlist", {
          p_member_id: ctx.mia,
        });
        expect(share.error?.code).toBe("42501");
        const disable = await vito.rpc("disable_wishlist_share_link", {
          p_member_id: ctx.mia,
        });
        expect(disable.error?.code).toBe("42501");
        const remove = await vito.rpc("delete_wishlist_item", {
          p_item_id: wish.ids.I1!,
        });
        expect(remove.error).not.toBeNull();

        const insert = await vito.from("wishlist_items").insert({
          household_id: ctx.householdId,
          wishlist_id: wish.listId,
          title: "Intrusa",
        });
        expect(insert.error).not.toBeNull();
        const direct = await vito
          .from("wishlist_items")
          .delete()
          .eq("id", wish.ids.I1!);
        expect(direct.error).not.toBeNull();
      });

      const items = await ideasOfNest(ctx);
      expect(items.map((item) => item.title).sort()).toEqual(
        Object.values(IDEAS)
          .map((idea) => idea.title)
          .sort(),
      );
      const { data: links } = await ctx.admin
        .from("wishlist_share_links")
        .select("id, disabled_at")
        .eq("id", link.id);
      expect(links).toEqual([{ id: link.id, disabled_at: null }]);
    });
  });

  test("CA-7: un client senza sessione non legge né scrive la lista", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      const link = await insertLink(ctx, wish.listId, {
        occasion: nextDecember14(),
      });
      const anon = anonClient();
      const seen: unknown[] = [];
      for (const table of [
        "wishlists",
        "wishlist_items",
        "wishlist_item_photos",
        "wishlist_share_links",
        "wishlist_reservations",
      ]) {
        const read = await anon.from(table).select("household_id");
        seen.push(read.data, read.error?.message);
        expect(read.data ?? [], table).toEqual([]);
      }
      const insert = await anon.from("wishlist_reservations").insert({
        household_id: ctx.householdId,
        item_id: wish.ids.I1,
        share_link_id: link.id,
        giver_name: "Intrusa",
      });
      expect(insert.error).not.toBeNull();
      const text = JSON.stringify(seen);
      expect(text).not.toContain("Diario segreto");
      expect(text).not.toContain("Nonna Anna");
      expect(text).not.toContain(link.code);
      const { data: reservations } = await ctx.admin
        .from("wishlist_reservations")
        .select("giver_name")
        .eq("household_id", ctx.householdId);
      expect((reservations ?? []).length).toBe(2);
    });
  });
});

// ------------------------------------------------------- contenuto (normale)

test.describe("contenuto dello stato normale", () => {
  test("CA-8: titolo, h1, avatar, barra e navigazione a 390 px", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      await expect(page).toHaveTitle(LIST_TITLE);
      await expect(h1(page)).toHaveCount(1);
      await expect(h1(page)).toHaveText(wishH1("Mia"));
      const avatar = page.locator("main .avatar--l");
      await expect(avatar).toHaveText("M");
      await expect(avatar).toHaveClass(/\bmembro-salvia\b/);
      await expect(backLink(page)).toBeVisible();
      const add = addTrigger(page);
      await expect(add).toBeVisible();
      await expect(add).toHaveAttribute("aria-haspopup", "dialog");

      const nav = mainNav(page);
      await expect(
        nav.getByRole("link", { name: "Oggi", exact: true }),
      ).toHaveAttribute("aria-current", "true");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });
  });

  test("CA-9: la riga del compleanno ha 55 giorni e non è cliccabile (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      const row = occasionRow(page);
      await expect(row).toContainText("55");
      await expect(row).toContainText("giorni");
      await expect(row).toContainText("Compleanno");
      await expect(row).toContainText("14 dicembre, compie 10 anni");
      await expect(row.locator("a, button")).toHaveCount(0);
      const tag = await row.evaluate((element) => element.tagName);
      expect(tag).not.toBe("A");
      expect(tag).not.toBe("BUTTON");
    });
  });

  test("CA-10: «Da regalare» ha 3 idee, dalla più recente, con negozio, nota e prezzo (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      const free = section(page, "Da regalare");
      await expect(free.locator(".sezione__info")).toHaveText(/^3\b/);
      const rows = ideaRows(page, "Da regalare");
      await expect(rows).toHaveCount(3);

      await expect(rows.nth(0).locator(".riga-regalo__titolo")).toHaveText(
        T_I3,
      );
      await expect(rows.nth(0).locator(".riga-lista__info")).toHaveText(
        "Un'esperienza da fare con la nonna",
      );
      await expect(rows.nth(0).locator(".riga-regalo__prezzo")).toHaveCount(0);

      await expect(rows.nth(1).locator(".riga-regalo__titolo")).toHaveText(
        T_I2,
      );
      await expect(rows.nth(1).locator(".riga-lista__info")).toHaveText(
        "Amazon",
      );
      await expect(rows.nth(1).locator(".riga-regalo__prezzo")).toHaveText(
        "24,90 €",
      );

      await expect(rows.nth(2).locator(".riga-regalo__titolo")).toHaveText(
        T_I1,
      );
      await expect(rows.nth(2).locator(".riga-lista__info")).toHaveText(
        "Feltrinelli · lo vuole tanto",
      );
      await expect(rows.nth(2).locator(".riga-regalo__prezzo")).toHaveText(
        "18 €",
      );
    });
  });

  test("CA-11: «Già presi» ha 2 idee con il nome di chi regala (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      const taken = section(page, "Già presi");
      await expect(taken.locator(".sezione__info")).toContainText(
        "Mia non lo sa",
      );
      await expect(taken.locator(".sezione__info")).toHaveText(/^2\b/);
      const rows = ideaRows(page, "Già presi");
      await expect(rows).toHaveCount(2);

      await expect(rows.nth(0).locator(".riga-regalo__titolo")).toHaveText(
        T_I5,
      );
      await expect(rows.nth(0).locator(".etichetta")).toContainText(
        "Zia Carla",
      );
      await expect(rows.nth(0).locator(".riga-regalo__prezzo")).toHaveText(
        "22 €",
      );

      await expect(rows.nth(1).locator(".riga-regalo__titolo")).toHaveText(
        T_I4,
      );
      await expect(rows.nth(1).locator(".etichetta")).toContainText(
        "Nonna Anna",
      );
      await expect(rows.nth(1).locator(".riga-regalo__prezzo")).toHaveText(
        "35 €",
      );
    });
  });

  test("CA-12: a 1280 px navigazione in alto senza voce attiva, niente «Indietro», un solo bottone «Aggiungi un'idea» nella testa", async ({
    page,
    baseURL,
  }) => {
    only1280();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      const nav = mainNav(page);
      await expect(nav).toBeVisible();
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
      await expect(backLink(page)).toHaveCount(0);
      await expect(h1(page)).toHaveCount(1);
      const add = page.getByRole("button", {
        name: "Aggiungi un'idea",
        exact: true,
      });
      await expect(add).toHaveCount(1);
      await expect(add).toBeVisible();
      await expect(add).toHaveAttribute("aria-haspopup", "dialog");
      await expect(
        page.locator(".profilo-testa").getByRole("button", {
          name: "Aggiungi un'idea",
          exact: true,
        }),
      ).toHaveCount(1);
    });
  });

  test("CA-13: U2, non amministratrice, vede le stesse righe con i nomi", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Vera", ctx.mia, "Mia", {
        clock: TODAY,
      });
      await expect(ideaRows(page, "Da regalare")).toHaveCount(3);
      await expect(ideaRows(page, "Già presi")).toHaveCount(2);
      await expect(section(page, "Già presi")).toContainText("Nonna Anna");
      await expect(section(page, "Già presi")).toContainText("Zia Carla");
    });
  });

  test("CA-14: Nico senza data di nascita: «Manca la data di nascita», nessun numero e nessun «Condividi»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(
      async (ctx) => {
        const list = await createList(ctx, ctx.nico);
        await insertIdea(ctx, list, { title: "Monopattino" });
        await openList(page, baseURL, ctx, "Ugo", ctx.nico, "Nico", {
          clock: TODAY,
        });
        const row = occasionRow(page);
        await expect(row).toContainText("Compleanno");
        await expect(row).toContainText("Manca la data di nascita");
        await expect(row.locator(".riga-scadenza__unita")).toHaveCount(0);
        expect(await row.innerText()).not.toMatch(/\d/);
        await expect(shareBlock(page)).toContainText(
          "Per condividere serve la data del compleanno.",
        );
        await expect(shareButton(page)).toHaveCount(0);
      },
      { Nico: "" },
    );
  });

  test("CA-15: il giorno del compleanno dice «Oggi», il giorno prima «1 giorno»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: romeInstant("2026-12-14", 10, 0),
      });
      await expect(occasionRow(page)).toContainText("Oggi");
      await expect(occasionRow(page)).toContainText("Oggi, compie 10 anni");

      const before = await page.context().newPage();
      await before.clock.install({ time: romeInstant("2026-12-13", 10, 0) });
      await before.goto(listPath(ctx.mia));
      await expect(h1(before)).toHaveText(wishH1("Mia"));
      const row = before.locator(".riga-scadenza");
      await expect(row.locator(".riga-scadenza__numero")).toHaveText("1");
      await expect(row.locator(".riga-scadenza__unita")).toHaveText("giorno");
    });
  });
});

// ------------------------------------------------------------- stato vuoto

test.describe("stato vuoto", () => {
  test("CA-16: senza idee e senza link: titolo, testo, bottone e nessuna sezione (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      await expect(occasionRow(page)).toContainText("55");
      await expect(page.getByText("Ancora nessuna idea")).toBeVisible();
      await expect(
        page.getByText(
          "Incolla il link di un negozio o scrivi un'idea: i nonni la vedranno nella pagina condivisa.",
        ),
      ).toBeVisible();
      await expect(mainAdd(page)).toHaveCount(1);
      await expect(mainAdd(page)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Condividi", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Da regalare", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Già presi", exact: true }),
      ).toHaveCount(0);
      if (!isMobile()) {
        await expect(
          page.getByRole("button", { name: "Aggiungi un'idea", exact: true }),
        ).toHaveCount(1);
      }
    });
  });

  test("CA-17: «Aggiungi un'idea» dello stato vuoto apre la finestra con il fuoco su «Link del negozio»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia", {
        clock: TODAY,
      });
      await mainAdd(page).click();
      const dialog = addDialog(page);
      await expect(dialog).toBeVisible();
      await expect(field(dialog, "Link del negozio")).toBeFocused();
    });
  });

  test("CA-18: senza idee ma con un link attivo c'è lo stato vuoto e, sopra, il blocco con «Disattiva il link»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const list = await createList(ctx, ctx.mia);
      await insertLink(ctx, list, { occasion: nextDecember14() });
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await expect(page.getByText("Ancora nessuna idea")).toBeVisible();
      await expect(disableButton(page)).toBeVisible();
      const blockBox = await shareBlock(page).boundingBox();
      const emptyBox = await page.locator(".stato-vuoto").boundingBox();
      expect(blockBox).not.toBeNull();
      expect(emptyBox).not.toBeNull();
      expect(blockBox!.y).toBeLessThan(emptyBox!.y);
    });
  });
});
