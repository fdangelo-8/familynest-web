import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  countRequests,
  expectPinned,
  failRequests,
  FULL,
  holdRequests,
  joinWithInvitation,
  openEsplora,
  pinRemove,
  RPC,
  seedClient,
  SOLO,
  toast,
  undoButton,
  withNest,
} from "../fixtures/esplora";
import {
  addInterest,
  ADD_RPC,
  askButton,
  backgroundOf,
  barPin,
  doneButton,
  interestRows,
  interestToggle,
  inkColor,
  openSpace,
  REMOVE_RPC,
} from "../fixtures/esplora-spazio";

// Esplora · «In arrivo» (#29): «Avvisami quando è pronto», the puntina of the
// bar and the isolation of the data. Criteria CA-8 ... CA-17, CA-19 ... CA-22
// and CA-30 ... CA-34. Every test uses its own throwaway user and Nest, deleted
// at the end (the seed users never register an interest), so desktop and mobile
// never meet on the same rows.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

const isMobile = (project: string) => project === "mobile";
const PUNTINA_REASON = "La puntina c'è solo su mobile (390 px)";

// ------------------------------------------------------------------ Avvisami

test.describe("avvisami", () => {
  test("CA-8: toccare «Avvisami» lo registra: bottone premuto, toast senza «Annulla», una riga, resta dopo il ricaricamento", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await askButton(page).click();
      await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
      await expect(
        toast(page, "Ti avvisiamo quando A tavola è pronto."),
      ).toBeVisible();
      await expect(undoButton(page)).toHaveCount(0);
      await expect
        .poll(async () => interestRows(ctx))
        .toEqual([{ member_id: ctx.memberId, space: "meals" }]);
      await page.reload();
      await expect(doneButton(page)).toBeVisible();
      await expect(askButton(page)).toHaveCount(0);
    });
  });

  test("CA-9: toccare «Ti avvisiamo appena è pronto» toglie l'avviso", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "meals");
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
      await doneButton(page).click();
      await expect(askButton(page)).toHaveAttribute("aria-pressed", "false");
      await expect(
        toast(page, "Non ti avvisiamo più per A tavola."),
      ).toBeVisible();
      await expect(undoButton(page)).toHaveCount(0);
      await expect.poll(async () => interestRows(ctx)).toEqual([]);
      await page.reload();
      await expect(askButton(page)).toBeVisible();
      await expect(doneButton(page)).toHaveCount(0);
    });
  });

  test("CA-10: due tocchi di fila salvano una sola riga", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "Passioni");
      const removeCalls = await countRequests(page, REMOVE_RPC);
      // The save is held by the test, so the second touch certainly arrives
      // while the first is still being saved.
      const hold = await holdRequests(page, ADD_RPC);
      try {
        const button = interestToggle(page);
        await button.click();
        // the button is busy (aria-disabled): the second touch is a real
        // click event on it, without waiting for it to become enabled
        await expect(button).toHaveAttribute("aria-busy", "true");
        await button.dispatchEvent("click");
      } finally {
        hold.release();
      }
      await expect(doneButton(page)).toBeVisible();
      await expect
        .poll(async () => interestRows(ctx))
        .toEqual([{ member_id: ctx.memberId, space: "hobbies" }]);
      expect(hold.seen()).toBe(1);
      expect(removeCalls()).toBe(0);
    });
  });

  test("CA-11: da tastiera Invio registra e Spazio toglie, con il fuoco sempre sul bottone", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "Progetti");
      const target = interestToggle(page);
      let reached = false;
      for (let step = 0; step < 25 && !reached; step += 1) {
        await page.keyboard.press("Tab");
        reached = await target.evaluate(
          (node) => node === document.activeElement,
        );
      }
      await expect(target).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(doneButton(page)).toBeVisible();
      await expect(doneButton(page)).toBeFocused();
      await expect(
        toast(page, "Ti avvisiamo quando Progetti è pronto."),
      ).toBeVisible();
      await page.keyboard.press("Space");
      await expect(askButton(page)).toBeVisible();
      await expect(askButton(page)).toBeFocused();
      await expect.poll(async () => interestRows(ctx)).toEqual([]);
    });
  });

  test("CA-12: «Avvisami» e la puntina sono indipendenti", async ({
    page,
    baseURL,
  }, testInfo) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await askButton(page).click();
      await expect(doneButton(page)).toBeVisible();
      await expect.poll(async () => (await interestRows(ctx)).length).toBe(1);
      expect(await ctx.rowsOfNest()).toHaveLength(0);
      if (!isMobile(testInfo.project.name)) return; // the puntina is only on mobile
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
      await barPin(page).click();
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "true");
      await expectPinned(ctx, ["A tavola"]);
      expect(await interestRows(ctx)).toEqual([
        { member_id: ctx.memberId, space: "meals" },
      ]);
    });
  });

  test("CA-13: l'avviso vale per lo spazio: un altro spazio resta «Avvisami»", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "wellbeing");
      await ctx.signIn(page, baseURL);
      await openSpace(page, "Tempo insieme");
      await expect(askButton(page)).toHaveAttribute("aria-pressed", "false");
      await openSpace(page, "Stare bene");
      await expect(doneButton(page)).toBeVisible();
    });
  });

  test("CA-14: se il salvataggio fallisce il bottone resta com'era e il toast lo dice", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await failRequests(page, ADD_RPC);
      await askButton(page).click();
      await expect(
        toast(
          page,
          "Non siamo riusciti ad attivare l'avviso per A tavola. Riprova tra qualche secondo.",
        ),
      ).toBeVisible();
      await expect(undoButton(page)).toHaveCount(0);
      await expect(askButton(page)).toHaveAttribute("aria-pressed", "false");
      await expect(askButton(page)).not.toHaveAttribute("aria-busy", "true");
      expect(await interestRows(ctx)).toEqual([]);
    });
  });

  test("CA-15: se la cancellazione fallisce il bottone resta registrato e la riga c'è ancora", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "meals");
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await failRequests(page, REMOVE_RPC);
      await doneButton(page).click();
      await expect(
        toast(
          page,
          "Non siamo riusciti a togliere l'avviso per A tavola. Riprova tra qualche secondo.",
        ),
      ).toBeVisible();
      await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
      expect(await interestRows(ctx)).toEqual([
        { member_id: ctx.memberId, space: "meals" },
      ]);
    });
  });

  test("CA-16: il database rifiuta l'avviso per uno spazio non disponibile", async () => {
    await withNest(SOLO, async (ctx) => {
      const { error } = await ctx.user.client.rpc("add_space_interest", {
        p_space: "pets",
      });
      expect(error).not.toBeNull();
      expect(await interestRows(ctx)).toEqual([]);
    });
  });

  test("CA-17: il toast sparisce dopo 5 secondi e il bottone resta registrato", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      // The clock is stopped once the page is loaded: from here on only
      // `runFor` moves time (LEZIONI: tests with timers).
      await page.clock.install();
      await openSpace(page, "A tavola");
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(new Date(now + 2000));
      await askButton(page).click();
      await expect(
        toast(page, "Ti avvisiamo quando A tavola è pronto."),
      ).toBeVisible();
      await expect.poll(async () => (await interestRows(ctx)).length).toBe(1);
      // the mouse must not rest on the toast (the countdown stops under it)
      await page.mouse.move(0, 0);
      await page.clock.runFor(5000);
      await expect(toast(page)).toHaveCount(0);
      await expect(doneButton(page)).toBeVisible();
    });
  });
});

