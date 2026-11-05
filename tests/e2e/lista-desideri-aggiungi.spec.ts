import { expect, test, type Page } from "@playwright/test";
import {
  SHOP_ORIGIN,
  T_I1,
  T_I4,
  UNREADABLE_LINK,
  abortServerActions,
  addDialog,
  addTrigger,
  confirmDialog,
  createList,
  editDialog,
  field,
  fillIdea,
  ideaRow,
  ideaRows,
  ideasOfNest,
  insertIdea,
  openAdd,
  openIdea,
  openList,
  reservationsOf,
  seedList,
  startCounter,
  startShop,
  submitIdea,
  toastWith,
} from "../fixtures/desideri";
import { section, withFigli } from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Lista desideri" (#32, PR #279), aggiungere un'idea (CA-19 ... CA-30) e
// modificarla o eliminarla (CA-31 ... CA-33). Valgono i testi della specifica
// grafica dove i CA differiscono (decisione del coordinatore del 05/11: CA-23,
// CA-25, CA-29, CA-32, CA-33). L'origine di prova dei negozi
// (SHOP_LINK_TEST_ORIGIN) non è impostata dai workflow: dove serve, il test è
// saltato con il motivo scritto e c'è l'aggiunta a mano (idea scritta più link
// che non si può leggere). Un criterio senza «anche 1280» vale a 390 px.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const only1280 = () => test.skip(isMobile(), "Criterio valido solo a 1280 px");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);
const needsShop = () =>
  test.skip(
    !SHOP_ORIGIN,
    "SHOP_LINK_TEST_ORIGIN non è impostata dal workflow: l'aggiunta da link si prova a mano (idea scritta più link)",
  );

const EMPTY_ERROR = "Incolla il link di un negozio o scrivi l'idea qui sotto.";
const LINK_ERROR =
  "Questo non sembra un link. Copialo di nuovo dalla pagina del negozio.";
const UNREADABLE_ERROR =
  "Non riusciamo a leggere la pagina del negozio. Scrivi qui il nome dell'idea: la aggiungiamo con il link.";
const NETWORK_ERROR =
  "Non siamo riusciti a salvare. Controlla la connessione e riprova.";

// ------------------------------------------------------------------ aggiungere

