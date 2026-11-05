import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { addDays, romeDay } from "../fixtures/casa";
import {
  NOT_ACTIVE,
  T_I1,
  activeLink,
  activeLinksOf,
  birthIn,
  confirmDialog,
  copyDialog,
  createList,
  dayText,
  disableButton,
  ideasOfNest,
  insertIdea,
  insertLink,
  linksOf,
  openAdd,
  openIdea,
  openList,
  publicPath,
  recordRequests,
  reservePublic,
  seedList,
  shareBlock,
  shareButton,
  fillIdea,
  submitIdea,
  toastWith,
} from "../fixtures/desideri";
import {
  dataPartOfUrl,
  failRequests,
  h1,
  openChild,
  section,
  setBirth,
  withAltraCasa,
  withFigli,
} from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// "Lista desideri" (#32, PR #279): condividere e disattivare il link
// (CA-34 ... CA-42), la sezione nel profilo del figlio (CA-43 ... CA-45), la
// notifica «regalo preso» (CA-46 ... CA-49), la durata dei dati (CA-50, CA-51)
// e la privacy della pagina (CA-53). CA-52 («I tuoi dati») è in
// profilo-dati.spec.ts. Valgono i testi della specifica grafica dove i CA
// differiscono (decisione del coordinatore del 05/11: CA-34, CA-38, CA-41,
// CA-42). Un criterio senza «anche 1280» vale a 390 px.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const isMobile = () => test.info().project.name === "mobile";
const only390 = () =>
  test.skip(!isMobile(), "Criterio valido a 390 px (non dice «anche 1280»)");
const needsThrowaway = () =>
  test.skip(!throwawayConfigured(), throwawaySkipReason);

const CODE_RX = /^[0-9a-f]{64}$/;
const NEVER_SHARED_INFO =
  "Crea il link e mandalo a nonni e parenti: vedono le idee e segnano cosa regalano.";
const COPIED = "Link copiato. Mandalo a nonni e parenti.";

/** Allows the page to write and read the clipboard. */
async function allowClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
}

async function clipboardOf(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/** The code at the end of a copied address. */
function codeOf(address: string): string {
  const match = /\/desideri\/([0-9a-f]{64})$/.exec(address);
  expect(match, address).not.toBeNull();
  return match![1]!;
}

/** A second browser context, same size as the page, with its own cookies. */
async function otherContext(
  browser: Browser,
  baseURL: string | undefined,
  page: Page,
): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
}

/** What a visitor without a session sees at an address. */
async function visitorSees(
  browser: Browser,
  baseURL: string | undefined,
  page: Page,
  path: string,
): Promise<string> {
  const context = await otherContext(browser, baseURL, page);
  try {
    const visitor = await context.newPage();
    await visitor.goto(path);
    await expect(
      visitor.getByRole("heading", { level: 1 }),
      path,
    ).toBeVisible();
    return await visitor.getByRole("heading", { level: 1 }).innerText();
  } finally {
    await context.close();
  }
}

// ------------------------------------------------------------- condividere

