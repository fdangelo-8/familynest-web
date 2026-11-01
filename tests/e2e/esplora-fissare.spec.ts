import { expect, test } from "@playwright/test";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  card,
  cards,
  CATALOGUE,
  countRequests,
  expectPinned,
  failRequests,
  FULL,
  grid,
  holdRequests,
  keyOf,
  linkOf,
  openEsplora,
  pin,
  pinFix,
  pinRemove,
  RPC,
  SOLO,
  toast,
  undoButton,
  WITH_FIDO,
  withNest,
} from "../fixtures/esplora";

// Esplora (#28): fixing and removing spaces. Criteria CA-11 ... CA-24, with the
// toast texts decided by the coordinator on 31/10 (removal, «Annulla»,
// limit of six; the limit text is the one of the designer). Every test uses its
// own throwaway Nest: the seed users never pin anything, so desktop and mobile
// never meet on the same rows.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const SIX = [
  "A tavola",
  "Noi due",
  "Stare bene",
  "Tempo insieme",
  "Passioni",
  "Casa in ordine",
];

const LIMIT_TEXT =
  "Puoi fissare al massimo sei spazi: togline uno per fissare Progetti.";

// ----------------------------------------------------------- fix and remove

test.describe("fissare e togliere", () => {
  test("CA-11: fissare Zampe preme la puntina, mostra il toast e salva una riga", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Zampe").click();
      await expect(pinRemove(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(toast(page)).toContainText("Zampe fissato in fondo a Oggi.");
      await expect(undoButton(page)).toBeVisible();
      await expectPinned(ctx, ["Zampe"]);
      const rows = await ctx.rowsOfNest();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ member_id: ctx.memberId, space: "pets" });
      await page.reload();
      await expect(pinRemove(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("CA-12: «Annulla» dopo aver fissato toglie la puntina e la riga, senza un secondo toast", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Zampe").click();
      await expect(undoButton(page)).toBeVisible();
      await expectPinned(ctx, ["Zampe"]);
      await undoButton(page).click();
      await expect(toast(page)).toHaveCount(0);
      await expect(pinFix(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expectPinned(ctx, []);
      await page.reload();
      await expect(pinFix(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });

  test("CA-13: togliere A tavola svuota la puntina, mostra il toast con «Annulla» e cancella la riga", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(["A tavola"]);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await expect(pinRemove(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await pinRemove(page, "A tavola").click();
      await expect(pinFix(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(toast(page)).toContainText("A tavola tolto da Oggi.");
      await expect(undoButton(page)).toBeVisible();
      await expectPinned(ctx, []);
      expect(await ctx.rowsOfNest()).toHaveLength(0);
    });
  });

  test("CA-14: «Annulla» dopo aver tolto rimette lo spazio in coda", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(["A tavola", "Zampe"]);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinRemove(page, "A tavola").click();
      await expectPinned(ctx, ["Zampe"]);
      await undoButton(page).click();
      await expect(pinRemove(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(toast(page)).toHaveCount(0);
      await expectPinned(ctx, ["Zampe", "A tavola"]);
    });
  });

  test("CA-15: l'ordine di fissaggio è nel database, l'ordine del catalogo resta sulla pagina", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      const order: string[] = [];
      for (const name of ["Passioni", "A tavola", "Zampe"]) {
        await pinFix(page, name).click();
        order.push(name);
        // one at a time, so that the order of pinning is the order of the clicks
        await expectPinned(ctx, order);
      }
      await page.reload();
      await expect(card(page, "A tavola")).toBeVisible();
      await expect(cards(page).locator(".scheda-modulo__titolo")).toHaveText(
        CATALOGUE,
      );
    });
  });

  test("CA-16: il toast sparisce dopo 5 secondi e la puntina resta premuta, anche dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      // The clock is stopped once the page is loaded: from here on only
      // `runFor` moves time (LEZIONI: tests with timers).
      await page.clock.install();
      await openEsplora(page, 10);
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(new Date(now + 2000));
      await pinFix(page, "Stare bene").click();
      await expect(toast(page)).toContainText(
        "Stare bene fissato in fondo a Oggi.",
      );
      await expectPinned(ctx, ["Stare bene"]);
      // the mouse must not rest on the toast (the countdown stops under it)
      await page.mouse.move(0, 0);
      await page.clock.runFor(5000);
      await expect(toast(page)).toHaveCount(0);
      await expect(pinRemove(page, "Stare bene")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.clock.resume();
      await page.reload();
      await expect(pinRemove(page, "Stare bene")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("CA-17: due tocchi di fila su Passioni salvano una sola riga", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      const unpinCalls = await countRequests(page, RPC("unpin_space"));
      // The save is held by the test, so the second touch certainly arrives
      // while the first is still being saved.
      const hold = await holdRequests(page, RPC("pin_space"));
      try {
        const button = pin(page, "Passioni");
        await button.click();
        await button.click({ noWaitAfter: true });
      } finally {
        hold.release();
      }
      await expect(pinRemove(page, "Passioni")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectPinned(ctx, ["Passioni"]);
      expect(await ctx.rowsOfNest()).toHaveLength(1);
      expect(hold.seen()).toBe(1);
      expect(unpinCalls()).toBe(0);
    });
  });

  test("CA-17: mentre una puntina salva, le altre restano usabili", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      const hold = await holdRequests(page, RPC("pin_space"));
      try {
        await pin(page, "Passioni").click();
        await pin(page, "Progetti").click({ noWaitAfter: true });
        await expect(pinRemove(page, "Progetti")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      } finally {
        hold.release();
      }
      // both saves leave together: the order between them is not defined
      await expect
        .poll(async () => [...(await ctx.pinned())].sort())
        .toEqual(["hobbies", "projects"]);
    });
  });

  test("CA-18: da tastiera, Tab sulla puntina di Progetti e Spazio la fissano", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      // The previous control in the order of the page is the link of the
      // card before: Tab leads to the pin of Progetti.
      await linkOf(page, "Casa in ordine").focus();
      await page.keyboard.press("Tab");
      await expect(pin(page, "Progetti")).toBeFocused();
      await page.keyboard.press("Space");
      await expect(pinRemove(page, "Progetti")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(toast(page)).toContainText(
        "Progetti fissato in fondo a Oggi.",
      );
      await expectPinned(ctx, ["Progetti"]);
    });
  });

  test("CA-18: anche il tasto Invio fissa e il fuoco resta sulla puntina", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pin(page, "Tempo insieme").focus();
      await page.keyboard.press("Enter");
      await expect(pinRemove(page, "Tempo insieme")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(pin(page, "Tempo insieme")).toBeFocused();
      await expectPinned(ctx, ["Tempo insieme"]);
    });
  });

  test("Toast: uno nuovo sostituisce quello visibile e «Annulla» vale per l'ultima azione", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Passioni").click();
      await expect(toast(page, "Passioni")).toBeVisible();
      await pinFix(page, "Progetti").click();
      await expect(toast(page)).toHaveCount(1);
      await expect(toast(page)).toContainText(
        "Progetti fissato in fondo a Oggi.",
      );
      await expectPinned(ctx, ["Passioni", "Progetti"]);
      await undoButton(page).click();
      await expectPinned(ctx, ["Passioni"]);
      await expect(pinFix(page, "Progetti")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(pinRemove(page, "Passioni")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});

// ---------------------------------------------------------- limit of six

test.describe("limite di sei", () => {
  test("CA-19: con sei spazi fissati il settimo non si fissa e il toast non ha «Annulla»", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(SIX);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Progetti").click();
      await expect(toast(page)).toContainText(LIMIT_TEXT);
      await expect(toast(page).getByRole("button")).toHaveCount(0);
      await expect(pinFix(page, "Progetti")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(await ctx.rowsOfNest()).toHaveLength(6);
    });
  });

  test("CA-19: se il database rifiuta il settimo (fissato da un altro dispositivo) compare lo stesso toast", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      // another device pins six spaces after the page has been opened
      await ctx.pinAll(SIX);
      await pinFix(page, "Progetti").click();
      await expect(toast(page)).toContainText(LIMIT_TEXT);
      await expect(toast(page).getByRole("button")).toHaveCount(0);
      await expect(pinFix(page, "Progetti")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(await ctx.rowsOfNest()).toHaveLength(6);
    });
  });

  test("CA-19: con sei spazi fissati le puntine restano attive e si può togliere", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(SIX);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await expect(pinFix(page, "Progetti")).toBeEnabled();
      await expect(pinFix(page, "Progetti")).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await pinRemove(page, "Passioni").click();
      await expectPinned(
        ctx,
        SIX.filter((name) => name !== "Passioni"),
      );
      await pinFix(page, "Progetti").click();
      await expect(pinRemove(page, "Progetti")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(await ctx.rowsOfNest()).toHaveLength(6);
    });
  });

  test("CA-20: il database rifiuta il settimo spazio anche chiamato direttamente", async () => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(SIX);
      const viaFunction = await ctx.user.client.rpc("pin_space", {
        p_space: keyOf("Progetti"),
      });
      expect(viaFunction.error).not.toBeNull();
      expect(viaFunction.error?.code).toBe("FN001");
      const viaInsert = await ctx.user.client
        .from("pinned_spaces")
        .insert({ space: keyOf("Progetti") });
      expect(viaInsert.error).not.toBeNull();
      expect(await ctx.rowsOfNest()).toHaveLength(6);
    });
  });

  test("CA-21: uno spazio fissato non più disponibile sparisce, non conta nei sei e ricompare", async ({
    page,
    baseURL,
  }) => {
    await withNest(WITH_FIDO, async (ctx) => {
      await ctx.pinAll([
        "Zampe",
        "A tavola",
        "Noi due",
        "Stare bene",
        "Tempo insieme",
        "Passioni",
      ]);
      // Fido leaves the Nest: no animals, so Zampe is no longer available
      const fido = ctx.nest.members["Fido"]!;
      const removed = await ctx.user.admin
        .from("household_members")
        .delete()
        .eq("id", fido);
      expect(removed.error).toBeNull();

      await ctx.signIn(page, baseURL);
      await openEsplora(page, 9);
      await expect(card(page, "Zampe")).toHaveCount(0);
      for (const name of [
        "A tavola",
        "Noi due",
        "Stare bene",
        "Tempo insieme",
        "Passioni",
      ]) {
        await expect(pin(page, name)).toHaveAttribute("aria-pressed", "true");
      }
      // five available pinned spaces: a sixth is accepted
      await pinFix(page, "Casa in ordine").click();
      await expect(toast(page)).toContainText(
        "Casa in ordine fissato in fondo a Oggi.",
      );
      await expect(pinRemove(page, "Casa in ordine")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // a new animal arrives: Zampe is back, still pinned (seven rows)
      const added = await ctx.user.admin.from("household_members").insert({
        household_id: ctx.nest.householdId,
        kind: "pet",
        name: "Micia",
        color: "lampone",
      });
      expect(added.error).toBeNull();
      await page.reload();
      await expect(card(page, "Zampe")).toBeVisible();
      await expect(pinRemove(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(await ctx.rowsOfNest()).toHaveLength(7);
      await expect(
        grid(page).getByRole("button", { pressed: true }),
      ).toHaveCount(7);
    });
  });

  test("CA-22: il database rifiuta Zampe a un Nest «Solo io» anche chiamato direttamente", async () => {
    await withNest(SOLO, async (ctx) => {
      const viaFunction = await ctx.user.client.rpc("pin_space", {
        p_space: "pets",
      });
      expect(viaFunction.error).not.toBeNull();
      expect(viaFunction.error?.code).toBe("FN002");
      const viaInsert = await ctx.user.client
        .from("pinned_spaces")
        .insert({ space: "pets" });
      expect(viaInsert.error).not.toBeNull();
      expect(await ctx.rowsOfNest()).toHaveLength(0);
    });
  });
});

// ----------------------------------------------------------------- errors

test.describe("errori nel salvataggio", () => {
  test("CA-23: se il salvataggio di «fissa» fallisce, la puntina torna com'era e il toast non ha «Annulla»", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await failRequests(page, RPC("pin_space"));
      await pinFix(page, "Zampe").click();
      await expect(toast(page)).toContainText(
        "Non siamo riusciti a fissare Zampe. Riprova tra qualche secondo.",
      );
      await expect(toast(page).getByRole("button")).toHaveCount(0);
      await expect(pinFix(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(await ctx.rowsOfNest()).toHaveLength(0);
    });
  });

  test("CA-24: se la cancellazione fallisce, la puntina resta premuta e la riga c'è ancora", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(["A tavola"]);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await failRequests(page, RPC("unpin_space"));
      await pinRemove(page, "A tavola").click();
      await expect(toast(page)).toContainText(
        "Non siamo riusciti a togliere A tavola. Riprova tra qualche secondo.",
      );
      await expect(toast(page).getByRole("button")).toHaveCount(0);
      await expect(pinRemove(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectPinned(ctx, ["A tavola"]);
    });
  });

  test("Annulla non riuscito dopo aver fissato: Zampe resta in Oggi", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinFix(page, "Zampe").click();
      await expectPinned(ctx, ["Zampe"]);
      await failRequests(page, RPC("unpin_space"));
      await undoButton(page).click();
      await expect(toast(page)).toContainText(
        "Non siamo riusciti ad annullare: Zampe resta in Oggi.",
      );
      // the pin shows the real state, which is the saved one
      await expect(pinRemove(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectPinned(ctx, ["Zampe"]);
    });
  });

  test("Annulla non riuscito dopo aver tolto: A tavola non è più in Oggi", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(["A tavola"]);
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await pinRemove(page, "A tavola").click();
      await expectPinned(ctx, []);
      await failRequests(page, RPC("pin_space"));
      await undoButton(page).click();
      await expect(toast(page)).toContainText(
        "Non siamo riusciti ad annullare: A tavola non è più in Oggi.",
      );
      await expect(pinFix(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expectPinned(ctx, []);
    });
  });

  test("Dopo un errore la stessa puntina si può riprovare", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openEsplora(page, 10);
      await failRequests(page, RPC("pin_space"));
      await pinFix(page, "Zampe").click();
      await expect(toast(page)).toContainText("Non siamo riusciti a fissare");
      await page.unroute(RPC("pin_space"));
      await pinFix(page, "Zampe").click();
      await expect(pinRemove(page, "Zampe")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectPinned(ctx, ["Zampe"]);
    });
  });
});
