import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  authUserExists,
  deleteButton,
  deleteDialog,
  householdExists,
  openProfile,
} from "../fixtures/profilo";
import {
  colorPageReady,
  continueButton,
  radio,
  waitHydrated,
} from "../fixtures/invito-ingresso";
import {
  createThrowawayUser,
  throwawayConfigured,
  throwawaySkipReason,
} from "../fixtures/throwaway-user";

// Validation of the whole entry journey (#305), crossing many pages in one
// test the way a real person would: sign in, the four onboarding steps, "Oggi",
// the second adult who enters with the invitation link, "Il tuo Nest", "Un
// membro", leaving the Nest and deleting the account. Both users are
// throwaway (created and deleted by the test). The real order of the steps is
// the one of the mockup: Chi vive con te, Chi c'è nel Nest, Calendario,
// Invito, Pronto.

test.use({
  locale: "it-IT",
  timezoneId: "Europe/Rome",
  permissions: ["clipboard-read", "clipboard-write"],
});

const NEST = "Casa Rossi";
const visible = { visible: true } as const;

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).filter(visible);
const bar = (page: Page, name: string) =>
  page.getByRole("progressbar", { name }).filter(visible);

/** Clicks until the page is hydrated and `done` holds. */
async function clickUntil(target: Locator, done: () => Promise<void>) {
  await expect(async () => {
    await target.click({ timeout: 2000, noWaitAfter: true });
    await done();
  }).toPass({ timeout: 20_000 });
}

/** Step 1 to 5 of the onboarding, as the person who creates the Nest. */
async function onboarding(page: Page): Promise<string> {
  // Sign in: the session is already there, so the entrance leads to the start.
  await page.goto("/accesso");
  await expect(page).toHaveURL(/\/onboarding$/);

  // 1. Chi vive con te?
  await expect(h1(page)).toHaveText("Chi vive con te?");
  await expect(
    page.getByRole("progressbar", { name: "Passo 1 di 4" }),
  ).toBeVisible();
  const couple = page.getByRole("radio", { name: "In coppia" });
  await clickUntil(couple, async () => {
    await expect(couple).toHaveAttribute("aria-checked", "true", {
      timeout: 1000,
    });
  });
  await page.getByRole("button", { name: "Continua" }).click();

  // 2. Chi c'è nel Nest?
  await expect(page).toHaveURL(/\/onboarding\/persone$/);
  await expect(h1(page).filter(visible)).toHaveText("Chi c'è nel Nest?");
  await expect(bar(page, "Passo 2 di 4")).toBeVisible();
  const people = page.getByRole("list", { name: "Persone del Nest" });
  await expect(people.getByRole("listitem")).toHaveCount(1);
  await expect(people.getByText("Ilaria", { exact: true })).toBeVisible();
  const add = page.getByRole("button", {
    name: "Aggiungi una persona o un animale",
  });
  const dialog = page.getByRole("dialog", { name: "Aggiungi una persona" });
  await clickUntil(add, async () => {
    await expect(dialog).toBeVisible({ timeout: 1000 });
  });
  await dialog.getByLabel("Nome", { exact: true }).fill("Marco");
  await dialog
    .getByRole("radiogroup", { name: "Colore" })
    .getByRole("radio", { name: "Salvia", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Aggiungi Marco", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(people.getByRole("listitem")).toHaveCount(2);
  await expect(people.getByText("Marco", { exact: true })).toBeVisible();
  await button(page, "Continua").click();

  // 3. Calendario, without connecting any calendar.
  await expect(page).toHaveURL(/\/onboarding\/calendario$/);
  await expect(h1(page).filter(visible)).toHaveText(
    "Porta qui il tuo calendario",
  );
  await expect(bar(page, "Passo 3 di 4")).toBeVisible();
  await button(page, "Continua senza calendario").click();

  // 4. Invito: copy the link for Marco.
  await expect(page).toHaveURL(/\/onboarding\/invito$/);
  await expect(h1(page)).toHaveText("Invita Marco");
  await expect(bar(page, "Passo 4 di 4")).toBeVisible();
  const copy = page.getByRole("button", { name: "Copia il link", exact: true });
  await waitHydrated(copy);
  await copy.click();
  await expect(
    page
      .locator('[role="status"], [role="alert"]')
      .filter({ hasText: "Link copiato" })
      .filter(visible),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/invito\/[^/]+$/);
  await button(page, "Ho finito").or(button(page, "Lo faccio dopo")).click();

  // 5. Pronto, then Oggi.
  await expect(page).toHaveURL(/\/onboarding\/pronto$/);
  await expect(h1(page)).toHaveText(NEST);
  await expect(page.getByRole("list").getByRole("listitem")).toHaveText(
    "Invito condiviso con Marco",
  );
  await page.getByRole("link", { name: "Vai a Oggi" }).click();
  await expect(page).toHaveURL(/\/oggi$/);
  await expect(h1(page)).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Navigazione principale" })
      .filter(visible),
  ).toBeVisible();
  return link;
}

/** The invited adult: link, welcome, colour, calendar, Oggi. */
async function joinWithLink(page: Page, link: string) {
  await page.goto(link);
  await expect(page).toHaveURL(/\/invito$/);
  await expect(h1(page).filter(visible)).toContainText(NEST);
  // The sign-in with the provider is done: the entrance leads to the colour.
  await page.goto("/accesso");
  await expect(page).toHaveURL(/\/invito\/colore$/);
  await colorPageReady(page);
  await radio(page, "Peonia").click();
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/onboarding\/calendario$/);
  await expect(bar(page, "Passo 2 di 3")).toBeVisible();
  await button(page, "Continua senza calendario").click();
  await expect(page).toHaveURL(/\/oggi$/);
  await expect(h1(page)).toContainText("Eccoti,");
  await expect(h1(page)).toContainText("Marco");
}