test.describe("aggiungere un'idea", () => {
  test("CA-19: il foglio ha nome, campi vuoti senza «name», suggerimento, segnaposto e fuoco sul link (a 1280 anche «Annulla»)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await addTrigger(page).click();
      const dialog = addDialog(page);
      await expect(dialog).toBeVisible();

      await expect(
        dialog.getByRole("heading", { level: 2, name: "Aggiungi un'idea" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Chiudi", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByText("Prendiamo noi nome, foto e prezzo."),
      ).toHaveCount(0);

      const link = field(dialog, "Link del negozio");
      const idea = field(dialog, "Oppure scrivi l'idea");
      const note = field(dialog, "Nota per chi regala");
      for (const input of [link, idea, note]) {
        await expect(input).toHaveValue("");
        expect(await input.getAttribute("name")).toBeNull();
      }
      await expect(idea).toHaveAttribute(
        "placeholder",
        "Es. corso di pattinaggio",
      );
      await expect(link).toBeFocused();
      await expect(submitIdea(dialog)).toBeVisible();
      if (!isMobile()) {
        await expect(
          dialog.getByRole("button", { name: "Annulla", exact: true }),
        ).toBeVisible();
      }
    });
  });

  test("CA-20: da link del negozio di prova: nome, negozio, prezzo e foto copiata (con l'origine di prova)", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    needsShop();
    const shop = await startShop();
    try {
      await withFigli(async (ctx) => {
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const dialog = await openAdd(page);
        await fillIdea(dialog, {
          link: `${SHOP_ORIGIN}/diario`,
          note: "Lo vuole tanto",
        });
        await submitIdea(dialog).click();
        await expect(dialog).toBeHidden();

        const first = ideaRows(page, "Da regalare").first();
        await expect(first.locator(".riga-regalo__titolo")).toHaveText(T_I1);
        await expect(first.locator(".riga-lista__info")).toHaveText(
          "Feltrinelli · lo vuole tanto",
        );
        await expect(first.locator(".riga-regalo__prezzo")).toHaveText("18 €");
        const saved = await ideasOfNest(ctx);
        const { data: photoRows } = await ctx.admin
          .from("wishlist_item_photos")
          .select("content_type")
          .eq("item_id", saved[0]!.id);
        expect(photoRows, "foto copiata nel database").toHaveLength(1);
        const image = first.locator("img.foto__immagine");
        await expect(image).toHaveCount(1);
        expect(await image.getAttribute("src")).not.toContain(
          new URL(SHOP_ORIGIN!).host,
        );
        const rows = await ideasOfNest(ctx);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.url).toBe(`${SHOP_ORIGIN}/diario`);
        expect(rows[0]!.price_cents).toBe(1800);
      });
    } finally {
      shop.close();
    }
  });

  test("CA-20 (aggiunta a mano): idea scritta con il suo link e la nota: prima riga di «Da regalare», link salvato", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(60_000);
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, {
        link: "https://negozio.example/diario",
        idea: T_I1,
        note: "Lo vuole tanto",
      });
      await submitIdea(dialog).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });

      const first = ideaRows(page, "Da regalare").first();
      await expect(first.locator(".riga-regalo__titolo")).toHaveText(T_I1);
      await expect(first.locator(".riga-lista__info")).toHaveText(
        "Lo vuole tanto",
      );
      const rows = await ideasOfNest(ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.url).toBe("https://negozio.example/diario");
      expect(rows[0]!.note).toBe("Lo vuole tanto");
    });
  });

  test("CA-21: solo l'idea scritta: riga senza prezzo, senza riga sotto e con l'icona al posto della foto", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await submitIdea(dialog).click();
      await expect(dialog).toBeHidden();

      const row = ideaRow(page, "Corso di pattinaggio");
      await expect(row).toHaveCount(1);
      await expect(row.locator(".riga-regalo__prezzo")).toHaveCount(0);
      await expect(row.locator(".riga-lista__info")).toHaveCount(0);
      await expect(row.locator("img")).toHaveCount(0);
      await expect(row.locator(".foto svg")).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "Da regalare", exact: true }),
      ).toBeVisible();
    });
  });

  test("CA-22: link e idea scritti: vale il nome scritto, con negozio e prezzo del link (con l'origine di prova)", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    needsShop();
    const shop = await startShop();
    try {
      await withFigli(async (ctx) => {
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const dialog = await openAdd(page);
        await fillIdea(dialog, {
          link: `${SHOP_ORIGIN}/diario`,
          idea: "Diario per Mia",
        });
        await submitIdea(dialog).click();
        await expect(dialog).toBeHidden();
        const row = ideaRow(page, "Diario per Mia");
        await expect(row.locator(".riga-lista__info")).toHaveText(
          "Feltrinelli",
        );
        await expect(row.locator(".riga-regalo__prezzo")).toHaveText("18 €");
      });
    } finally {
      shop.close();
    }
  });

  test("CA-23: a campi vuoti compare «Incolla il link di un negozio o scrivi l'idea qui sotto.», il fuoco è sul link e non è salvato nulla", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await submitIdea(dialog).click();
      await expect(dialog.getByText(EMPTY_ERROR)).toBeVisible();
      await expect(field(dialog, "Link del negozio")).toBeFocused();
      await expect(dialog).toBeVisible();
      expect(await ideasOfNest(ctx)).toEqual([]);
    });
  });

  test("CA-24: «ciao» come link: «Questo non sembra un link…» e nulla di salvato", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, { link: "ciao" });
      await submitIdea(dialog).click();
      await expect(dialog.getByText(LINK_ERROR)).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await ideasOfNest(ctx)).toEqual([]);
    });
  });

  test("CA-25: link che non si legge: errore sull'idea, il link resta scritto, nulla salvato; poi con «Diario» si salva con il link", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(90_000);
    const link = SHOP_ORIGIN ? `${SHOP_ORIGIN}/vuota` : UNREADABLE_LINK;
    const shop = SHOP_ORIGIN ? await startShop() : null;
    try {
      await withFigli(async (ctx) => {
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const dialog = await openAdd(page);
        await fillIdea(dialog, { link });
        await submitIdea(dialog).click();
        await expect(dialog.getByText(UNREADABLE_ERROR)).toBeVisible({
          timeout: 30_000,
        });
        await expect(field(dialog, "Oppure scrivi l'idea")).toBeFocused();
        await expect(field(dialog, "Link del negozio")).toHaveValue(link);
        expect(await ideasOfNest(ctx)).toEqual([]);

        await fillIdea(dialog, { idea: "Diario" });
        await submitIdea(dialog).click();
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        const row = ideaRow(page, "Diario");
        await expect(row.locator(".riga-regalo__prezzo")).toHaveCount(0);
        const rows = await ideasOfNest(ctx);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.title).toBe("Diario");
        expect(rows[0]!.url).toBe(link);
      });
    } finally {
      shop?.close();
    }
  });

  test("CA-26: indirizzi interni o vietati danno lo stesso messaggio e il server di prova non riceve richieste", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(120_000);
    const counter = await startCounter();
    try {
      await withFigli(async (ctx) => {
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const dialog = await openAdd(page);
        const links = [
          `http://127.0.0.1:${counter.port}/x`,
          `http://localhost:${counter.port}/x`,
          `http://[::1]:${counter.port}/x`,
          "http://169.254.169.254/latest/meta-data/",
          "http://10.0.0.1/",
        ];
        for (const link of links) {
          await field(dialog, "Link del negozio").fill(link);
          await submitIdea(dialog).click();
          await expect(dialog.getByText(UNREADABLE_ERROR), link).toBeVisible({
            timeout: 30_000,
          });
          expect(await ideasOfNest(ctx), link).toEqual([]);
        }
        expect(counter.count()).toBe(0);
      });
    } finally {
      await counter.close();
    }
  });

  test("CA-27: con 50 idee compare «Puoi aggiungere fino a 50 idee.» e le idee restano 50", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(90_000);
    await withFigli(async (ctx) => {
      const list = await createList(ctx, ctx.mia);
      await Promise.all(
        Array.from({ length: 50 }, (_, index) =>
          insertIdea(ctx, list, { title: `Idea numero ${index + 1}` }),
        ),
      );
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await submitIdea(dialog).click();
      await expect(
        dialog.getByText("Puoi aggiungere fino a 50 idee."),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(await ideasOfNest(ctx)).toHaveLength(50);
    });
  });

  test("CA-28: salvataggio fallito per rete: avviso, foglio aperto con il testo scritto e nulla salvato", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await abortServerActions(page, /\/figli\/[^/]+\/lista-desideri/);
      await submitIdea(dialog).click();
      await expect(dialog.getByText(NETWORK_ERROR)).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(field(dialog, "Oppure scrivi l'idea")).toHaveValue(
        "Corso di pattinaggio",
      );
      expect(await ideasOfNest(ctx)).toEqual([]);
    });
  });

  test("CA-29: due tocchi di seguito su «Aggiungi alla lista» salvano una sola idea", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await submitIdea(dialog).click({ clickCount: 2 });
      await expect(dialog).toBeHidden();
      await expect(ideaRow(page, "Corso di pattinaggio")).toHaveCount(1);
      const rows = await ideasOfNest(ctx);
      expect(rows.map((row) => row.title)).toEqual(["Corso di pattinaggio"]);
    });
  });

  test("CA-30: a 1280 px «Annulla» ed Esc chiudono senza salvare e la riapertura parte da campi vuoti", async ({
    page,
    baseURL,
  }) => {
    only1280();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      let dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await dialog
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      await expect(dialog).toBeHidden();
      expect(await ideasOfNest(ctx)).toEqual([]);

      dialog = await openAdd(page);
      await expect(field(dialog, "Oppure scrivi l'idea")).toHaveValue("");
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      expect(await ideasOfNest(ctx)).toEqual([]);

      dialog = await openAdd(page);
      await expect(field(dialog, "Oppure scrivi l'idea")).toHaveValue("");
    });
  });
});