test.describe("condividere e disattivare il link", () => {
  test("CA-34: senza link e con il compleanno tra 10 giorni il blocco dice «Non ancora condivisa» e ha «Condividi»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx, ctx.mia, ["I1", "I2", "I3"]);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const block = shareBlock(page);
      await expect(block).toContainText("Non ancora condivisa");
      await expect(block).toContainText(NEVER_SHARED_INFO);
      await expect(shareButton(page)).toBeVisible();
      await expect(disableButton(page)).toHaveCount(0);
      await expect(block).not.toContainText("Disattiva il link");
    });
  });

  test("CA-35: «Condividi» copia l'indirizzo pubblico con 64 caratteri, mostra il toast e passa a «Condivisa con un link»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();

      const address = await clipboardOf(page);
      const origin = new URL(baseURL as string).origin;
      expect(address.startsWith(`${origin}/desideri/`)).toBe(true);
      expect(address.slice(`${origin}/desideri/`.length)).toMatch(CODE_RX);
      const block = shareBlock(page);
      await expect(block).toContainText("Condivisa con un link");
      const today = romeDay();
      await expect(block).toContainText(
        `Attivo fino al ${dayText(addDays(today, 11), today)}`,
      );
      await expect(disableButton(page)).toBeVisible();
      const links = await activeLinksOf(ctx);
      expect(links).toHaveLength(1);
      expect(codeOf(address)).toBe(links[0]!.code);
    });
  });

  test("CA-36: un secondo «Condividi», anche di U2, dà lo stesso indirizzo e resta un solo link attivo", async ({
    page,
    browser,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      const first = await clipboardOf(page);

      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      expect(await clipboardOf(page)).toBe(first);

      const context = await otherContext(browser, baseURL, page);
      try {
        await allowClipboard(context);
        const vera = await context.newPage();
        await ctx.nest.signInContext(context, baseURL, "Vera");
        await vera.goto(`/figli/${ctx.mia}/lista-desideri`);
        await expect(h1(vera)).toHaveText("I desideri di Mia");
        await shareButton(vera).click();
        await expect(toastWith(vera, COPIED)).toBeVisible();
        expect(await clipboardOf(vera)).toBe(first);
      } finally {
        await context.close();
      }
      expect(await activeLinksOf(ctx)).toHaveLength(1);
    });
  });

  test("CA-37: i codici di Mia e di Nina sono diversi, lunghi 64 caratteri e senza gli id", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await withAltraCasa(async (altra) => {
        const vito = altra.nest.users["Vito"]!;
        const altraScope = {
          admin: vito.admin,
          householdId: altra.nest.householdId,
        };
        await setBirth(vito.admin, altra.nina, "2016-12-14");
        const ninaList = await createList(altraScope, altra.nina);
        await insertIdea(altraScope, ninaList, { title: "Trottola" });

        const mia = await ctx.nest.users["Ugo"]!.client.rpc("share_wishlist", {
          p_member_id: ctx.mia,
        });
        const nina = await vito.client.rpc("share_wishlist", {
          p_member_id: altra.nina,
        });
        expect(mia.error).toBeNull();
        expect(nina.error).toBeNull();
        const miaLinks = await linksOf(ctx);
        const ninaLinks = await linksOf(altraScope);
        const miaCode = miaLinks.find(
          (link) => link.disabled_at === null,
        )!.code;
        const ninaCode = ninaLinks[0]!.code;
        expect(miaCode).not.toBe(ninaCode);
        for (const code of [miaCode, ninaCode]) {
          expect(code).toMatch(CODE_RX);
        }
        for (const id of [
          ctx.householdId,
          wish.listId,
          ctx.mia,
          altra.nest.householdId,
          altra.nina,
          ninaList,
        ]) {
          for (const form of [id, id.replace(/-/g, "")]) {
            expect(miaCode).not.toContain(form);
            expect(ninaCode).not.toContain(form);
          }
        }
      });
    });
  });

  test("CA-38: «Disattiva il link» chiede conferma, «Annulla» lascia il link, «Disattiva» lo chiude e il vecchio indirizzo non è più attivo", async ({
    page,
    browser,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      const address = await clipboardOf(page);
      const path = new URL(address).pathname;

      await disableButton(page).click();
      const confirm = confirmDialog(page, "Disattivare il link?");
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText(
        "Chi ha il link non vedrà più la lista. I regali già presi restano segnati.",
      );
      await confirm
        .getByRole("button", { name: "Annulla", exact: true })
        .click();
      await expect(confirm).toBeHidden();
      await expect(shareBlock(page)).toContainText("Condivisa con un link");
      expect(await activeLinksOf(ctx)).toHaveLength(1);

      await disableButton(page).click();
      await confirm
        .getByRole("button", { name: "Disattiva", exact: true })
        .click();
      await expect(confirm).toBeHidden();
      await expect(
        toastWith(
          page,
          "Link disattivato. Chi lo apre vede che la lista non è più attiva.",
        ),
      ).toBeVisible();
      await expect(shareBlock(page)).toContainText("Link disattivato");
      await expect(shareBlock(page)).toContainText(
        "Chi lo apre vede che la lista non è più attiva. Condividi per crearne uno nuovo.",
      );
      await expect(shareButton(page)).toBeVisible();
      expect(await activeLinksOf(ctx)).toHaveLength(0);

      expect(await visitorSees(browser, baseURL, page, path)).toBe(NOT_ACTIVE);
    });
  });

  test("CA-39: dopo la disattivazione «Condividi» crea un codice nuovo e il vecchio resta non attivo", async ({
    page,
    browser,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      const old = await clipboardOf(page);

      await disableButton(page).click();
      await confirmDialog(page, "Disattivare il link?")
        .getByRole("button", { name: "Disattiva", exact: true })
        .click();
      await expect(shareBlock(page)).toContainText("Link disattivato");
      await expect(shareBlock(page)).toContainText(
        "Chi lo apre vede che la lista non è più attiva. Condividi per crearne uno nuovo.",
      );
      await expect(shareButton(page)).toBeVisible();

      await shareButton(page).click();
      await expect(shareBlock(page)).toContainText("Condivisa con un link");
      const fresh = await clipboardOf(page);
      expect(fresh).toMatch(/\/desideri\/[0-9a-f]{64}$/);
      expect(codeOf(fresh)).not.toBe(codeOf(old));
      expect(
        await visitorSees(browser, baseURL, page, new URL(old).pathname),
      ).toBe(NOT_ACTIVE);
    });
  });

  test("CA-40: un link scaduto dice «Il link è scaduto» e «Condividi» crea un codice nuovo", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      const expired = await insertLink(ctx, wish.listId, {
        occasion: addDays(romeDay(), -3),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const block = shareBlock(page);
      await expect(block).toContainText("Il link è scaduto");
      await expect(block).toContainText("Condividi per crearne uno nuovo.");
      await expect(shareButton(page)).toBeVisible();
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      expect(codeOf(await clipboardOf(page))).not.toBe(expired.code);
      expect(await activeLinksOf(ctx)).toHaveLength(1);
    });
  });

  test("CA-41: con gli appunti rifiutati si apre «Copia il link» con il campo di sola lettura e nessun toast", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: () => Promise.reject(new Error("negato")),
            readText: () => Promise.reject(new Error("negato")),
          },
        });
      });
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await shareButton(page).click();
      const dialog = copyDialog(page);
      await expect(dialog).toBeVisible();
      const input = dialog.getByLabel("Link della lista", { exact: true });
      await expect(input).toHaveAttribute("readonly", "");
      await expect(input).toHaveValue(/\/desideri\/[0-9a-f]{64}$/);
      await expect(toastWith(page, "Link copiato")).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: "Fatto", exact: true }),
      ).toBeVisible();
    });
  });

  test("CA-42: se la creazione del link fallisce compare l'errore e non c'è nessun link attivo", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      await failRequests(page, /\/rest\/v1\/rpc\/share_wishlist/);
      await shareButton(page).click();
      await expect(
        toastWith(
          page,
          "Non siamo riusciti a creare il link. Controlla la connessione e riprova.",
        ),
      ).toBeVisible();
      await expect(toastWith(page, COPIED)).toHaveCount(0);
      expect(await activeLinksOf(ctx)).toHaveLength(0);
    });
  });
});

