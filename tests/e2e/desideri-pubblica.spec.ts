import { randomBytes } from "node:crypto";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { waitForAnimationsToEnd } from "../fixtures/animations";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import { addDays, romeDay } from "../fixtures/casa";
import {
  LIST_TITLE,
  NOT_ACTIVE,
  NOT_ACTIVE_TEXT,
  RPC_ANY,
  RPC_READ_PUBLIC,
  RPC_RESERVE,
  T_I1,
  T_I2,
  T_I3,
  T_I4,
  T_I5,
  abortRequests,
  activeLink,
  anonClient,
  createList,
  escapeRegExp,
  insertIdea,
  insertLink,
  insertReservation,
  nextDecember14,
  publicPath,
  randomKey,
  readPublic,
  recordRequests,
  reservationCount,
  reservationsOf,
  reservePublic,
  seedList,
  type LinkRow,
  type WishCtx,
} from "../fixtures/desideri";
import {
  NOT_FOUND,
  dataPartOfUrl,
  h1,
  pageText,
  recordResponses,
  withAltraCasa,
  withFigli,
  writeProfile,
} from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Lista desideri · Pagina pubblica" (#33, PR #279, /desideri/<codice>): un test
// o più per ogni criterio CA-1 ... CA-34. Chi apre è un «visitatore»: contesto
// del browser senza sessione e con localStorage vuoto. Valgono i testi della
// specifica grafica dove i CA differiscono (decisione del coordinatore del
// 05/11: CA-9, CA-11, CA-15, CA-22, CA-29) e la frase neutra scelta da Francesco
// al posto di «le idee che le piacerebbero». Ogni test costruisce i propri Nest
// usa e getta (Casa Prova di Ugo, Casa Altra di Vito con Nina), cancellati alla
// fine. Un criterio senza «anche 1280» vale a 390 px.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const only1280 = () => test.skip(isMobile(), "Criterio valido solo a 1280 px");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);
const needsSeed = (...keys: ("A" | "B" | "C")[]) =>
  test.skip(!usersConfigured(...keys), skipReason(...keys));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const NAME_ERROR = "Scrivi il tuo nome, così i genitori sanno chi lo regala.";
const TAKEN_ALERT = "Qualcun altro l'ha appena preso. Scegli un'altra idea.";
const NETWORK_ALERT =
  "Non siamo riusciti a segnarlo. Controlla la connessione e riprova.";
const RATE_ALERT =
  "Hai segnato molti regali in poco tempo. Riprova tra qualche minuto.";
const LOAD_FAILED = "Questa pagina non si è caricata";

// ------------------------------------------------------------------- helpers

type PubCtx = WishCtx & {
  /** K: the active link of the list of Mia (occasion 14 December) */
  link: LinkRow;
  /** The idea «Monopattino» of the list of Nico (same Nest) */
  monopattino: string;
};

/**
 * The data of the criteria: Casa Prova (Ugo, Vera, Mia with sizes and school,
 * Nico with «Monopattino», Fido), the list of Mia with I1 ... I5 (or empty) and
 * K, an active link of that list.
 */
async function withPublic(
  body: (ctx: PubCtx) => Promise<void>,
  options: { empty?: boolean } = {},
) {
  await withFigli(async (figli) => {
    await writeProfile(figli, figli.mia, {
      schoolName: "scuola Manzoni",
      shoe: "33",
    });
    const nicoList = await createList(figli, figli.nico);
    const monopattino = await insertIdea(figli, nicoList, {
      title: "Monopattino",
    });
    let wish: WishCtx;
    if (options.empty) {
      wish = {
        ...figli,
        listId: await createList(figli, figli.mia),
        ids: {},
        closedLinkId: null,
        occasionDay: addDays(romeDay(), 10),
      };
    } else {
      wish = await seedList(figli);
    }
    const link = await activeLink(wish);
    await body({ ...wish, link, monopattino });
  });
}

/** Opens the public page and waits for the name of the child. */
async function openPublic(page: Page, code: string, name = "Mia") {
  await page.goto(publicPath(code));
  await expect(h1(page)).toHaveText(`Il compleanno di ${name}`);
}

/** The visible rows (mobile) or cards (desktop) of the ideas. */
const cards = (page: Page): Locator =>
  page.locator("li.riga-regalo:visible, li.scheda-regalo:visible");