// ---------------------------------------------------------- modificare/eliminare

async function openNotifications(page: Page) {
  await page.goto("/notifiche");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notifiche" }),
  ).toBeVisible();
}

test.describe("modificare ed eliminare un'idea", () => {
  test("CA-31: cambiare la nota chiude il foglio, aggiorna la riga e mostra «Modifiche salvate»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openIdea(page, T_I1);
      await field(dialog, "Nota per chi regala").fill("Quello blu");
      await dialog
        .getByRole("button", { name: "Salva le modifiche", exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await expect(ideaRow(page, T_I1).locator(".riga-lista__info")).toHaveText(
        "Feltrinelli · quello blu",
      );
      await expect(toastWith(page, "Modifiche salvate")).toBeVisible();
    });
  });

  test("CA-32: «Elimina l'idea» e conferma tolgono la riga, l'idea e la sua foto", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openIdea(page, T_I1);
      await dialog
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      const confirm = confirmDialog(page, `Eliminare «${T_I1}»?`);
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText(
        "Sparisce anche dalla pagina condivisa.",
      );
      await confirm
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      await expect(confirm).toBeHidden();
      await expect(ideaRow(page, T_I1)).toHaveCount(0);
      await expect(
        section(page, "Da regalare").locator(".sezione__info"),
      ).toHaveText(/^2\b/);

      const rows = await ideasOfNest(ctx);
      expect(rows.map((row) => row.id)).not.toContain(wish.ids.I1);
      const { data: photos } = await ctx.admin
        .from("wishlist_item_photos")
        .select("item_id")
        .eq("item_id", wish.ids.I1!);
      expect(photos ?? []).toEqual([]);
    });
  });

  test("CA-33: eliminare un'idea presa dice chi l'aveva presa e toglie prenotazione e notifica", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(60_000);
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      // La notifica di «Nonna Anna» c'è, prima di eliminare.
      await ctx.nest.signIn(page, baseURL, "Ugo");
      await openNotifications(page);
      const notice = page
        .locator("li.riga-notifica")
        .filter({ hasText: `Nonna Anna regala ${T_I4} a Mia.` });
      await expect(notice).toHaveCount(1);

      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openIdea(page, T_I4);
      await dialog
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      const confirm = confirmDialog(page, `Eliminare «${T_I4}»?`);
      await expect(confirm).toContainText(
        "Sparisce anche dalla pagina condivisa. Nonna Anna aveva detto che la regalava.",
      );
      await confirm
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      await expect(confirm).toBeHidden();
      await expect(ideaRow(page, T_I4)).toHaveCount(0);
      expect(await reservationsOf(ctx, wish.ids.I4!)).toEqual([]);

      await openNotifications(page);
      await expect(
        page.locator("li.riga-notifica").filter({ hasText: "Zia Carla" }),
      ).toHaveCount(1);
      await expect(
        page.locator("li.riga-notifica").filter({ hasText: "Nonna Anna" }),
      ).toHaveCount(0);
    });
  });

  test("CA-31 (titolo vuoto): «Scrivi il nome dell'idea per salvarla.» e nulla cambia", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openIdea(page, T_I1);
      await field(dialog, "Nome dell'idea").fill("");
      await dialog
        .getByRole("button", { name: "Salva le modifiche", exact: true })
        .click();
      await expect(
        dialog.getByText("Scrivi il nome dell'idea per salvarla."),
      ).toBeVisible();
      await expect(editDialog(page)).toBeVisible();
      const rows = await ideasOfNest(ctx);
      expect(rows.map((row) => row.title)).toContain(T_I1);
    });
  });
});
