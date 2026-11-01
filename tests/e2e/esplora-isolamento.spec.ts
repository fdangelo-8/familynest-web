import { expect, test } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";
import {
  expectPinned,
  FULL,
  joinWithInvitation,
  openEsplora,
  pin,
  pins,
  seedClient,
  withNest,
} from "../fixtures/esplora";

// Esplora (#28): isolation between Nests and between adults of the same Nest.
// Criteria CA-30 ... CA-32. The pinned spaces are personal (decision 1 of the
// coordinator, 31/10). Marco (seed) only reads.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

test.beforeEach(() => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
});

test.describe("isolamento", () => {
  test("CA-30: Marco (altro Nest) non vede gli spazi fissati di un altro Nest", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    await withNest(FULL, async (ctx) => {
      await ctx.pinAll(["Zampe", "A tavola"]);
      await expectPinned(ctx, ["Zampe", "A tavola"]);

      await signInAs(page.context(), baseURL as string, "A");
      await openEsplora(page, 10);
      await expect(pins(page)).toHaveCount(10);
      for (const button of await pins(page).all()) {
        await expect(button).toHaveAttribute("aria-pressed", "false");
      }

      // and the client of Marco does not receive any row of the other Nest
      const marco = await seedClient("A");
      const { data, error } = await marco.from("pinned_spaces").select("*");
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
      const other = await marco
        .from("pinned_spaces")
        .select("space")
        .eq("household_id", ctx.nest.householdId);
      expect(other.data ?? []).toEqual([]);
    });
  });

  test("CA-31: due adulti dello stesso Nest hanno spazi fissati personali", async ({
    browser,
    baseURL,
  }, testInfo) => {
    await withNest(FULL, async (ctx) => {
      const second = await joinWithInvitation(ctx, "Rita", "cannella");
      const viewport = testInfo.project.use.viewport ?? undefined;
      const firstContext = await browser.newContext({ baseURL, viewport });
      const secondContext = await browser.newContext({ baseURL, viewport });
      try {
        await ctx.pinAll(["A tavola"]);
        await second.user.signInContext(secondContext, baseURL as string);
        await ctx.nest.signInContext(firstContext, baseURL, "Ilaria");
        const secondPage = await secondContext.newPage();
        await openEsplora(secondPage, 10);

        // Rita does not see the A tavola of Ilaria...
        await expect(pin(secondPage, "A tavola")).toHaveAttribute(
          "aria-pressed",
          "false",
        );
        // ... and her client does not receive that row
        const mine = await second.user.client
          .from("pinned_spaces")
          .select("space");
        expect(mine.error).toBeNull();
        expect(mine.data ?? []).toEqual([]);

        // Rita pins Passioni
        await pin(secondPage, "Passioni").click();
        await expect(pin(secondPage, "Passioni")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect
          .poll(async () => {
            const { data } = await second.user.client
              .from("pinned_spaces")
              .select("space");
            return (data ?? []).map((row) => row.space);
          })
          .toEqual(["hobbies"]);

        // Ilaria, reloading, still sees A tavola pinned and Passioni not
        const firstPage = await firstContext.newPage();
        await openEsplora(firstPage, 10);
        await expect(pin(firstPage, "A tavola")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(pin(firstPage, "Passioni")).toHaveAttribute(
          "aria-pressed",
          "false",
        );
        await expectPinned(ctx, ["A tavola"]);
      } finally {
        await firstContext.close();
        await secondContext.close();
        await second.user.remove();
      }
    });
  });

  test("CA-32: chi esce dal Nest perde i suoi spazi fissati", async () => {
    await withNest(FULL, async (ctx) => {
      const second = await joinWithInvitation(ctx, "Rita", "cannella");
      try {
        const pinned = await second.user.client.rpc("pin_space", {
          p_space: "hobbies",
        });
        expect(pinned.error).toBeNull();
        const before = await ctx.user.admin
          .from("pinned_spaces")
          .select("space")
          .eq("member_id", second.memberId);
        expect(before.data ?? []).toHaveLength(1);

        // the administrator takes Rita out of the Nest
        const removed = await ctx.user.admin
          .from("household_members")
          .delete()
          .eq("id", second.memberId);
        expect(removed.error).toBeNull();

        const after = await ctx.user.admin
          .from("pinned_spaces")
          .select("space")
          .eq("member_id", second.memberId);
        expect(after.error).toBeNull();
        expect(after.data ?? []).toEqual([]);
      } finally {
        await second.user.remove();
      }
    });
  });
});