// ------------------------------------------------------------ puntina (mobile)

test.describe("puntina su mobile", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), PUNTINA_REASON);
  });

  test("CA-19: fissare A tavola preme la puntina, la riempie, salva una riga ed è premuta anche in Esplora", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      const before = await backgroundOf(barPin(page));
      const ink = await inkColor(page);
      expect(before).not.toBe(ink);
      await barPin(page).click();
      await expect(
        page.getByRole("button", {
          name: "Togli A tavola da Oggi",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        toast(page, "A tavola fissato in fondo a Oggi."),
      ).toBeVisible();
      await expect(undoButton(page)).toBeVisible();
      await page.mouse.move(0, 0);
      await expect.poll(() => backgroundOf(barPin(page))).toBe(ink);
      await expectPinned(ctx, ["A tavola"]);
      expect(await ctx.rowsOfNest()).toEqual([
        { member_id: ctx.memberId, space: "meals" },
      ]);
      await openEsplora(page, 6);
      await expect(pinRemove(page, "A tavola")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  test("CA-20: togliere dalla pagina e «Annulla» rimettono lo spazio", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.pinAll(["A tavola"]);
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "true");
      await barPin(page).click();
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
      await expect(toast(page, "A tavola tolto da Oggi.")).toBeVisible();
      await expect(undoButton(page)).toBeVisible();
      await expectPinned(ctx, []);
      await undoButton(page).click();
      await expect(toast(page)).toHaveCount(0);
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "true");
      await expectPinned(ctx, ["A tavola"]);
      expect(await ctx.rowsOfNest()).toHaveLength(1);
    });
  });

  test("CA-21: con sei spazi fissati il settimo non si fissa e il toast lo spiega", async ({
    page,
    baseURL,
  }) => {
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll([
        "A tavola",
        "Noi due",
        "Stare bene",
        "Tempo insieme",
        "Passioni",
        "Casa in ordine",
      ]);
      await ctx.signIn(page, baseURL);
      await openSpace(page, "Progetti");
      await expect(
        page.getByRole("button", {
          name: "Fissa Progetti in Oggi",
          exact: true,
        }),
      ).toBeVisible();
      await barPin(page).click();
      await expect(
        toast(
          page,
          "Puoi fissare al massimo sei spazi: togline uno per fissare Progetti.",
        ),
      ).toBeVisible();
      await expect(undoButton(page)).toHaveCount(0);
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
      expect(await ctx.rowsOfNest()).toHaveLength(6);
    });
  });

  test("CA-22: se il fissaggio fallisce la puntina torna com'era e il toast lo dice", async ({
    page,
    baseURL,
  }) => {
    await withNest(SOLO, async (ctx) => {
      await ctx.signIn(page, baseURL);
      await openSpace(page, "A tavola");
      await failRequests(page, RPC("pin_space"));
      await barPin(page).click();
      await expect(
        toast(
          page,
          "Non siamo riusciti a fissare A tavola. Riprova tra qualche secondo.",
        ),
      ).toBeVisible();
      await expect(undoButton(page)).toHaveCount(0);
      await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
      expect(await ctx.rowsOfNest()).toEqual([]);
    });
  });
});