const rowOf = (page: Page, title: string): Locator =>
  cards(page).filter({ hasText: title });
const titles = (page: Page): Locator =>
  page.locator(
    "li.riga-regalo:visible .riga-regalo__titolo, li.scheda-regalo:visible .riga-regalo__titolo",
  );
const giveButton = (scope: Locator): Locator =>
  scope.getByRole("button", { name: "Lo regalo io", exact: true });
const giveDialog = (page: Page, title: string): Locator =>
  page.getByRole("dialog", { name: title, exact: true });
const nameField = (dialog: Locator): Locator =>
  dialog.getByLabel("Come ti chiami?", { exact: true });
const toast = (page: Page): Locator => page.getByTestId("toast");

async function openGive(page: Page, title: string): Promise<Locator> {
  await giveButton(rowOf(page, title)).click();
  const dialog = giveDialog(page, title);
  await expect(dialog).toBeVisible();
  await waitForAnimationsToEnd(page);
  return dialog;
}

/** Writes the name and confirms «Lo regalo io» in the open dialog. */
async function give(dialog: Locator, name: string) {
  await nameField(dialog).fill(name);
  await giveButton(dialog).click();
}

/** What the server sends for a path, with no script run. */
async function htmlOf(page: Page, path: string) {
  return page.request.get(path);
}

