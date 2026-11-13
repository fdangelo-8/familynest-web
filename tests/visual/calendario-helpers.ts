import { expect, type Page } from "@playwright/test";
import { fakeCalendar, type FakeCalendar } from "../fixtures/calendar-fake";
import {
  createThrowawayUser,
  type ThrowawayUser,
} from "../fixtures/throwaway-user";
import { userWithNest } from "./persone-helpers";

// Shared by tests/visual/onboarding-calendario.spec.ts and
// tests/a11y/onboarding-calendario.spec.ts (onboarding step 3, #37). Every
// test has its own throwaway user; the Nest and its members are written with
// the administrative key, the accounts by the fake provider of #272 (reset in
// the `finally`). The notices are given by the short cookie of #34 §10, the
// same one the route writes when the user comes back from the provider.

export const PATH = "/onboarding/calendario";
const visible = { visible: true } as const;

export type Role = "couple" | "single" | "invited";

const BEA = { name: "Bea", kind: "adult", color: "glicine" } as const;

/** The mockup's linked Outlook account (marco@studio.it, 2 calendars). */
export const OUTLOOK_ACCOUNT = {
  email: "marco@studio.it",
  calendars: [
    { id: "lavoro", name: "Lavoro", primary: true },
    { id: "condiviso", name: "Condiviso" },
  ] satisfies FakeCalendar[],
};

/**
 * Runs `body` with a user in the given role: "couple" is the administrator of
 * a Nest with an adult still to invite (step 3 of 4), "single" the one of a
 * Nest for one (3 of 3), "invited" an adult who joined with an invitation
 * (2 of 3, no back arrow). Everything is removed at the end.
 */
export async function withRole(
  role: Role,
  body: (user: ThrowawayUser) => Promise<void>,
) {
  const user =
    role === "single"
      ? await userWithNest("single", [])
      : await userWithNest("couple", [BEA]);
  let guest: ThrowawayUser | null = null;
  try {
    if (role === "invited") {
      guest = await createThrowawayUser("Rita");
      const household = await user.client.rpc("current_household_id");
      const joined = await user.admin
        .from("household_members")
        .update({ user_id: guest.id, joined_at: new Date().toISOString() })
        .eq("household_id", household.data as string)
        .eq("name", "Bea");
      if (joined.error) throw new Error("Invitata non collegata al Nest");
    }
    await body(guest ?? user);
  } finally {
    await guest?.remove();
    await user.remove();
  }
}

/** True once React owns the forms (a click before it would submit natively). */
export async function hydrated(page: Page) {
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("form") ?? {}).some((key) =>
      key.startsWith("__reactProps"),
    ),
  );
}

/** Opens the step as the user and waits for the real page (not the skeleton). */
export async function openStep(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto(PATH);
  await expect(page.locator("h1:visible")).toHaveText(
    "Porta qui il tuo calendario",
  );
  // The title streams in after the shell, and while React takes the page over
  // it leaves the <head> for a few hundred milliseconds and comes back (seen
  // in the trace of run 42270773505: present at the first check, absent right
  // after the hydration, back after axe). Axe's «document-title» ran in that
  // gap. So first the hydration, then the title: the check that follows is the
  // one that counts.
  await hydrated(page);
  await expect(page).toHaveTitle("FamilyNest · Porta qui il tuo calendario");
}

/** The answer cookie the route leaves when the user comes back. */
export async function leaveResult(
  page: Page,
  baseURL: string | undefined,
  provider: "google" | "outlook",
  result: string,
) {
  await page.context().addCookies([
    {
      name: "fn-calendar-link",
      value: `${provider}.${result}`,
      url: baseURL as string,
      httpOnly: true,
    },
  ]);
}

export const collega = (page: Page, name: string) =>
  page
    .getByRole("button", { name: `Collega ${name}`, exact: true })
    .filter(visible);
export const principal = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).filter(visible);
export const later = (page: Page) =>
  page.getByRole("link", { name: "Più tardi", exact: true }).filter(visible);

/** Links an account through the fake provider: «Collega» then «Consenti». */
export async function linkAccount(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
  provider: "google" | "outlook",
  account: { email: string; calendars: FakeCalendar[] },
) {
  await fakeCalendar(baseURL as string).setup({
    userId: user.id,
    provider,
    ...account,
    nextConsent: true,
  });
  await collega(page, provider === "google" ? "Google" : "Outlook").click();
  await page.getByRole("link", { name: "Consenti", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/calendario$/);
  await expect(page.getByText("Collegato").filter(visible)).toBeVisible();
}

/** Forgets what the fake knows about the user. Call it in the `finally`. */
export async function forget(user: ThrowawayUser, baseURL: string | undefined) {
  await fakeCalendar(baseURL as string).reset(user.id);
}

/**
 * Holds the trip to the provider: the submit is cancelled in the capture
 * phase, after which React still runs its own handler, so the page shows what
 * it shows while it waits.
 */
export async function holdSubmit(page: Page) {
  await page.evaluate(() =>
    document.addEventListener("submit", (e) => e.preventDefault(), true),
  );
}

/** Fonts loaded, pointer away from any control (no hover state). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}
