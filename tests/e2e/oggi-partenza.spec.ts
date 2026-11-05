import type { Page } from "@playwright/test";
import { buildNest, type CasaNest, type MemberSpec } from "../fixtures/casa";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import {
  expect,
  expectAccessible,
  NOW,
  h1,
  open,
  reopen,
  sec,
  test,
} from "../fixtures/oggi";

// Oggi (#30): lista di partenza e primo accesso di chi è stato invitato
// (CA-31 ... CA-34, CA-50, CA-51). Every test builds its own throwaway Nest
// and users (deleted at the end); the starter list is open in these Nests.

test.use({ locale: "it-IT", timezoneId: "Europe/Rome" });

const GIULIA: MemberSpec = {
  name: "Giulia",
  kind: "adult",
  color: "pomodoro",
  account: true,
};
const BEA: MemberSpec = { name: "Bea", kind: "adult", color: "salvia" };
const LUCA: MemberSpec = { name: "Luca", kind: "adult", color: "cobalto" };

const SUMMARY = "La casa in una frase";

type Ctx = { nest: CasaNest; owner: ThrowawayUser };

async function withStarterNest(
  specs: MemberSpec[],
  body: (ctx: Ctx) => Promise<void>,
): Promise<void> {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  const { nest, cleanup } = await buildNest("Casa di Giulia", specs);
  try {
    await body({ nest, owner: nest.users["Giulia"]! });
  } finally {
    await cleanup();
  }
}

/** Invites a member of the Nest who has no account yet; returns the token. */
async function invite(
  { nest, owner }: Ctx,
  memberName: string,
  invitedBy = "Giulia",
): Promise<string> {
  const { data, error } = await owner.admin
    .from("invitations")
    .insert({
      household_id: nest.householdId,
      member_id: nest.members[memberName]!,
      invited_by_member_id: nest.members[invitedBy]!,
    })
    .select("token")
    .single();
  if (error || !data) throw new Error("Invito di prova non creato");
  return data.token as string;
}