async function visitorContext(browser: Browser, baseURL: string | undefined) {
  return browser.newContext({
    baseURL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
}

const closeAction = (page: Page): Locator =>
  page
    .getByRole("link", { name: "Chiudi", exact: true })
    .or(page.getByRole("button", { name: "Chiudi", exact: true }));

// ----------------------------------------------------------------- contenuto

test.describe("contenuto della pagina pubblica", () => {
  test("CA-1: titolo fisso, h1 «Il compleanno di Mia», «Il 14 dicembre.», marchio e nessun pezzo dell'app", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      await openPublic(page, link.code);
      await expect(page).toHaveTitle(LIST_TITLE);
      await expect(
        page.getByText("Il 14 dicembre.").filter({ visible: true }),
      ).toHaveCount(1);
      await expect(
        page.getByText("Lista creata con FamilyNest").filter({ visible: true }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);
      await expect(
        page.locator('a[href="/oggi"], a[href="/notifiche"], a[href="/nest"]'),
      ).toHaveCount(0);
      expect(await pageText(page)).not.toContain("Casa Prova");
    });
  });

  test("CA-2: prima le idee libere dalla più recente, poi quelle già prese, senza nomi", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      await openPublic(page, link.code);
      await expect(titles(page)).toHaveCount(5);
      await expect(titles(page)).toContainText([T_I3, T_I2, T_I1, T_I5, T_I4]);

      for (const [title, price] of [
        [T_I2, "24,90 €"],
        [T_I1, "18 €"],
      ] as const) {
        const row = rowOf(page, title);
        await expect(giveButton(row)).toHaveCount(1);
        await expect(row.locator(".riga-lista__info")).toHaveText(price);
        await expect(row).not.toHaveClass(/riga-regalo--barrato/);
      }
      await expect(giveButton(rowOf(page, T_I3))).toHaveCount(1);
      for (const [title, price] of [
        [T_I5, "22 €"],
        [T_I4, "35 €"],
      ] as const) {
        const row = rowOf(page, title);
        await expect(row).toHaveClass(/riga-regalo--barrato/);
        await expect(row).toContainText("Già preso");
        await expect(row.locator(".riga-lista__info")).toHaveText(price);
        await expect(giveButton(row)).toHaveCount(0);
        await expect(row).not.toContainText("Nonna");
        await expect(row).not.toContainText("Zia");
      }
    });
  });

  test("CA-3: a 1280 px ogni idea è una scheda in tre colonne, con negozio e nota, e testa e marchio a sinistra", async ({
    page,
  }) => {
    only1280();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      await openPublic(page, link.code);
      const grid = page.locator(".colonne--tre").filter({ visible: true });
      await expect(grid.locator("li.scheda-regalo")).toHaveCount(5);
      const i1 = rowOf(page, T_I1);
      await expect(i1).toContainText("Feltrinelli · lo vuole tanto");
      await expect(i1).toContainText("18 €");
      await expect(rowOf(page, T_I3)).toContainText(
        "Un'esperienza da fare con la nonna",
      );
      for (const title of [T_I4, T_I5]) {
        const card = rowOf(page, title);
        await expect(card).toHaveClass(/scheda-regalo--preso/);
        await expect(card).toContainText("Già preso");
      }
      const left = page.locator(".pubblica-solo-desktop > .colonna").first();
      await expect(left.getByRole("heading", { level: 1 })).toHaveText(
        "Il compleanno di Mia",
      );
      await expect(left).toContainText("Lista creata con FamilyNest");
    });
  });

  test("CA-4: il titolo con link apre il negozio in una nuova scheda senza referente; senza link è solo testo", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      await openPublic(page, link.code);
      const shop = page.getByRole("link", {
        name: /Diario segreto con lucchetto/,
      });
      await expect(shop).toHaveCount(1);
      await expect(shop).toHaveAttribute(
        "href",
        "https://negozio.example/diario",
      );
      await expect(shop).toHaveAttribute("target", "_blank");
      const rel = (await shop.getAttribute("rel")) ?? "";
      for (const token of ["noopener", "noreferrer", "nofollow"]) {
        expect(rel).toContain(token);
      }
      await expect(
        page.getByRole("link", { name: /Biglietti per il musical/ }),
      ).toHaveCount(0);
    });
  });

  test("CA-5: né il testo né le risposte di rete contengono nomi, taglie, scuola o altre liste (anche 1280)", async ({
    page,
  }) => {
    needsThrowaway();
    await withPublic(async ({ link }) => {
      const responses = recordResponses(page);
      await openPublic(page, link.code);
      await expect(titles(page)).toHaveCount(5);
      const seen = `${await pageText(page)}\n${await responses.text()}`;
      for (const word of [
        "Nonna Anna",
        "Zia Carla",
        "Ugo",
        "Vera",
        "Nico",
        "Fido",
        "Monopattino",
        "Casa Prova",
        "2016",
        "anni",
        "Manzoni",
        "Trottola",
        "Nina",
      ]) {
        expect(seen, word).not.toMatch(
          new RegExp(`\\b${escapeRegExp(word)}\\b`),
        );
      }
    });
  });

  test("CA-6: la funzione di lettura restituisce solo i campi permessi e nessun id del Nest, di Mia o della lista", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const { row, failed } = await readPublic(ctx.link.code);
      expect(failed).toBe(false);
      expect(row).not.toBeNull();
      expect(Object.keys(row!).sort()).toEqual(
        [
          "child_color",
          "child_name",
          "items",
          "occasion_day",
          "occasion_month",
          "status",
        ].sort(),
      );
      expect(row!.child_name).toBe("Mia");
      expect(row!.child_color).toBe("salvia");
      expect(row!.occasion_month).toBe(12);
      expect(row!.occasion_day).toBe(14);
      expect(row!.items).toHaveLength(5);
      for (const item of row!.items) {
        expect(Object.keys(item).sort()).toEqual(
          [
            "has_photo",
            "id",
            "note",
            "price_cents",
            "shop_name",
            "state",
            "title",
            "url",
          ].sort(),
        );
      }
      const text = JSON.stringify(row);
      for (const id of [ctx.householdId, ctx.mia, ctx.listId, ctx.link.id]) {
        expect(text).not.toContain(id);
      }
      expect(text).not.toContain("Nonna Anna");
      expect(text).not.toContain("Zia Carla");
    });
  });

  test("CA-7: l'HTML del server non ha dati, ha noindex e no-referrer e le intestazioni giuste", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      const response = await htmlOf(page, publicPath(link.code));
      expect(response.ok()).toBe(true);
      const html = await response.text();
      expect(html).not.toMatch(/\bMia\b/);
      expect(html).not.toContain("Diario segreto");
      expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
      expect(html).toContain('<meta name="referrer" content="no-referrer"');
      expect(html).not.toContain("og:title");
      const headers = response.headers();
      expect(headers["x-robots-tag"]).toContain("noindex");
      expect(headers["referrer-policy"]).toBe("no-referrer");
      expect(headers["cache-control"]).toContain("no-store");
    });
  });

  test("CA-8: il browser contatta solo l'app e il progetto Supabase, mai il codice nell'indirizzo", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async ({ link }) => {
      const urls = recordRequests(page);
      await openPublic(page, link.code);
      await expect(titles(page)).toHaveCount(5);
      const appOrigin = new URL(baseURL as string).origin;
      const allowed = [appOrigin, new URL(supabaseUrl as string).origin];
      for (const url of urls) {
        if (url.startsWith("data:") || url.startsWith("blob:")) continue;
        const parsed = new URL(url);
        expect(allowed, url).toContain(parsed.origin);
        // Il codice sta solo nell'indirizzo della pagina stessa.
        const isPage =
          parsed.origin === appOrigin &&
          parsed.pathname === publicPath(link.code);
        if (!isPage) expect(url).not.toContain(link.code);
      }
      expect(urls.some((url) => url.includes("negozio.example"))).toBe(false);
    });
  });

  test("CA-9: senza idee la pagina dice che non ci sono idee e non ha bottoni «Lo regalo io»", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(
      async ({ link }) => {
        await openPublic(page, link.code);
        await expect(
          page.getByText("Ancora nessuna idea").filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page
            .getByText(
              "I genitori non hanno ancora scritto le idee per Mia. Riapri questo link tra qualche giorno.",
            )
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Lo regalo io" }),
        ).toHaveCount(0);
      },
      { empty: true },
    );
  });

  test("CA-10: A, con la sua sessione, vede la stessa pagina, senza navigazione e senza «Casa D'Angelo»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    needsSeed("A");
    await withPublic(async ({ link }) => {
      await signInAs(page.context(), baseURL as string, "A");
      await openPublic(page, link.code);
      await expect(titles(page)).toContainText([T_I3, T_I2, T_I1, T_I5, T_I4]);
      await expect(
        page.getByRole("navigation", { name: "Navigazione principale" }),
      ).toHaveCount(0);
      expect(await pageText(page)).not.toContain("D'Angelo");
    });
  });
});

