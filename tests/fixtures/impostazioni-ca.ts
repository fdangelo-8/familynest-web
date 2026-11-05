import { expect, type Locator, type Page, type Route } from "@playwright/test";
import { adminClient } from "./invito";

// Shared by tests/e2e/impostazioni.spec.ts and tests/a11y/impostazioni.spec.ts
// (page "Impostazioni della casa", #41, /impostazioni). Seeded users A, B, B2, C
// only read; everything that writes uses throwaway users, deleted at the end.

export const PAGE_TITLE = "FamilyNest · Impostazioni della casa";

export const NOTIFICATIONS = [
  { column: "events", title: "Impegni e cambi d'orario" },
  { column: "assigned_todos", title: "Da fare assegnati a me" },
  { column: "shopping", title: "Spesa" },
  { column: "free_together", title: "Liberi insieme" },
  { column: "morning_digest", title: "Sintesi del mattino" },
] as const;

/** Value of the five switches for someone who never chose (CA-12). */
export const DEFAULT_STATES = ["true", "true", "false", "true", "true"];

export const BLOCKED_NOTE =
  "Sei l'unica persona che gestisce la casa: prima di uscire, dai il ruolo di amministratore a un altro adulto in «Chi c’è».";
export const NORMAL_LEAVE_TEXT =
  "Non vedrai più il calendario, la spesa e le cose da fare della casa. Potrai rientrare solo con un nuovo invito.";
export const LAST_ADULT_LEAVE_TEXT =
  "Non vedrai più il calendario, la spesa e le cose da fare della casa. Non si può annullare.";
export const LEAVE_NETWORK_ERROR =
  "Non siamo riusciti a farti uscire dalla casa. Controlla la connessione e riprova.";

// ---------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
export const peopleSection = (page: Page) =>
  page.getByRole("region", { name: "Chi c’è" });
export const notificationsSection = (page: Page) =>
  page.locator("section#notifiche");
export const switchOf = (page: Page, name: string) =>
  page.getByRole("switch", { name, exact: true });
export const leaveButton = (page: Page, nest: string) =>
  page.getByRole("button", { name: `Esci da ${nest}`, exact: true });
export const dialog = (page: Page) => page.getByRole("alertdialog");
export const backLink = (page: Page) =>
  page.getByRole("link", { name: "Indietro", exact: true });
export const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" });
export const settingsNav = (page: Page) =>
  page.getByRole("navigation", { name: "Impostazioni" });
export const saveAlert = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "Non siamo riusciti a cambiare" });

export const errorTextOf = (title: string) =>
  `Non siamo riusciti a cambiare la notifica «${title}». Controlla la connessione e riprova.`;

/**
 * Waits until React has taken over the element: before that, a click does
 * nothing (LEZIONI). React marks the nodes it hydrates with `__reactFiber$…`.
 */
export async function waitHydrated(target: Locator) {
  await expect
    .poll(() =>
      target.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
      ),
    )
    .toBe(true);
}

/** Opens the page, waits for the h1 (the Nest name) and for hydration. */
export async function openSettings(page: Page, nestName: string) {
  await page.goto("/impostazioni");
  await expect(
    page.getByRole("heading", { level: 1, name: nestName, exact: true }),
  ).toBeVisible();
  await waitHydrated(switchOf(page, "Spesa"));
}

/** The five switches as [name, aria-checked], in page order. */
export async function switchStates(page: Page) {
  return notificationsSection(page)
    .getByRole("switch")
    .evaluateAll((els) =>
      els.map((el) => [
        el.getAttribute("aria-label"),
        el.getAttribute("aria-checked"),
      ]),
    );
}

export type PersonRow = {
  title: string;
  /** `null`: the row has no second line */
  info: string | null;
  tag: string;
  initial?: string;
  color?: string;
};

/** Checks the rows of «Chi c’è», in order. */
export async function expectPeople(page: Page, rows: PersonRow[]) {
  const items = peopleSection(page).locator("ul > li");
  await expect(items).toHaveCount(rows.length);
  for (const [index, row] of rows.entries()) {
    const item = items.nth(index);
    await expect(item.locator(".riga-lista__titolo")).toHaveText(row.title);
    if (row.info === null) {
      await expect(item.locator(".riga-lista__info")).toHaveCount(0);
    } else {
      await expect(item.locator(".riga-lista__info")).toHaveText(row.info);
    }
    await expect(item.locator(".etichetta")).toHaveText(row.tag);
    if (row.initial) {
      await expect(item.locator(".avatar")).toHaveText(row.initial);
    }
    if (row.color) {
      await expect(item.locator(".avatar")).toHaveClass(
        new RegExp(`membro-${row.color}\\b`),
      );
    }
  }
}

// ---------------------------------------------------------------- network

/** The server action POST of the page (not the Next.js route announcer). */
export const isServerAction = (route: Route) => {
  const request = route.request();
  return request.method() === "POST" && !!request.headers()["next-action"];
};

export type ActionControl = {
  /** Server actions seen so far */
  count: number;
  /** While true the actions are cut (network down) */
  abort: boolean;
};

/**
 * Counts the server actions of /impostazioni, cuts them (`abort`) or slows the
 * answer down by `delayMs`. The delay slows the server, it is not a test wait.
 */
export async function controlActions(
  page: Page,
  options: { abort?: boolean; delayMs?: number },
): Promise<ActionControl> {
  const control: ActionControl = { count: 0, abort: !!options.abort };
  await page.route("**/impostazioni", async (route) => {
    if (!isServerAction(route)) {
      await route.continue();
      return;
    }
    control.count++;
    if (control.abort) {
      await route.abort("connectionfailed");
      return;
    }
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    await route.continue();
  });
  return control;
}

// ---------------------------------------------------------------- database

export type PreferenceRow = {
  events: boolean;
  assigned_todos: boolean;
  shopping: boolean;
  free_together: boolean;
  morning_digest: boolean;
};

/** Notification choices of a member (administrative client), `null` if none. */
export async function prefsOf(memberId: string): Promise<PreferenceRow | null> {
  const { data, error } = await adminClient()
    .from("notification_preferences")
    .select("events, assigned_todos, shopping, free_together, morning_digest")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new Error("Lettura delle preferenze di prova fallita");
  return data as PreferenceRow | null;
}

/** True when the household still exists (administrative client). */
export async function householdExists(id: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("households")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lettura del Nest di prova fallita");
  return data !== null;
}