test("percorso completo: accesso, onboarding, invito, Nest, uscita e cancellazione dell'account", async ({
  page,
  baseURL,
}) => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  const ilaria = await createThrowawayUser("Ilaria Rossi");
  const marco = await createThrowawayUser("Marco Verdi");
  try {
    const origin = baseURL as string;

    // Without a session the app asks to sign in.
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso/);

    // Ilaria signs in and builds the Nest.
    await ilaria.signInContext(page.context(), origin);
    const link = await onboarding(page);
    expect(await ilaria.nestCount()).toBe(1);
    const nest = await ilaria.admin
      .from("households")
      .select("id, name, household_type")
      .single();
    expect(nest.data).toMatchObject({ name: NEST, household_type: "couple" });
    const householdId = nest.data!.id as string;
    const members = await ilaria.admin
      .from("household_members")
      .select("name, kind, user_id")
      .eq("household_id", householdId)
      .order("created_at");
    expect(members.data).toEqual([
      { name: "Ilaria", kind: "adult", user_id: ilaria.id },
      { name: "Marco", kind: "adult", user_id: null },
    ]);

    // Marco enters with the link (on the same device, after Ilaria's session).
    await page.context().clearCookies();
    await marco.signInContext(page.context(), origin);
    await joinWithLink(page, link);
    const joined = await marco.admin
      .from("household_members")
      .select("id, user_id, color, is_admin, household_id")
      .eq("user_id", marco.id)
      .single();
    expect(joined.data).toMatchObject({
      color: "peonia",
      is_admin: false,
      household_id: householdId,
    });
    const invitation = await marco.admin
      .from("invitations")
      .select("status")
      .eq("household_id", householdId);
    expect(invitation.data).toEqual([{ status: "accepted" }]);

    // "Il tuo Nest": both adults, then "Un membro" (Ilaria's page).
    await page.goto("/nest");
    await expect(h1(page)).toHaveText(NEST);
    const rows = page
      .getByRole("list", { name: "Chi c’è" })
      .getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Ilaria" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Marco" })).toHaveCount(1);
    await rows.filter({ hasText: "Ilaria" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/membri\/[0-9a-f-]+$/);
    await expect(h1(page)).toHaveText("Ilaria");

    // Marco leaves the Nest from "Impostazioni".
    await page.goto("/impostazioni");
    const leave = page.getByRole("button", {
      name: `Esci da ${NEST}`,
      exact: true,
    });
    await expect(leave).toBeEnabled();
    await waitHydrated(leave);
    await leave.click();
    const leaveDialog = page.getByRole("alertdialog", {
      name: `Uscire da ${NEST}?`,
    });
    await expect(leaveDialog).toBeVisible();
    await leaveDialog.getByRole("button", { name: "Esci dalla casa" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    expect(await marco.nestCount()).toBe(0);
    expect(await householdExists(householdId)).toBe(true);
    expect(await authUserExists(marco.id)).toBe(true);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/onboarding/);

    // Ilaria, now alone, deletes the account and the Nest goes with it.
    await page.context().clearCookies();
    await ilaria.signInContext(page.context(), origin);
    await openProfile(page);
    await deleteButton(page).click();
    const dialog = deleteDialog(page);
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Esci e cancella la casa" })
      .click();
    await expect(page).toHaveURL(/\/accesso\?account=eliminato$/);
    await expect(
      page.getByText("Il tuo account è stato eliminato.").filter(visible),
    ).toBeVisible();
    expect(await authUserExists(ilaria.id)).toBe(false);
    expect(await householdExists(householdId)).toBe(false);
    await page.goto("/oggi");
    await expect(page).toHaveURL(/\/accesso/);
  } finally {
    await ilaria.remove();
    await marco.remove();
  }
});

test("percorso dell'invitato: entra col link e cancella il suo account, il Nest resta a chi l'ha creato", async ({
  page,
  baseURL,
}) => {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
  const ilaria = await createThrowawayUser("Ilaria Rossi");
  const marco = await createThrowawayUser("Marco Verdi");
  try {
    const origin = baseURL as string;
    await ilaria.signInContext(page.context(), origin);
    const link = await onboarding(page);
    const nest = await ilaria.admin.from("households").select("id").single();
    const householdId = nest.data!.id as string;

    await page.context().clearCookies();
    await marco.signInContext(page.context(), origin);
    await joinWithLink(page, link);

    // The link is single use: a second visit by a stranger finds no invitation.
    const other = await page.context().browser()!.newContext();
    try {
      const stranger = await other.newPage();
      await stranger.goto(link);
      await expect(stranger).toHaveURL(/\/invito$/);
      await expect(stranger.getByText(NEST).filter(visible)).toHaveCount(0);
    } finally {
      await other.close();
    }

    await openProfile(page);
    await deleteButton(page).click();
    const dialog = deleteDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "Perderai impegni, liste e impostazioni. Casa Rossi resterà a Ilaria. Non si può annullare.",
    );
    await dialog.getByRole("button", { name: "Elimina l'account" }).click();
    await expect(page).toHaveURL(/\/accesso\?account=eliminato$/);
    expect(await authUserExists(marco.id)).toBe(false);
    expect(await householdExists(householdId)).toBe(true);
    expect(await ilaria.nestCount()).toBe(1);
  } finally {
    await ilaria.remove();
    await marco.remove();
  }
});