// ------------------------------------------------------- isolation and privacy

test.describe("isolamento e privacy", () => {
  test("CA-30: Marco (altro Nest) non vede l'avviso né la puntina di un altro Nest", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "meals");
      await ctx.pinAll(["A tavola"]);
      await signInAs(page.context(), baseURL as string, "A");
      await openSpace(page, "A tavola");
      await expect(askButton(page)).toHaveAttribute("aria-pressed", "false");
      if (isMobile(testInfo.project.name)) {
        await expect(barPin(page)).toHaveAttribute("aria-pressed", "false");
      }
      const marco = await seedClient("A");
      const all = await marco.from("space_interests").select("*");
      expect(all.error).toBeNull();
      expect(all.data ?? []).toEqual([]);
      const other = await marco
        .from("space_interests")
        .select("space")
        .eq("household_id", ctx.nest.householdId);
      expect(other.data ?? []).toEqual([]);
    });
  });

  test("CA-31: due adulti dello stesso Nest hanno avvisi personali", async ({
    browser,
    baseURL,
  }, testInfo) => {
    await withNest(SOLO, async (ctx) => {
      const second = await joinWithInvitation(ctx, "Rita", "cannella");
      const viewport = testInfo.project.use.viewport ?? undefined;
      const firstContext = await browser.newContext({ baseURL, viewport });
      const secondContext = await browser.newContext({ baseURL, viewport });
      try {
        await addInterest(ctx, "meals");
        await ctx.nest.signInContext(firstContext, baseURL, "Ilaria");
        await second.user.signInContext(secondContext, baseURL as string);
        const firstPage = await firstContext.newPage();
        const secondPage = await secondContext.newPage();

        // Rita does not see the interest of Ilaria...
        await openSpace(secondPage, "A tavola");
        await expect(askButton(secondPage)).toHaveAttribute(
          "aria-pressed",
          "false",
        );
        // ... and her client does not receive that row
        const mine = await second.user.client
          .from("space_interests")
          .select("member_id, space");
        expect(mine.error).toBeNull();
        expect(mine.data ?? []).toEqual([]);

        // what Rita registers does not change the page of Ilaria
        const { error } = await second.user.client.rpc("add_space_interest", {
          p_space: "hobbies",
        });
        expect(error).toBeNull();
        await openSpace(firstPage, "Passioni");
        await expect(askButton(firstPage)).toHaveAttribute(
          "aria-pressed",
          "false",
        );
      } finally {
        await firstContext.close();
        await secondContext.close();
        await second.user.remove();
      }
    });
  });

  test("CA-32: chi esce dal Nest o cancella l'account perde i suoi avvisi", async () => {
    await withNest(SOLO, async (ctx) => {
      const second = await joinWithInvitation(ctx, "Rita", "cannella");
      try {
        const { error } = await second.user.client.rpc("add_space_interest", {
          p_space: "hobbies",
        });
        expect(error).toBeNull();
        await addInterest(ctx, "meals");
        expect(await interestRows(ctx)).toHaveLength(2);

        // the administrator takes Rita out of the Nest
        const removed = await ctx.user.client
          .from("household_members")
          .delete()
          .eq("id", second.memberId);
        expect(removed.error).toBeNull();
        const rows = await interestRows(ctx);
        expect(rows.filter((row) => row.member_id === second.memberId)).toEqual(
          [],
        );
        expect(rows).toEqual([{ member_id: ctx.memberId, space: "meals" }]);
      } finally {
        await second.user.remove();
      }
    });
  });

  test("CA-32: cancellando l'account non resta nessuna riga", async () => {
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "meals");
      expect(await interestRows(ctx)).toHaveLength(1);
      const admin = ctx.user.admin;
      await ctx.user.remove();
      const { data, error } = await admin
        .from("space_interests")
        .select("member_id")
        .eq("member_id", ctx.memberId);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });
  });

  test("CA-33: senza sessione non si legge né si scrive", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const read = await anon.from("space_interests").select("*");
    expect(read.data ?? []).toEqual([]);
    for (const call of [
      () => anon.rpc("add_space_interest", { p_space: "meals" }),
      () => anon.rpc("remove_space_interest", { p_space: "meals" }),
      () => anon.rpc("space_interest_counts"),
    ]) {
      const { error } = await call();
      expect(error).not.toBeNull();
    }
  });

  test("CA-34: il conteggio ha solo numeri per la chiave amministrativa e un errore per l'utente", async () => {
    await withNest(SOLO, async (ctx) => {
      await addInterest(ctx, "meals");
      const counts = await ctx.user.admin.rpc("space_interest_counts");
      expect(counts.error).toBeNull();
      const rows = (counts.data ?? []) as {
        space: string;
        adults: number;
        households: number;
      }[];
      const meals = rows.filter((row) => row.space === "meals");
      expect(meals).toHaveLength(1);
      expect(meals[0]!.adults).toBeGreaterThanOrEqual(1);
      expect(meals[0]!.households).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual([
          "adults",
          "households",
          "space",
        ]);
      }
      const asUser = await ctx.user.client.rpc("space_interest_counts");
      expect(asUser.error).not.toBeNull();
    });
  });
});