// ------------------------------------------------- sezione nel profilo

test.describe("sezione «Lista desideri» nel profilo del figlio", () => {
  test("CA-43: la riga ha «5 idee», «Compleanno, 14 dicembre», «Non ancora condivisa · 2 già presi», senza nomi, e porta alla lista (anche 1280)", async ({
    page,
    baseURL,
  }) => {
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const wishlist = section(page, "Lista desideri");
      await expect(wishlist.getByRole("heading", { level: 2 })).toHaveText(
        "Lista desideri",
      );
      await expect(wishlist.locator(".sezione__info")).toHaveText("5 idee");
      const link = wishlist.getByRole("link");
      await expect(link).toHaveAttribute(
        "href",
        `/figli/${ctx.mia}/lista-desideri`,
      );
      await expect(link).toContainText("Compleanno, 14 dicembre");
      await expect(link).toContainText("Non ancora condivisa · 2 già presi");
      await expect(wishlist).not.toContainText("Nonna Anna");
      await expect(wishlist).not.toContainText("Zia Carla");
      await link.click();
      await expect(h1(page)).toHaveText("I desideri di Mia");
    });
  });

  test("CA-44: con un link attivo dice «Condivisa · 2 già presi»; Nico senza idee dice «Nessuna idea»", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(
      async (ctx) => {
        const wish = await seedList(ctx);
        await activeLink(wish);
        await openChild(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        await expect(
          section(page, "Lista desideri").getByRole("link"),
        ).toContainText("Condivisa · 2 già presi");

        await page.goto(`/figli/${ctx.nico}`);
        await expect(h1(page)).toHaveText("Nico");
        const nico = section(page, "Lista desideri");
        await expect(nico.locator(".sezione__info")).toHaveText("Nessuna idea");
        await expect(nico.getByRole("link")).toContainText("Compleanno");
        await expect(nico.getByRole("link")).toContainText(
          "Non ancora condivisa",
        );
      },
      { Nico: "" },
    );
  });

  test("CA-45: nel profilo vuoto di Nico la sezione «Lista desideri» sta sotto «Completa il profilo» con il link alla lista", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await openChild(page, baseURL, ctx, "Ugo", ctx.nico, "Nico");
      const complete = page.getByText("Completa il profilo di Nico");
      await expect(complete).toBeVisible();
      const wishlist = section(page, "Lista desideri");
      await expect(wishlist).toBeVisible();
      await expect(wishlist.getByRole("link")).toHaveAttribute(
        "href",
        `/figli/${ctx.nico}/lista-desideri`,
      );
      const completeBox = await complete.boundingBox();
      const wishlistBox = await wishlist.boundingBox();
      expect(completeBox!.y).toBeLessThan(wishlistBox!.y);
    });
  });
});

