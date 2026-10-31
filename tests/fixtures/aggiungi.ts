import { expect, type Locator, type Page } from "@playwright/test";
import {
  at1552,
  CORS,
  pauseClock,
  setClock,
  type CasaNest,
  type Day,
} from "./casa";

// Helpers for the tests of Aggiungi · Impegni (#20, phase 1).
//
// Data: every test builds its own throwaway Nests (fixtures/casa.ts), so desktop
// and mobile never meet on the same rows and nothing depends on the seed. The
// events are created and read with the session of a member of the Nest (RLS
// applies); only the plain counts and the cascade checks use the administrative
// client. Credentials and keys come only from environment variables.

/** The day fixed by the criteria: Tuesday 20 October 2026, 15:52 in Rome. */
export const TODAY: Day = "2026-10-20";

export const NOW = at1552(TODAY);

export const PHRASE = "Nuoto Sofia giovedì alle 17";

export const SAVE_FAILED =
  "Non siamo riusciti a salvare l'impegno. Controlla la connessione e riprova.";

export const MEMBERS_FAILED =
  "Non riusciamo a caricare le persone del Nest, quindi i nomi non vengono riconosciuti. Controlla la connessione e riprova.";

// ------------------------------------------------------------------ locators

export const dialogOf = (page: Page) =>
  page.getByRole("dialog", { name: "Aggiungi" });

export const fieldOf = (page: Page) =>
  dialogOf(page).getByRole("textbox", { name: "Cosa vuoi aggiungere?" });

/** The region with the labels under the field (the only polite live region of the sheet). */
export const labelsOf = (page: Page) =>
  dialogOf(page).locator('[aria-live="polite"]');

export const toastOf = (page: Page) => page.getByTestId("toast");

/** The side column of the desktop modal. */
export const sideOf = (page: Page) => dialogOf(page).getByRole("complementary");

/** Alerts with a text: Next.js keeps an empty role="alert" in every page. */
export const alertsIn = (scope: Page | Locator) =>
  scope.getByRole("alert").filter({ hasText: /\S/ });

/** The «chi accompagna?» notice: a status that contains the question. */
export const noticeOf = (page: Page) =>
  page.getByRole("status").filter({ hasText: "chi accompagna" });

// ---------------------------------------------------------------------- open

/**
 * Signs `who` in, fixes the browser clock at `time` (it keeps running: the
 * tests that need it stopped call `pauseClock`), sets the lens, loads Today and
 * opens Add from the navigation. The click is repeated until the page is
 * hydrated and the sheet is open (no timed waits). Returns once the field has
 * the focus.
 */