// --------------------------------------------------------------- «Lo regalo io»

test.describe("«Lo regalo io»", () => {
  test("CA-11: il dialogo ha il titolo dell'idea, il campo vuoto e a fuoco senza «name», l'avviso e il bottone (a 1280 anche «Annulla»)", async ({
    page,
  }) => {
    needsThrowaway();
    await withPublic(async ({ link }) => {
      await openPublic(page, link.code);
      const dialog = await openGive(page, T_I1);
      await expect(
        dialog.getByRole("heading", { level: 2, name: T_I1 }),
      ).toBeVisible();
      const input = nameField(dialog);
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
      expect(await input.getAttribute("name")).toBeNull();
      await expect(
        dialog.getByText("Lo vedranno solo i genitori. Mia no."),
      ).toBeVisible();
      await expect(giveButton(dialog)).toBeVisible();
      const text = await dialog.innerText();
      expect(text).not.toContain("Ugo");
      expect(text).not.toContain("Vera");
      if (!isMobile()) {
        await expect(
          dialog.getByRole("button", { name: "Annulla", exact: true }),
        ).toBeVisible();
      }
    });
  });

  test("CA-12: scrivere il nome segna l'idea «Lo regali tu», con il toast, e salva solo «Nonna Rosa»", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await give(dialog, "  Nonna   Rosa  ");
      await expect(dialog).toBeHidden();

      const row = rowOf(page, T_I1);
      await expect(row.locator(".etichetta--scura")).toContainText(
        "Lo regali tu",
      );
      await expect(giveButton(row)).toHaveCount(0);
      await expect(titles(page).nth(2)).toContainText(T_I1);
      await expect(toast(page)).toContainText("Segnato a tuo nome.");
      await expect(toast(page)).toContainText(
        "I genitori lo sapranno, Mia no.",
      );
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([
        { giver_name: "Nonna Rosa" },
      ]);
    });
  });

  test("CA-13: ricaricando resta «Lo regali tu»; su un altro browser è «Già preso» e il nome non c'è", async ({
    page,
    browser,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      await give(await openGive(page, T_I1), "Nonna Rosa");
      await expect(
        rowOf(page, T_I1).locator(".etichetta--scura"),
      ).toBeVisible();

      await page.reload();
      await expect(h1(page)).toHaveText("Il compleanno di Mia");
      await expect(
        rowOf(page, T_I1).locator(".etichetta--scura"),
      ).toContainText("Lo regali tu");

      const context = await visitorContext(browser, baseURL);
      try {
        const other = await context.newPage();
        const responses = recordResponses(other);
        await openPublic(other, ctx.link.code);
        await expect(rowOf(other, T_I1)).toContainText("Già preso");
        await expect(giveButton(rowOf(other, T_I1))).toHaveCount(0);
        const seen = `${await pageText(other)}\n${await responses.text()}`;
        expect(seen).not.toContain("Nonna Rosa");
      } finally {
        await context.close();
      }
    });
  });

  test("CA-14: alla presa successiva il campo contiene già «Nonna Rosa»", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      await give(await openGive(page, T_I1), "Nonna Rosa");
      await expect(
        rowOf(page, T_I1).locator(".etichetta--scura"),
      ).toBeVisible();
      const dialog = await openGive(page, T_I2);
      await expect(nameField(dialog)).toHaveValue("Nonna Rosa");
    });
  });

  test("CA-15: il nome vuoto o di soli spazi dà l'errore sotto il campo, il fuoco resta lì e nulla è salvato", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await giveButton(dialog).click();
      await expect(dialog.getByText(NAME_ERROR)).toBeVisible();
      await expect(nameField(dialog)).toBeFocused();

      await give(dialog, "    ");
      await expect(dialog.getByText(NAME_ERROR)).toBeVisible();
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([]);
    });
  });

  test("CA-16: il campo del nome accetta al massimo 40 caratteri", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await nameField(dialog).pressSequentially("x".repeat(45));
      expect((await nameField(dialog).inputValue()).length).toBe(40);
    });
  });

  test("CA-17: se un altro l'ha appena preso compare l'avviso, la riga diventa «Già preso» e resta solo «Zio Luca»", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await insertReservation(
        ctx,
        ctx.ids.I1!,
        ctx.link.id,
        "Zio Luca",
        new Date(),
      );
      await give(dialog, "Nonna Rosa");
      await expect(dialog.getByText(TAKEN_ALERT)).toBeVisible();
      await dialog.getByRole("button", { name: "Chiudi", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(rowOf(page, T_I1)).toContainText("Già preso");
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([
        { giver_name: "Zio Luca" },
      ]);
    });
  });

  test("CA-18: se il link è stato disattivato la pagina passa a «Questa lista non è più attiva» e nulla è salvato", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      const { error } = await ctx.admin
        .from("wishlist_share_links")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", ctx.link.id);
      expect(error).toBeNull();
      await give(dialog, "Nonna Rosa");
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([]);
    });
  });

  test("CA-19: se la presa fallisce per rete compare l'avviso, il nome resta scritto e nulla è salvato", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await abortRequests(page, RPC_RESERVE);
      await give(dialog, "Nonna Rosa");
      await expect(dialog.getByText(NETWORK_ALERT)).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(nameField(dialog)).toHaveValue("Nonna Rosa");
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([]);
    });
  });

  test("CA-20: due tocchi di seguito su «Lo regalo io» salvano una sola prenotazione", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I1);
      await nameField(dialog).fill("Nonna Rosa");
      await giveButton(dialog).click({ clickCount: 2 });
      await expect(dialog).toBeHidden();
      await expect(
        rowOf(page, T_I1).locator(".etichetta--scura"),
      ).toBeVisible();
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([
        { giver_name: "Nonna Rosa" },
      ]);
    });
  });

  test("CA-21: a 1280 px «Annulla» ed Esc chiudono, il fuoco torna sul bottone dell'idea e nulla è salvato", async ({
    page,
  }) => {
    only1280();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await openPublic(page, ctx.link.code);
      let dialog = await openGive(page, T_I1);
      await nameField(dialog).fill("Nonna Rosa");
      await dialog
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await expect(giveButton(rowOf(page, T_I1))).toBeFocused();

      dialog = await openGive(page, T_I1);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(giveButton(rowOf(page, T_I1))).toBeFocused();
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([]);
    });
  });

  test("CA-22: dopo 30 prese nell'ultima ora compare «Hai segnato molti regali in poco tempo…» e l'idea resta libera", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(150_000);
    await withPublic(async (ctx) => {
      for (let index = 0; index < 30; index += 1) {
        const id = await insertIdea(ctx, ctx.listId, {
          title: `Idea in più ${index + 1}`,
        });
        expect(await reservePublic(ctx.link.code, id, "Zio Luca")).toBe(
          "reserved",
        );
      }
      await openPublic(page, ctx.link.code);
      const dialog = await openGive(page, T_I2);
      await give(dialog, "Nonna Rosa");
      await expect(dialog.getByText(RATE_ALERT)).toBeVisible();
      expect(await reservationsOf(ctx, ctx.ids.I2!)).toEqual([]);
    });
  });

  test("CA-23: nessun indirizzo di richiesta contiene il nome o il codice e i cookie non cambiano", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const urls = recordRequests(page);
      await openPublic(page, ctx.link.code);
      const cookiesBefore = JSON.stringify(await page.context().cookies());
      await give(await openGive(page, T_I1), "Nonna Rosa");
      await expect(
        rowOf(page, T_I1).locator(".etichetta--scura"),
      ).toBeVisible();
      for (const url of urls) {
        const part = dataPartOfUrl(url);
        if (part === null) continue;
        expect(part, url).not.toMatch(/Nonna|Rosa/);
        if (!part.startsWith(publicPath(ctx.link.code))) {
          expect(part, url).not.toContain(ctx.link.code);
        }
      }
      expect(JSON.stringify(await page.context().cookies())).toBe(
        cookiesBefore,
      );
    });
  });
});

