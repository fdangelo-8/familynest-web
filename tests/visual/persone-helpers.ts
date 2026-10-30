import type { Page, Route } from "@playwright/test";
import {
  createThrowawayUser,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";

// Shared by tests/visual/onboarding-persone.spec.ts and
// tests/a11y/onboarding-persone.spec.ts (onboarding step 2, #13).
// Every test uses its own throwaway user (marked in app_metadata, deleted at
// the end). The Nest and its members are written with the administrative key
// of the local Supabase; "Continua" is never pressed against the database.

export type HouseholdType =
  "single" | "couple" | "family_with_children" | "roommates";

type Color =
  | "pomodoro"
  | "glicine"
  | "salvia"
  | "cobalto"
  | "zafferano"
  | "lampone"
  | "ceruleo"
  | "peonia"
  | "basilico"
  | "cannella";

type Seed = {
  name: string;
  kind: "adult" | "child" | "pet";
  color: Color;
  /** Age in whole years and months, turned into a date from today */
  age?: { years: number; months: number };
};

/** The people of the mockup (Casa D'Angelo): the first one is "tu". */
export const FAMILY: Seed[] = [
  { name: "Laura", kind: "adult", color: "glicine" },
  {
    name: "Sofia",
    kind: "child",
    color: "salvia",
    age: { years: 9, months: 3 },
  },
  {
    name: "Tommaso",
    kind: "child",
    color: "cobalto",
    age: { years: 6, months: 4 },
  },
  {
    name: "Biscotto",
    kind: "pet",
    color: "zafferano",
    age: { years: 3, months: 5 },
  },
];

/** Five more, so the Nest has the 10 members it allows. */
export const MORE: Seed[] = [
  { name: "Nonna Rosa", kind: "adult", color: "lampone" },
  { name: "Zio Piero", kind: "adult", color: "ceruleo" },
  {
    name: "Giulia",
    kind: "child",
    color: "peonia",
    age: { years: 2, months: 2 },
  },
  { name: "Micio", kind: "pet", color: "basilico" },
  {
    name: "Luca",
    kind: "child",
    color: "cannella",
    age: { years: 0, months: 5 },
  },
];

function dateFrom(age: { years: number; months: number }): string {
  // The 1st of the month, so the age (whole months) never flips while a test
  // runs and stays the same on any day the suite is run.
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - age.years * 12 - age.months);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

/**
 * A throwaway user with a Nest (created the way step 1 creates it) and the
 * given members, inserted one by one so that they keep this order.
 */
export async function userWithNest(
  type: HouseholdType,
  members: Seed[],
): Promise<ThrowawayUser> {
  const user = await createThrowawayUser("Marco");
  try {
    const { error } = await user.client.rpc("create_household", {
      name: "Casa D'Angelo",
      household_type: type,
      member_name: "Marco",
      color: "pomodoro",
    });
    if (error) throw new Error("Nest non creato");
    const { data: householdId } = await user.client.rpc("current_household_id");
    for (const m of members) {
      const { error: insertError } = await user.admin
        .from("household_members")
        .insert({
          household_id: householdId as string,
          name: m.name,
          kind: m.kind,
          color: m.color,
          birth_date: m.age ? dateFrom(m.age) : null,
        });
      if (insertError) throw new Error(`Membro non aggiunto: ${m.name}`);
    }
    return user;
  } catch (error) {
    await user.remove();
    throw error;
  }
}

/** True for the POST of a server action (not the route announcer). */
export const isAction = (route: Route) =>
  route.request().method() === "POST" &&
  "next-action" in route.request().headers();

/** The answer a server action gives, in the Flight format. */
export function actionAnswer(value: object): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status: 200,
    contentType: "text/x-component",
    body: `0:{"a":"$@1","f":"","b":"x"}\n1:${JSON.stringify(value)}\n`,
  };
}

/** Opens the page as the user and waits for the real list (not the skeleton). */
export async function openPeople(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto("/onboarding/persone");
  await page.locator("h1:visible").waitFor();
  await page
    .getByRole("list", { name: "Persone del Nest" })
    .filter({ visible: true })
    .waitFor();
}

export const addButton = (page: Page) =>
  page
    .getByRole("button", { name: "Aggiungi una persona o un animale" })
    .filter({ visible: true });

export const continueButton = (page: Page) =>
  page.getByRole("button", { name: "Continua" }).filter({ visible: true });

/** Opens the sheet with "Aggiungi", retrying until the page is hydrated. */
export async function openAddSheet(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Aggiungi una persona" });
  for (let i = 0; i < 20 && !(await dialog.isVisible()); i += 1) {
    await addButton(page).click();
    await dialog.waitFor({ timeout: 1000 }).catch(() => undefined);
  }
  await dialog.waitFor();
  return dialog;
}

/** Opens the change sheet of one person with the pencil. */
export async function openEditSheet(page: Page, name: string) {
  const dialog = page.getByRole("dialog", { name: `Modifica ${name}` });
  const pencil = page
    .getByRole("button", { name: `Modifica ${name}` })
    .filter({ visible: true });
  for (let i = 0; i < 20 && !(await dialog.isVisible()); i += 1) {
    await pencil.click();
    await dialog.waitFor({ timeout: 1000 }).catch(() => undefined);
  }
  await dialog.waitFor();
  return dialog;
}

/** Fonts loaded, pointer away from any control (no hover state). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}
