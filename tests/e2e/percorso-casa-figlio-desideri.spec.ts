import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  activeLinksOf,
  addDialog,
  birthIn,
  fillIdea,
  ideaRow,
  ideaRows,
  ideasOfNest,
  listPath,
  openAdd,
  reservationsOf,
  shareBlock,
  shareButton,
  submitIdea,
  toastWith,
  wishH1,
} from "../fixtures/desideri";
import {
  NOT_FOUND,
  field,
  h1,
  openSheet,
  pageText,
  readProfile,
  recordResponses,
  saveButton,
  section,
  setBirth,
  sheetOf,
  toastOf,
  withAltraCasa,
  withFigli,
} from "../fixtures/figlio";
import { contextLike } from "../fixtures/percorso-casa";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Percorso del figlio e della lista desideri (#307): dal Nest alle impostazioni
// della casa, dal profilo di Mia (scuola e taglie) alla sua lista desideri; si
// aggiunge un desiderio, si condivide il link pubblico, lo si apre da un
// browser anonimo (contesto senza sessione) e si prenota; il genitore vede
// l'effetto previsto dalla specifica (#32, #33): l'idea passa a «Già presi» con
// il nome di chi la regala, la riga del profilo dice «Condivisa · 1 già
// preso», nelle notifiche degli adulti compare «Nonna Rosa regala … a Mia.».
// Alla fine, un adulto di un'altra casa non raggiunge niente di tutto questo.
// L'orologio è quello vero: il link scade in base al compleanno (tra 10 giorni).

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const IDEA = "Monopattino rosso";
const OTHER_IDEA = "Libro di favole";
const GIVER = "Nonna Rosa";
const COPIED = "Link copiato. Mandalo a nonni e parenti.";
const CODE_PATH = /\/desideri\/([0-9a-f]{64})$/;

/** The visible rows (390 px) or cards (1280 px) of the public ideas. */
const cards = (page: Page): Locator =>
  page.locator("li.riga-regalo:visible, li.scheda-regalo:visible");
const publicRow = (page: Page, title: string): Locator =>
  cards(page).filter({ hasText: title });
const giveButton = (scope: Locator): Locator =>
  scope.getByRole("button", { name: "Lo regalo io", exact: true });

test.describe("percorso del figlio e della lista desideri", () => {
  test("percorso: dalle impostazioni al profilo di Mia, alla lista, al link pubblico prenotato da un anonimo; un'altra casa non raggiunge niente", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    await withFigli(async (ctx) => {
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await ctx.nest.signIn(page, baseURL, "Ugo");

      // ---- Dal Nest alle impostazioni della casa, e da lì al profilo di Mia
      await page.goto("/oggi");
      const nestLink = page.getByRole("link", { name: /^Apri Casa Prova/ });
      await expect(nestLink).toBeVisible({ timeout: 20_000 });
      await nestLink.click();
      await expect(page).toHaveURL(/\/nest$/);
      await expect(h1(page)).toHaveText("Casa Prova");
      await page
        .getByRole("main")
        .getByRole("link", { name: /^Impostazioni della casa/ })
        .click();
      await expect(page).toHaveURL(/\/impostazioni$/);
      await expect(h1(page)).toHaveText("Casa Prova");
      await page
        .getByRole("region", { name: "Chi c’è" })
        .getByRole("link", { name: /^Mia/ })
        .click();
      await expect(page).toHaveURL(new RegExp(`/figli/${ctx.mia}$`));
      await expect(h1(page)).toHaveText("Mia");

      // ---- Profilo vuoto: aggiungo la scuola, poi le taglie
      await expect(page.getByText("Completa il profilo di Mia")).toBeVisible();
      await page
        .getByRole("button", { name: "Aggiungi la scuola", exact: true })
        .click();
      const dialog = sheetOf(page, "Mia");
      await expect(dialog).toBeVisible();
      await expect(field(dialog, "Nome della scuola")).toBeFocused();
      await field(dialog, "Nome della scuola").fill("scuola Manzoni");
      await field(dialog, "Classe").fill("4ª B");
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(toastOf(page, "Modifiche salvate")).toBeVisible();
      await expect(
        section(page, "Scuola").locator(".sezione__info"),
      ).toHaveText("4ª B");
      await expect(page.getByText("Completa il profilo di Mia")).toHaveCount(0);

      const sheet = await openSheet(page, "Mia");
      await field(sheet, "Scarpe").fill("33");
      await saveButton(sheet).click();
      await expect(sheet).toBeHidden();
      await expect(section(page, "Taglie").locator(".chip")).toHaveText([
        "Scarpe 33",
      ]);
      const saved = await readProfile(ctx, ctx.mia);
      expect(saved.row?.school_name).toBe("scuola Manzoni");
      expect(saved.row?.school_class).toBe("4ª B");
      expect(saved.row?.shoe_size).toBe("33");

      // ---- Lista desideri: la riga del profilo porta alla lista, ancora vuota
      const wishlist = section(page, "Lista desideri");
      await expect(wishlist.locator(".sezione__info")).toHaveText(
        "Nessuna idea",
      );
      await expect(wishlist.getByRole("link")).toContainText(
        "Non ancora condivisa",
      );
      await wishlist.getByRole("link").click();
      await expect(page).toHaveURL(new RegExp(`${listPath(ctx.mia)}$`));
      await expect(h1(page)).toHaveText(wishH1("Mia"));

      // ---- Aggiungo due desideri
      for (const idea of [IDEA, OTHER_IDEA]) {
        const add = await openAdd(page);
        await fillIdea(add, { idea });
        await submitIdea(add).click();
        await expect(addDialog(page)).toBeHidden({ timeout: 30_000 });
        await expect(ideaRow(page, idea)).toHaveCount(1);
      }
      await expect(ideaRows(page, "Da regalare")).toHaveCount(2);
      expect((await ideasOfNest(ctx)).map((row) => row.title).sort()).toEqual([
        OTHER_IDEA,
        IDEA,
      ]);

      // ---- Condivido il link pubblico
      await expect(shareBlock(page)).toContainText("Non ancora condivisa");
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      await expect(shareBlock(page)).toContainText("Condivisa con un link");
      const address = await page.evaluate(() => navigator.clipboard.readText());
      const code = CODE_PATH.exec(address)?.[1];
      expect(code, address).toBeTruthy();
      const links = await activeLinksOf(ctx);
      expect(links.map((link) => link.code)).toEqual([code]);

      // ---- Un anonimo apre il link e prenota (contesto senza sessione)
      const visitorContext = await contextLike(browser, baseURL, page);
      const secondContext = await contextLike(browser, baseURL, page);
      try {
        expect(await visitorContext.cookies()).toEqual([]);
        const visitor = await visitorContext.newPage();
        const responses = recordResponses(visitor);
        await visitor.goto(address);
        await expect(h1(visitor)).toHaveText("Il compleanno di Mia");
        await expect(cards(visitor)).toHaveCount(2);
        await giveButton(publicRow(visitor, IDEA)).click();
        const give = visitor.getByRole("dialog", { name: IDEA, exact: true });
        await expect(give).toBeVisible();
        await give.getByLabel("Come ti chiami?", { exact: true }).fill(GIVER);
        await giveButton(give).click();
        await expect(give).toBeHidden();
        await expect(
          publicRow(visitor, IDEA).locator(".etichetta--scura"),
        ).toContainText("Lo regali tu");
        await expect(
          visitor
            .getByTestId("toast")
            .filter({ hasText: "Segnato a tuo nome." }),
        ).toBeVisible();
        expect(
          await reservationsOf(
            ctx,
            (await ideasOfNest(ctx)).find((r) => r.title === IDEA)!.id,
          ),
        ).toEqual([{ giver_name: GIVER }]);

        // La pagina pubblica non dice niente della casa.
        const seen = `${await pageText(visitor)}\n${await responses.text()}`;
        for (const secret of [
          "Casa Prova",
          "Manzoni",
          "4ª B",
          "Scarpe",
          "Ugo",
          "Vera",
          "Nico",
          "Fido",
        ]) {
          expect(seen, secret).not.toContain(secret);
        }

        // Un altro anonimo vede l'idea «Già preso», senza il nome.
        const second = await secondContext.newPage();
        const secondResponses = recordResponses(second);
        await second.goto(address);
        await expect(h1(second)).toHaveText("Il compleanno di Mia");
        await expect(publicRow(second, IDEA)).toContainText("Già preso");
        await expect(giveButton(publicRow(second, IDEA))).toHaveCount(0);
        await expect(giveButton(publicRow(second, OTHER_IDEA))).toBeVisible();
        const seenBySecond = `${await pageText(second)}\n${await secondResponses.text()}`;
        expect(seenBySecond).not.toContain(GIVER);
      } finally {
        await visitorContext.close();
        await secondContext.close();
      }

      // ---- Il genitore vede l'effetto: «Già presi», riga del profilo, notifica
      await page.goto(listPath(ctx.mia));
      await expect(h1(page)).toHaveText(wishH1("Mia"));
      await expect(ideaRows(page, "Già presi")).toHaveCount(1);
      await expect(ideaRows(page, "Già presi").first()).toContainText(IDEA);
      await expect(ideaRows(page, "Già presi").first()).toContainText(GIVER);
      await expect(ideaRows(page, "Da regalare")).toHaveCount(1);
      await expect(ideaRows(page, "Da regalare").first()).toContainText(
        OTHER_IDEA,
      );

      await page.goto(`/figli/${ctx.mia}`);
      await expect(h1(page)).toHaveText("Mia");
      await expect(
        section(page, "Lista desideri").getByRole("link"),
      ).toContainText("Condivisa · 1 già preso");

      const gift = (where: Page) =>
        where
          .locator("li.riga-notifica")
          .filter({ hasText: `${GIVER} regala ${IDEA} a Mia.` });
      await page.goto("/notifiche");
      await expect(
        page.getByRole("heading", { level: 1, name: "Notifiche" }),
      ).toBeVisible();
      await expect(gift(page)).toHaveCount(1);
      await expect(gift(page)).toHaveClass(/\bis-nuova\b/);

      // Anche l'altro adulto della casa trova la notifica.
      const veraContext = await contextLike(browser, baseURL, page);
      try {
        await ctx.nest.signInContext(veraContext, baseURL, "Vera");
        const vera = await veraContext.newPage();
        await vera.goto("/notifiche");
        await expect(
          vera.getByRole("heading", { level: 1, name: "Notifiche" }),
        ).toBeVisible();
        await expect(gift(vera)).toHaveCount(1);
      } finally {
        await veraContext.close();
      }

      // ---- Isolamento: un adulto di un'altra casa non raggiunge niente
      await withAltraCasa(async (altra) => {
        const vitoContext = await contextLike(browser, baseURL, page);
        try {
          await altra.nest.signInContext(vitoContext, baseURL, "Vito");
          const vito = await vitoContext.newPage();
          const vitoResponses = recordResponses(vito);
          for (const path of [`/figli/${ctx.mia}`, listPath(ctx.mia)]) {
            await vito.goto(path);
            await expect(h1(vito), path).toHaveText(NOT_FOUND);
          }
          await vito.goto("/notifiche");
          await expect(
            vito.getByRole("heading", { level: 1, name: "Notifiche" }),
          ).toBeVisible();
          await expect(vito.getByText(GIVER)).toHaveCount(0);
          const vitoSeen = `${await pageText(vito)}\n${await vitoResponses.text()}`;
          for (const secret of [
            GIVER,
            IDEA,
            OTHER_IDEA,
            "Manzoni",
            "Casa Prova",
          ]) {
            expect(vitoSeen, secret).not.toContain(secret);
          }
        } finally {
          await vitoContext.close();
        }

        const client = altra.nest.users["Vito"]!.client;
        for (const table of [
          "wishlists",
          "wishlist_items",
          "wishlist_share_links",
          "wishlist_reservations",
          "child_profiles",
        ]) {
          const read = await client.from(table).select("household_id");
          expect(read.error, table).toBeNull();
          expect(read.data ?? [], table).toEqual([]);
        }
        const notifications = await client
          .from("notifications")
          .select("household_id")
          .eq("household_id", ctx.householdId);
        expect(notifications.data ?? []).toEqual([]);
        const intruder = await client.rpc("add_wishlist_item", {
          p_member_id: ctx.mia,
          p_title: "Intrusa",
        });
        expect(intruder.error?.code).toBe("42501");
        expect((await ideasOfNest(ctx)).map((row) => row.title).sort()).toEqual(
          [OTHER_IDEA, IDEA],
        );
      });
    });
  });
});