// -------------------------------------------------------------------- errori

test.describe("errori", () => {
  test("CA-24: un link disattivato mostra «Questa lista non è più attiva» senza dati (anche 1280)", async ({
    page,
  }) => {
    needsThrowaway();
    await withPublic(async (ctx) => {
      const { error } = await ctx.admin
        .from("wishlist_share_links")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", ctx.link.id);
      expect(error).toBeNull();
      const responses = recordResponses(page);
      await page.goto(publicPath(ctx.link.code));
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
      const alert = page.getByRole("alert").filter({ hasText: NOT_ACTIVE });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(NOT_ACTIVE_TEXT);
      await expect(closeAction(page)).toBeVisible();
      await expect(page).toHaveTitle(LIST_TITLE);
      const seen = `${await pageText(page)}\n${await responses.text()}`;
      expect(seen).not.toMatch(/\bMia\b/);
      expect(seen).not.toContain("Diario segreto");
    });
  });

  test("CA-25: un link con la scadenza nel passato mostra la stessa pagina", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const { error } = await ctx.admin
        .from("wishlist_share_links")
        .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
        .eq("id", ctx.link.id);
      expect(error).toBeNull();
      await page.goto(publicPath(ctx.link.code));
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
      await expect(
        page.getByRole("alert").filter({ hasText: NOT_ACTIVE }),
      ).toContainText(NOT_ACTIVE_TEXT);
      await expect(page).toHaveTitle(LIST_TITLE);
    });
  });

  test("CA-26: codici casuali, corti, senza l'ultimo carattere o in maiuscolo mostrano la stessa pagina; «abc» non arriva al database", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const code = ctx.link.code;
      const paths = [
        publicPath(randomBytes(32).toString("hex")),
        publicPath(code.slice(0, -1)),
        publicPath(code.toUpperCase()),
      ];
      for (const path of paths) {
        await page.goto(path);
        await expect(h1(page), path).toHaveText(NOT_ACTIVE);
        await expect(
          page.getByRole("alert").filter({ hasText: NOT_ACTIVE_TEXT }),
          path,
        ).toBeVisible();
      }
      const urls = recordRequests(page);
      await page.goto(publicPath("abc"));
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
      expect(urls.filter((url) => RPC_ANY.test(url))).toEqual([]);
    });
  });

  test("CA-27: /desideri senza codice mostra «Questa pagina non c’è»", async ({
    page,
  }) => {
    only390();
    await page.goto("/desideri");
    await expect(h1(page)).toHaveText(NOT_FOUND);
  });

  test("CA-28: «Chiudi» porta fuori dalla pagina della lista", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const { error } = await ctx.admin
        .from("wishlist_share_links")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", ctx.link.id);
      expect(error).toBeNull();
      await page.goto(publicPath(ctx.link.code));
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
      await closeAction(page).click();
      await expect(page).not.toHaveURL(/\/desideri\//);
    });
  });

  test("CA-29: se la lettura fallisce compare «Questa pagina non si è caricata» e «Riprova» la ricarica", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      let failing = true;
      await page.route(RPC_READ_PUBLIC, async (route) => {
        if (failing && route.request().method() !== "OPTIONS") {
          await route.abort("failed");
          return;
        }
        await route.fallback();
      });
      await page.goto(publicPath(ctx.link.code));
      await expect(h1(page)).toHaveText(LOAD_FAILED);
      const retry = page.getByRole("button", { name: "Riprova", exact: true });
      await expect(retry).toBeVisible();
      failing = false;
      await retry.click();
      await expect(h1(page)).toHaveText("Il compleanno di Mia");
    });
  });
});