/** Adds an adult without an account to the Nest, as the invitation of the real flow expects. */
async function addMember(
  { nest, owner }: Ctx,
  name: string,
  color: string,
): Promise<void> {
  const { data, error } = await owner.admin
    .from("household_members")
    .insert({
      household_id: nest.householdId,
      kind: "adult",
      name,
      color,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Membro invitato non aggiunto");
  nest.members[name] = data.id as string;
}

/** The invited member creates an account and accepts the invitation (as in the real flow). */
async function accept(
  ctx: Ctx,
  memberName: string,
  token: string,
): Promise<ThrowawayUser> {
  const user = await createThrowawayUser(memberName);
  try {
    const { error } = await user.client.rpc("accept_invitation", { token });
    if (error) throw new Error("Invito di prova non accettato");
  } catch (error) {
    await user.remove();
    throw error;
  }
  // The page signs in through the Nest: it only needs the user.
  ctx.nest.users[memberName] = user;
  return user;
}

const starter = (page: Page, title: string) => sec(page, title);

async function addAndRemoveFirstItem(ctx: Ctx) {
  const { error } = await ctx.owner.client
    .from("shopping_items")
    .insert({ name: "Latte" });
  if (error) throw new Error("Cosa da prendere non aggiunta");
  const { error: removeError } = await ctx.owner.admin
    .from("shopping_items")
    .delete()
    .eq("household_id", ctx.nest.householdId);
  if (removeError) throw new Error("Cosa da prendere non tolta");
}

test.describe("lista di partenza", () => {
  test("CA-31: la lista dice «Per cominciare», «1 di 3», «Tre cose e la casa è pronta» e ha i tre passi, senza «Collega il tuo calendario»", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA, BEA], async (ctx) => {
      await invite(ctx, "Bea");
      await open(page, baseURL, ctx.nest, "Giulia");
      const list = starter(page, "Tre cose e la casa è pronta");
      await expect(list).toBeVisible();
      await expect(list).toContainText("Per cominciare");
      await expect(list).toContainText("1 di 3");
      const steps = list.getByRole("listitem");
      await expect(steps).toHaveCount(3);
      await expect(steps.nth(0)).toContainText("Crea il Nest");
      await expect(steps.nth(0)).toContainText(", fatto");
      await expect(steps.nth(0).getByRole("link")).toHaveCount(0);
      await expect(steps.nth(1)).toContainText(
        "Scrivi la prima cosa da comprare",
      );
      await expect(
        list.getByRole("link", { name: /Scrivi la prima cosa da comprare/ }),
      ).toHaveAttribute("href", "/casa/spesa");
      await expect(steps.nth(2)).toContainText("Aspetta che Bea entri");
      await expect(steps.nth(2)).toContainText("Invito inviato");
      await expect(list.getByRole("link", { name: /Aspetta/ })).toHaveCount(0);
      await expect(list).not.toContainText("Collega il tuo calendario");
    });
  });

  test("CA-32: con la prima cosa aggiunta e tolta il passo è «fatto», resta un link e la testa dice «2 di 3»", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA, BEA], async (ctx) => {
      await invite(ctx, "Bea");
      await addAndRemoveFirstItem(ctx);
      await open(page, baseURL, ctx.nest, "Giulia");
      const list = starter(page, "Tre cose e la casa è pronta");
      await expect(list).toContainText("2 di 3");
      const step = list.getByRole("link", {
        name: /Scrivi la prima cosa da comprare/,
      });
      await expect(step).toContainText(", fatto");
      await expect(step).toHaveAttribute("href", "/casa/spesa");
      await expect(list).toContainText("Aspetta che Bea entri");
    });
  });

  test("CA-33: «Solo io» ha «1 di 2», «Due cose…» e nessun passo «Aspetta che…»; aggiunta la prima cosa la lista si chiude e non ricompare", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA], async (ctx) => {
      await open(page, baseURL, ctx.nest, "Giulia");
      const list = starter(page, "Due cose e la casa è pronta");
      await expect(list).toContainText("Per cominciare");
      await expect(list).toContainText("1 di 2");
      await expect(list).not.toContainText("Aspetta che");

      const { error } = await ctx.owner.client
        .from("shopping_items")
        .insert({ name: "Latte" });
      if (error) throw new Error("Cosa da prendere non aggiunta");
      await reopen(page);
      await expect(starter(page, "Due cose e la casa è pronta")).toHaveCount(0);
      await expect(page.getByText("Per cominciare")).toHaveCount(0);
      // The database has been asked to close it.
      await expect
        .poll(async () => {
          const { data } = await ctx.owner.admin
            .from("households")
            .select("starter_list_completed_at")
            .eq("id", ctx.nest.householdId)
            .single();
          return data?.starter_list_completed_at ?? null;
        })
        .not.toBeNull();

      await reopen(page);
      await expect(starter(page, "Due cose e la casa è pronta")).toHaveCount(0);
      await expect(page.getByText("Per cominciare")).toHaveCount(0);
    });
  });

  test("CA-50: con un invito scaduto la lista non ha il passo «Aspetta che Bea entri» e dice «1 di 2»", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA, BEA], async (ctx) => {
      await invite(ctx, "Bea");
      const { error } = await ctx.owner.admin
        .from("invitations")
        .update({
          // Before the stopped clock of the page (last Tuesday), not only before now.
          expires_at: new Date(NOW.getTime() - 24 * 3600 * 1000).toISOString(),
        })
        .eq("household_id", ctx.nest.householdId);
      if (error) throw new Error("Scadenza dell'invito di prova non scritta");
      await open(page, baseURL, ctx.nest, "Giulia");
      const list = starter(page, "Due cose e la casa è pronta");
      await expect(list).toBeVisible();
      await expect(list).toContainText("1 di 2");
      await expect(list).not.toContainText("Aspetta che Bea entri");
      await expect(list).not.toContainText("Invito inviato");
    });
  });
});

