import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  SHOP_ORIGIN,
  T_I1,
  fillIdea,
  ideaRow,
  ideasOfNest,
  openAdd,
  openList,
  shopHits,
  startShop,
  submitIdea,
} from "../fixtures/desideri";
import { withAltraCasa, withFigli } from "../fixtures/figlio";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Limite di utilizzo per la lettura dei link dei negozi (#418). Servono
// l'origine di prova dei negozi (SHOP_LINK_TEST_ORIGIN) e l'utente usa e getta.
// Il caso «la funzione del limite risponde con un errore» non si può provocare
// da fuori: la chiamata parte dal server dell'app con la sessione dell'utente.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const UNREADABLE_ERROR =
  "Non riusciamo a leggere la pagina del negozio. Scrivi qui il nome dell'idea: la aggiungiamo con il link.";
const LIMIT_IN_TEN_MINUTES = 20;

const shopRequests = () => shopHits.filter((hit) => hit.startsWith("/diario"));

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  test.skip(!SHOP_ORIGIN, "SHOP_LINK_TEST_ORIGIN non è impostata dal workflow");
  test.skip(
    test.info().project.name !== "mobile",
    "Criterio valido a 390 px (la logica è sul server)",
  );
});

test.describe("limite di lettura dei link dei negozi", () => {
  test("un figlio altrui o inesistente dà un errore e il negozio non riceve richieste", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const shop = await startShop();
    try {
      await withAltraCasa(async (altra) => {
        await withFigli(async (ctx) => {
          await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
          // The browser only knows its own child: the id is swapped on the way.
          let replacement = altra.nina;
          await page.route(/\/figli\//, async (route) => {
            const request = route.request();
            const body = request.postData();
            if (
              request.method() === "POST" &&
              request.headers()["next-action"] &&
              body?.includes(ctx.mia)
            ) {
              await route.continue({
                postData: body.replaceAll(ctx.mia, replacement),
              });
              return;
            }
            await route.fallback();
          });

          for (const other of [altra.nina, randomUUID()]) {
            replacement = other;
            const before = shopRequests().length;
            const dialog = await openAdd(page);
            await fillIdea(dialog, {
              link: `${SHOP_ORIGIN}/diario`,
              idea: "Diario altrui",
            });
            await submitIdea(dialog).click();
            await expect(
              dialog.getByText(
                "Non siamo riusciti a salvare. Controlla la connessione e riprova.",
              ),
            ).toBeVisible({ timeout: 30_000 });
            expect(shopRequests()).toHaveLength(before);
            await dialog
              .getByRole("button", { name: "Chiudi", exact: true })
              .click();
            await expect(dialog).toBeHidden();
          }
          expect(await ideasOfNest(ctx)).toEqual([]);
          await page.unrouteAll({ behavior: "ignoreErrors" });
        });
      });
    } finally {
      shop.close();
    }
  });

  test("oltre il limite il negozio non riceve richieste e il link si comporta come non leggibile", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const shop = await startShop();
    try {
      await withFigli(async (ctx) => {
        // Real calls with the session of the user (the table of the readings
        // is not reachable by the administrative role).
        const user = ctx.nest.users["Ugo"]!;
        for (let i = 0; i < LIMIT_IN_TEN_MINUTES; i += 1) {
          const { data, error } = await user.client.rpc("claim_shop_link_read");
          expect(error).toBeNull();
          expect(data).toBe(true);
        }
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const before = shopRequests().length;

        // Without a name: the usual error of the unreadable link.
        const dialog = await openAdd(page);
        await fillIdea(dialog, { link: `${SHOP_ORIGIN}/diario` });
        await submitIdea(dialog).click();
        await expect(dialog.getByText(UNREADABLE_ERROR)).toBeVisible({
          timeout: 30_000,
        });
        expect(await ideasOfNest(ctx)).toEqual([]);

        // With a name: saved with the link, without the data of the page.
        await fillIdea(dialog, { idea: "Diario" });
        await submitIdea(dialog).click();
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        await expect(
          ideaRow(page, "Diario").locator(".riga-regalo__prezzo"),
        ).toHaveCount(0);
        const rows = await ideasOfNest(ctx);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.title).toBe("Diario");
        expect(rows[0]!.url).toBe(`${SHOP_ORIGIN}/diario`);
        expect(rows[0]!.shop_name).toBeNull();
        expect(rows[0]!.price_cents).toBeNull();
        expect(shopRequests()).toHaveLength(before);
      });
    } finally {
      shop.close();
    }
  });

  test("sotto il limite la lettura funziona come prima", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const shop = await startShop();
    try {
      await withFigli(async (ctx) => {
        await openList(page, baseURL, ctx, "Ugo", ctx.mia, "Mia");
        const dialog = await openAdd(page);
        await fillIdea(dialog, { link: `${SHOP_ORIGIN}/diario` });
        await submitIdea(dialog).click();
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        const row = ideaRow(page, T_I1);
        await expect(row.locator(".riga-regalo__prezzo")).toHaveText("18 €");
        const rows = await ideasOfNest(ctx);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.price_cents).toBe(1800);
        expect(rows[0]!.shop_name).toBe("Feltrinelli");
      });
    } finally {
      shop.close();
    }
  });
});