// ------------------------------------------------------------- notifica

test.describe("notifica «regalo preso»", () => {
  async function openNotifications(page: Page) {
    await page.goto("/notifiche");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifiche" }),
    ).toBeVisible();
  }

  const giftRow = (page: Page) =>
    page
      .locator("li.riga-notifica")
      .filter({ hasText: `Nonna Rosa regala ${T_I1} a Mia.` });

  test("CA-46: quando qualcuno prende un'idea gli adulti del Nest trovano la notifica non letta con l'icona, il grassetto e nessun bottone", async ({
    page,
    browser,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx, ctx.mia, ["I1", "I2", "I3"]);
      const link = await activeLink(wish);
      expect(await reservePublic(link.code, wish.ids.I1!, "Nonna Rosa")).toBe(
        "reserved",
      );

      await ctx.nest.signIn(page, baseURL, "Ugo");
      await openNotifications(page);
      const row = giftRow(page);
      await expect(row).toHaveCount(1);
      await expect(row).toHaveClass(/\bis-nuova\b/);
      await expect(row.locator("svg use[href='#i-gift']")).toHaveCount(1);
      await expect(row.locator("b")).toHaveText(["Nonna Rosa", T_I1]);
      await expect(row.getByRole("button")).toHaveCount(0);
      await expect(row.getByRole("link")).toHaveCount(0);

      const context = await otherContext(browser, baseURL, page);
      try {
        const vera = await context.newPage();
        await ctx.nest.signInContext(context, baseURL, "Vera");
        await openNotifications(vera);
        await expect(giftRow(vera)).toHaveCount(1);
      } finally {
        await context.close();
      }
    });
  });

  test("CA-47: V non vede la notifica e Casa Altra non ne ha", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx, ctx.mia, ["I1", "I2", "I3"]);
      const link = await activeLink(wish);
      await reservePublic(link.code, wish.ids.I1!, "Nonna Rosa");
      await withAltraCasa(async (altra) => {
        await altra.nest.signIn(page, baseURL, "Vito");
        await openNotifications(page);
        await expect(page.getByText("Nonna Rosa")).toHaveCount(0);
        const { count, error } = await altra.nest.users["Vito"]!.admin.from(
          "notifications",
        )
          .select("id", { count: "exact", head: true })
          .eq("household_id", altra.nest.householdId)
          .eq("kind", "gift_taken");
        expect(error).toBeNull();
        expect(count).toBe(0);
      });
    });
  });

  test("CA-48: la riga salvata non contiene il nome di chi regala né il titolo", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx, ctx.mia, ["I1", "I2", "I3"]);
      const link = await activeLink(wish);
      await reservePublic(link.code, wish.ids.I1!, "Nonna Rosa");
      const { data, error } = await ctx.admin
        .from("notifications")
        .select("*")
        .eq("household_id", ctx.householdId)
        .eq("kind", "gift_taken");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
      const text = JSON.stringify(data);
      expect(text).not.toContain("Nonna Rosa");
      expect(text).not.toContain("Diario segreto");
    });
  });

  test("CA-49: eliminando l'idea la notifica sparisce", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    test.setTimeout(60_000);
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx, ctx.mia, ["I1", "I2", "I3"]);
      const link = await activeLink(wish);
      await reservePublic(link.code, wish.ids.I1!, "Nonna Rosa");

      await ctx.nest.signIn(page, baseURL, "Ugo");
      await openNotifications(page);
      await expect(giftRow(page)).toHaveCount(1);

      await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
      const dialog = await openIdea(page, T_I1);
      await dialog
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      const confirm = confirmDialog(page, `Eliminare «${T_I1}»?`);
      await confirm
        .getByRole("button", { name: "Elimina l'idea", exact: true })
        .click();
      await expect(confirm).toBeHidden();

      await openNotifications(page);
      await expect(page.getByText("Nonna Rosa")).toHaveCount(0);
      const { count } = await ctx.admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("household_id", ctx.householdId)
        .eq("kind", "gift_taken");
      expect(count).toBe(0);
    });
  });
});

