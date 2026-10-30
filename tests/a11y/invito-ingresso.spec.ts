import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs, skipReason, usersConfigured } from "../fixtures/auth";
import {
  colorPageReady,
  h1,
  lauraInvite,
  linkOf,
} from "../fixtures/invito-ingresso";

// Accessibility of the invitation pages (#16, CA-34), at 390 and 1280 px (the
// two projects): no duplicate id and no serious or critical axe violation in
// the four states: 07 normal, 07 error, 07 «Sei già in un altro Nest» and 08.
// The seed users only read.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});

async function expectNoBlocking(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations
      .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

async function expectNoDuplicateIds(page: Page) {
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
}

async function expectAccessible(page: Page) {
  await expect(h1(page)).toBeVisible();
  await expectNoDuplicateIds(page);
  await expectNoBlocking(page);
}

test.describe("ingresso con invito: accessibilità", () => {
  test("CA-34: 07 normale, senza id duplicati né violazioni axe", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A"), skipReason("A"));
    const laura = await lauraInvite();
    await page.goto(linkOf(new URL(baseURL as string).origin, laura.token));
    await expect(
      page.getByRole("button", { name: "Entra con Google" }),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-34: 07 errore, senza id duplicati né violazioni axe", async ({
    page,
  }) => {
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase non impostato");
    await page.goto("/invito");
    await expect(
      page.getByRole("link", { name: "Entra in FamilyNest" }),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-34: 07 «Sei già in un altro Nest», senza id duplicati né violazioni axe", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "B");
    await page.goto(linkOf(new URL(baseURL as string).origin, laura.token));
    await expect(page.getByRole("link", { name: "Vai a Oggi" })).toBeVisible();
    await expectAccessible(page);
  });

  test("CA-34: 08 il tuo colore, senza id duplicati né violazioni axe", async ({
    page,
    baseURL,
  }) => {
    test.skip(!usersConfigured("C"), skipReason("C"));
    const laura = await lauraInvite();
    await signInAs(page.context(), baseURL as string, "C");
    await page.goto(linkOf(new URL(baseURL as string).origin, laura.token));
    await page.goto("/invito/colore");
    await colorPageReady(page);
    await expectAccessible(page);
  });
});