// ---------------------------------------------------- accesso diretto al database

test.describe("accesso diretto al database", () => {
  test("CA-30: un client senza sessione non legge né scrive la lista", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
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
      const before = await reservationCount(ctx, ctx.listId);
      const insert = await anon.from("wishlist_reservations").insert({
        household_id: ctx.householdId,
        item_id: ctx.ids.I1,
        share_link_id: ctx.link.id,
        giver_name: "Intrusa",
      });
      expect(insert.error).not.toBeNull();
      expect(await reservationCount(ctx, ctx.listId)).toBe(before);
      const text = JSON.stringify(seen);
      expect(text).not.toContain("Diario segreto");
      expect(text).not.toContain(ctx.link.code);
    });
  });

  test("CA-31: la funzione di lettura rifiuta GET, HEAD e PUT", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const url = `${supabaseUrl}/rest/v1/rpc/get_public_wishlist`;
      const headers = {
        apikey: publishableKey as string,
        authorization: `Bearer ${publishableKey}`,
        "content-type": "application/json",
      };
      for (const method of ["GET", "HEAD", "PUT"]) {
        const response = await fetch(
          method === "GET" ? `${url}?p_code=${ctx.link.code}` : url,
          {
            method,
            headers,
            body:
              method === "PUT"
                ? JSON.stringify({ p_code: ctx.link.code })
                : undefined,
          },
        );
        expect(response.ok, method).toBe(false);
        const body = await response.text();
        expect(body, method).not.toContain("Mia");
        expect(body, method).not.toContain("Diario");
      }
    });
  });

  test("CA-32: prendere l'idea di un'altra lista, anche dello stesso Nest, è rifiutato come «idea che non c'è»", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      await withAltraCasa(async (altra) => {
        const vito = altra.nest.users["Vito"]!;
        const scope = {
          admin: vito.admin,
          householdId: altra.nest.householdId,
        };
        const ninaList = await createList(scope, altra.nina);
        const trottola = await insertIdea(scope, ninaList, {
          title: "Trottola",
        });
        expect(
          await reservePublic(ctx.link.code, ctx.monopattino, "Zio Luca"),
        ).toBe("not_found");
        expect(await reservePublic(ctx.link.code, trottola, "Zio Luca")).toBe(
          "not_found",
        );
        expect(await reservationsOf(ctx, ctx.monopattino)).toEqual([]);
        expect(await reservationsOf(scope, trottola)).toEqual([]);
      });
    });
  });

  test("CA-33: la lettura con K non dà «Monopattino»; con il codice di Nina dà solo «Trottola» e «Nina»", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      const mia = await readPublic(ctx.link.code);
      expect(JSON.stringify(mia.row)).not.toContain("Monopattino");
      await withAltraCasa(async (altra) => {
        const vito = altra.nest.users["Vito"]!;
        const scope = {
          admin: vito.admin,
          householdId: altra.nest.householdId,
        };
        const ninaList = await createList(scope, altra.nina);
        await insertIdea(scope, ninaList, { title: "Trottola" });
        const ninaLink = await insertLink(scope, ninaList, {
          occasion: nextDecember14(),
        });
        const nina = await readPublic(ninaLink.code);
        expect(nina.row!.child_name).toBe("Nina");
        expect(nina.row!.items.map((item) => item.title)).toEqual(["Trottola"]);
        const text = JSON.stringify(nina.row);
        expect(text).not.toContain("Mia");
        expect(text).not.toContain("Diario");
      });
    });
  });

  test("CA-34: un nome di 41 caratteri o vuoto è rifiutato e nulla è salvato", async () => {
    only390();
    needsThrowaway();
    await withPublic(async (ctx) => {
      for (const name of ["x".repeat(41), "", "   "]) {
        expect(
          await reservePublic(ctx.link.code, ctx.ids.I1!, name, randomKey()),
        ).toBe("invalid_name");
      }
      expect(await reservationsOf(ctx, ctx.ids.I1!)).toEqual([]);
    });
  });
});