test.describe("primo accesso di chi è stato invitato", () => {
  test("CA-34: l'invitato vede «Eccoti, Bea» e «La casa in una frase» con «Da Giulia», «Sintesi» e «Mancano 4 cose dalla spesa.»; chi ha invitato no", async ({
    page,
    browser,
    baseURL,
  }) => {
    await withStarterNest([GIULIA], async (ctx) => {
      await ctx.nest.shopping("Giulia", ["Latte", "Pane", "Mele", "Uova"]);
      await addMember(ctx, "Bea", "salvia");
      const token = await invite(ctx, "Bea");
      const bea = await accept(ctx, "Bea", token);
      try {
        await open(page, baseURL, ctx.nest, "Bea", { lens: "io" });
        await expect(h1(page)).toContainText("Eccoti,");
        await expect(h1(page)).toContainText("Bea");
        const summary = sec(page, SUMMARY);
        await expect(summary).toBeVisible();
        await expect(summary).toContainText("Da Giulia");
        await expect(summary).toContainText("Sintesi");
        await expect(summary).toContainText("Mancano 4 cose dalla spesa.");
        await expect(
          summary.getByRole("link", { name: "Vedi la settimana" }),
        ).toHaveAttribute("href", "/calendario");
        await expect(page.getByText("Per cominciare")).toHaveCount(0);

        // Who sent the invitation does not see the card.
        const other = await browser.newContext({
          baseURL,
          viewport: page.viewportSize() ?? undefined,
          locale: "it-IT",
          timezoneId: "Europe/Rome",
        });
        try {
          await ctx.nest.signInContext(other, baseURL, "Giulia");
          const owner = await other.newPage();
          await owner.goto("/oggi");
          await expect(h1(owner)).toBeVisible({ timeout: 20_000 });
          await expect(owner.locator('[aria-busy="true"]')).toHaveCount(0);
          await expect(sec(owner, SUMMARY)).toHaveCount(0);
          await expect(h1(owner)).not.toContainText("Eccoti");
        } finally {
          await other.close();
        }
      } finally {
        await bea.remove();
      }
    });
  });

  test("CA-51: in un Nest senza spesa e senza impegni la frase è quella di riserva", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA, BEA], async (ctx) => {
      const token = await invite(ctx, "Bea");
      const bea = await accept(ctx, "Bea", token);
      try {
        await open(page, baseURL, ctx.nest, "Bea", { lens: "io" });
        const summary = sec(page, SUMMARY);
        await expect(summary).toBeVisible();
        await expect(summary).toContainText("Da Giulia");
        await expect(summary).toContainText(
          "Per ora la casa è tranquilla: niente in programma e niente da comprare.",
        );
      } finally {
        await bea.remove();
      }
    });
  });

  test("CA-51: se chi ha invitato è uscito dal Nest la scheda ha «Sintesi» e non ha «Da …»", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA, LUCA, BEA], async (ctx) => {
      const token = await invite(ctx, "Bea", "Luca");
      const bea = await accept(ctx, "Bea", token);
      try {
        const { error } = await ctx.owner.admin
          .from("household_members")
          .delete()
          .eq("id", ctx.nest.members["Luca"]!);
        if (error) throw new Error("Membro di prova non tolto");
        await open(page, baseURL, ctx.nest, "Bea", { lens: "io" });
        const summary = sec(page, SUMMARY);
        await expect(summary).toBeVisible();
        await expect(summary).toContainText("Sintesi");
        await expect(summary).not.toContainText(/\bDa\b/);
      } finally {
        await bea.remove();
      }
    });
  });
});

test.describe("accessibilità", () => {
  test("CA-41: axe sulla lista di partenza", async ({ page, baseURL }) => {
    await withStarterNest([GIULIA, BEA], async (ctx) => {
      await invite(ctx, "Bea");
      await open(page, baseURL, ctx.nest, "Giulia");
      await expect(starter(page, "Tre cose e la casa è pronta")).toBeVisible();
      await expectAccessible(page, "lista di partenza");
    });
  });

  test("CA-41: axe sul primo accesso dell'invitato", async ({
    page,
    baseURL,
  }) => {
    await withStarterNest([GIULIA], async (ctx) => {
      await ctx.nest.shopping("Giulia", ["Latte", "Pane"]);
      await addMember(ctx, "Bea", "salvia");
      const token = await invite(ctx, "Bea");
      const bea = await accept(ctx, "Bea", token);
      try {
        await open(page, baseURL, ctx.nest, "Bea", { lens: "io" });
        await expect(sec(page, SUMMARY)).toBeVisible();
        await expectAccessible(page, "primo accesso");
      } finally {
        await bea.remove();
      }
    });
  });
});