export async function openAdd(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  options: { lens?: "io" | "nest"; time?: Date } = {},
): Promise<void> {
  const { lens = "io", time = NOW } = options;
  await setClock(page, time);
  await page.addInitScript((value) => {
    window.sessionStorage.setItem("familynest.lens", value);
  }, lens);
  await nest.signIn(page, baseURL, who);
  await page.goto("/oggi");
  await expect(
    page.getByRole("heading", { level: 1, name: "Oggi" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(async () => {
    await page.getByRole("link", { name: "Aggiungi", exact: true }).click();
    await expect(dialogOf(page)).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(fieldOf(page)).toBeFocused();
}

/**
 * Waits until the day of the phrase has been read and drawn. On desktop the
 * «Nuovo» row of the preview only exists once the skeleton is gone; on mobile
 * there is nothing to look at, so the page is given two frames to commit.
 */
export async function dayRead(page: Page, desktop: boolean): Promise<void> {
  if (desktop) {
    await expect(sideOf(page).getByText("Nuovo", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  } else {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }
}

export { pauseClock };

// ------------------------------------------------------------------ database

export type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  visibility: string;
  recurrence: string;
  location: string | null;
  escort_member_id: string | null;
  author_member_id: string | null;
  household_id: string;
  memberIds: string[];
};

function adminOf(nest: CasaNest) {
  const user = Object.values(nest.users)[0];
  if (!user) throw new Error("Nest di prova senza utenti");
  return user.admin;
}

/** Every event of the Nest with its participants, read with the administrative key. */
export async function eventsOf(nest: CasaNest): Promise<EventRow[]> {
  const admin = adminOf(nest);
  const { data, error } = await admin
    .from("events")
    .select(
      "id, title, starts_at, ends_at, visibility, recurrence, location, escort_member_id, author_member_id, household_id",
    )
    .eq("household_id", nest.householdId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Lettura degli impegni di prova fallita");
  const { data: links, error: linksError } = await admin
    .from("event_members")
    .select("event_id, member_id")
    .eq("household_id", nest.householdId);
  if (linksError) throw new Error("Lettura dei partecipanti di prova fallita");
  return (data ?? []).map((row) => ({
    ...row,
    memberIds: (links ?? [])
      .filter((link) => link.event_id === row.id)
      .map((link) => link.member_id),
  }));
}

/** Participants rows of the Nest (to check the cascade after «Annulla»). */
export async function participantRowsOf(nest: CasaNest): Promise<number> {
  const { count, error } = await adminOf(nest)
    .from("event_members")
    .select("event_id", { count: "exact", head: true })
    .eq("household_id", nest.householdId);
  if (error) throw new Error("Lettura dei partecipanti di prova fallita");
  return count ?? 0;
}

export type SeedEvent = {
  title: string;
  starts: string;
  ends: string;
  visibility: "household" | "busy" | "private";
  /** Names of the participants */
  who: string[];
};

/** Creates an event with the session of `author` (the author is set by the database). */
export async function seedEvent(
  nest: CasaNest,
  author: string,
  spec: SeedEvent,
): Promise<void> {
  const user = nest.users[author];
  if (!user) throw new Error(`${author} non ha un account di prova`);
  const { error } = await user.client.rpc("create_event", {
    p_title: spec.title,
    p_starts_at: spec.starts,
    p_ends_at: spec.ends,
    p_visibility: spec.visibility,
    p_member_ids: spec.who.map((name) => {
      const id = nest.members[name];
      if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
      return id;
    }),
  });
  if (error) throw new Error("Impegno di prova non creato");
}

/** «Colloquio con la maestra», Thursday 22 October 16:30-17:15 Rome (CA-29). */
export async function seedColloquio(nest: CasaNest): Promise<void> {
  await seedEvent(nest, "Marco", {
    title: "Colloquio con la maestra",
    starts: "2026-10-22T14:30:00Z",
    ends: "2026-10-22T15:15:00Z",
    visibility: "household",
    who: ["Laura", "Tommaso"],
  });
}

/** The events `who` is allowed to read between two instants (the rows as the page gets them). */
export async function listedFor(
  nest: CasaNest,
  who: string,
  from: string,
  to: string,
) {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  const { data, error } = await user.client.rpc("list_household_events", {
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error("Lettura del calendario di prova fallita");
  return data ?? [];
}

// ------------------------------------------------------------------- network

/**
 * Records, from now on, every request of the page and the text of every answer
 * of the data API. `texts()` waits for the answers read so far.
 */
export function recordNetwork(page: Page) {
  const requests: { url: string; method: string; body: string }[] = [];
  const answers: Promise<string>[] = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData() ?? "",
    });
  });
  page.on("response", (response) => {
    if (response.url().includes("/rest/v1/")) {
      answers.push(response.text().catch(() => ""));
    }
  });
  return {
    requests,
    /** Requests to the data API (not to the app) */
    api: () => requests.filter((r) => r.url.includes("/rest/v1/")),
    texts: () => Promise.all(answers),
  };
}

/** A URL or body in plain text: percent-escapes and `+` undone. */
export function plain(text: string): string {
  try {
    return decodeURIComponent(text.replaceAll("+", " "));
  } catch {
    return text;
  }
}

/**
 * Makes the reading of the LIST of the Nest members (the one that asks for the
 * names) fail with a 500 while `failing()` is true. The reading of the own
 * member (`select=id`, needed to save) is never touched. A 500 is used, not an
 * aborted request: the data client retries a GET that never got an answer
 * (1 s, 2 s, 4 s), so the page would show the error only after about 7 s.
 */
export async function failMembersList(
  page: Page,
  failing: () => boolean = () => true,
): Promise<void> {
  await page.route(
    (url) =>
      url.pathname.endsWith("/rest/v1/household_members") &&
      (url.searchParams.get("select") ?? "").includes("name"),
    async (route) => {
      if (!failing() || route.request().method() === "OPTIONS") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ code: "XX000", message: "boom" }),
      });
    },
  );
}