// ------------------------------------------------ durata dei dati

test.describe("durata dei dati e cancellazione", () => {
  test("CA-50: la pulizia a X+29 non cancella nulla, a X+31 toglie prese, idee prese e link ma lascia le altre idee", async () => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      const { data: before } = await ctx.admin.rpc("run_wishlist_cleanup", {
        p_household_id: ctx.householdId,
        p_today: addDays(wish.occasionDay, 29),
      });
      expect(before).toBe(0);
      expect(await ideasOfNest(ctx)).toHaveLength(5);
      expect(await linksOf(ctx)).toHaveLength(1);

      const { data: after } = await ctx.admin.rpc("run_wishlist_cleanup", {
        p_household_id: ctx.householdId,
        p_today: addDays(wish.occasionDay, 31),
      });
      expect(after).toBe(1);
      const left = await ideasOfNest(ctx);
      expect(left.map((idea) => idea.title).sort()).toEqual(
        [
          "Biglietti per il musical",
          "Diario segreto con lucchetto",
          "Set di acquerelli con pennelli",
        ].sort(),
      );
      expect(await linksOf(ctx)).toEqual([]);
      const { data: reservations } = await ctx.admin
        .from("wishlist_reservations")
        .select("giver_name")
        .eq("household_id", ctx.householdId);
      expect(reservations ?? []).toEqual([]);
    });
  });

  test("CA-51: togliere Mia dal Nest cancella lista, idee, link, prenotazioni e notifiche, e il vecchio indirizzo non è più attivo", async ({
    page,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      const wish = await seedList(ctx);
      const link = await activeLink(wish);
      await reservePublic(link.code, wish.ids.I1!, "Nonna Rosa");

      const removed = await ctx.admin
        .from("household_members")
        .delete()
        .eq("id", ctx.mia);
      expect(removed.error).toBeNull();

      expect(await ideasOfNest(ctx)).toEqual([]);
      expect(await linksOf(ctx)).toEqual([]);
      for (const table of [
        "wishlists",
        "wishlist_item_photos",
        "wishlist_reservations",
      ]) {
        const { data } = await ctx.admin
          .from(table)
          .select("household_id")
          .eq("household_id", ctx.householdId);
        expect(data ?? [], table).toEqual([]);
      }
      const { count } = await ctx.admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("household_id", ctx.householdId)
        .eq("kind", "gift_taken");
      expect(count).toBe(0);

      await page.goto(publicPath(link.code));
      await expect(h1(page)).toHaveText(NOT_ACTIVE);
    });
  });
});

// ------------------------------------------------------- privacy

test.describe("privacy della pagina", () => {
  test("CA-53: nessun indirizzo di richiesta contiene nomi, titoli o il codice, e la pagina non va in cache condivisa", async ({
    page,
    baseURL,
  }) => {
    only390();
    needsThrowaway();
    await withFigli(async (ctx) => {
      await seedList(ctx);
      await setBirth(ctx.admin, ctx.mia, birthIn(10));
      await allowClipboard(page.context());
      const urls = recordRequests(page);
      await ctx.nest.signIn(page, baseURL, "Ugo");
      const response = await page.goto(`/figli/${ctx.mia}/lista-desideri`);
      await expect(h1(page)).toHaveText("I desideri di Mia");
      const cache = response?.headers()["cache-control"] ?? "";
      expect(cache).toMatch(/private|no-store/);

      const dialog = await openAdd(page);
      await fillIdea(dialog, { idea: "Corso di pattinaggio" });
      await submitIdea(dialog).click();
      await expect(dialog).toBeHidden();
      await shareButton(page).click();
      await expect(toastWith(page, COPIED)).toBeVisible();
      const code = codeOf(await clipboardOf(page));

      for (const url of urls) {
        const part = dataPartOfUrl(url);
        if (part === null) continue;
        expect(part, url).not.toMatch(
          /\bMia\b|Diario|Corso|pattinaggio|Nonna|Zia/,
        );
        expect(part, url).not.toContain(code);
      }
      expect(await activeLinksOf(ctx)).toHaveLength(1);
    });
  });
});
