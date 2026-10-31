import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Request } from "@playwright/test";
import {
  addDays,
  capitalise,
  dayNumber,
  expect,
  monthName,
  romeDay,
  romeInstant,
  test,
  weekdayName,
  type CasaNest,
  type Day,
} from "./casa";

// Helpers of the tests of Dettaglio impegno (#19). Data: every test builds its
// own throwaway Nests (tests/fixtures/casa.ts) and creates its events with the
// session of the author (`create_event`, RLS applies), so tests never share
// rows. Credentials and keys come only from environment variables.

export { expect, test };
export type { CasaNest, Day };
export { addDays, romeDay };

// --------------------------------------------------------------------- texts

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/**
 * A regular expression for a text with dates. The year is shown only when it is
 * not the current one, so every «20 ottobre» also accepts «20 ottobre 2026»
 * (issue #19: the test accepts both forms). Whitespace is normalised by
 * Playwright before matching. `exact` anchors the expression at both ends.
 */
export function textRx(text: string, exact = true): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withYear = escaped.replace(
    new RegExp(`(\\d{1,2} (?:${MONTHS.join("|")}))`, "g"),
    "$1(?: \\d{4})?",
  );
  return new RegExp(exact ? `^${withYear}$` : withYear);
}

/** «martedì 20 ottobre» */
export const daySentence = (day: Day) =>
  `${weekdayName(day)} ${dayNumber(day)} ${monthName(day)}`;

/** «Martedì 20 ottobre» */
export const dayLabel = (day: Day) => capitalise(daySentence(day));

/** Minutes after midnight in Europe/Rome. */
export function romeMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

/** A 100-character title made of words (it must wrap, never be cut). */
export function longTitle(): string {
  const words =
    "Gita scolastica alla fattoria didattica con pranzo al sacco e laboratorio del pane per tutta la classe quinta";
  let title = words.slice(0, 100);
  if (title.endsWith(" ")) title = `${title.slice(0, 99)}o`;
  if (title.length !== 100) throw new Error("Titolo lungo di prova sbagliato");
  return title;
}

// -------------------------------------------------------------------- events

export type Visibility = "private" | "busy" | "household";
export type Repeat =
  { kind: "weekly"; weekdays: number[] } | { kind: "monthly" };

export type EventSpec = {
  title: string;
  /** First occurrence, wall-clock time in Rome */
  day: Day;
  from: string;
  to: string;
  /** Day on which the first occurrence ends (default: the same day) */
  endDay?: Day;
  visibility?: Visibility;
  /** Names of the participants */
  members: string[];
  place?: string;
  notes?: string;
  /** Name of the adult who accompanies */
  escort?: string;
  repeat?: Repeat;
  /** Last day of the repetition */
  until?: Day;
};

export const instant = (day: Day, time: string): Date => {
  const [hour, minute] = time.split(":").map(Number);
  return romeInstant(day, hour ?? 0, minute ?? 0);
};

function memberIdOf(nest: CasaNest, name: string): string {
  const id = nest.members[name];
  if (!id) throw new Error(`Membro di prova sconosciuto: ${name}`);
  return id;
}

function clientOf(nest: CasaNest, who: string) {
  const user = nest.users[who];
  if (!user) throw new Error(`${who} non ha un account di prova`);
  return user.client;
}

/** Creates an event with the session of `who` (the author). Returns its id. */
export async function createEvent(
  nest: CasaNest,
  who: string,
  spec: EventSpec,
): Promise<string> {
  const { data, error } = await clientOf(nest, who).rpc("create_event", {
    p_title: spec.title,
    p_starts_at: instant(spec.day, spec.from).toISOString(),
    p_ends_at: instant(spec.endDay ?? spec.day, spec.to).toISOString(),
    p_visibility: spec.visibility ?? "household",
    p_member_ids: spec.members.map((name) => memberIdOf(nest, name)),
    p_location: spec.place ?? null,
    p_escort_member_id: spec.escort ? memberIdOf(nest, spec.escort) : null,
    p_recurrence: spec.repeat?.kind ?? "none",
    p_recurrence_weekdays:
      spec.repeat?.kind === "weekly" ? spec.repeat.weekdays : null,
    p_recurrence_until: spec.until ?? null,
    p_notes: spec.notes ?? null,
  });
  if (error || typeof data !== "string") {
    throw new Error(
      `Impegno di prova non creato (${error?.code ?? "?"}: ${error?.message ?? "nessun id"})`,
    );
  }
  return data;
}

export const NUOTO = "Nuoto Sofia";

/**
 * The «Nuoto» of the requirements: created by Marco, title «Nuoto Sofia»,
 * participant Sofia, escort Laura, «Tutto il Nest», «Piscina comunale,
 * Lissone», note «Portare la cuffia», every Tuesday and Thursday, first
 * occurrence Tuesday 6 October 2026 from 17:00 to 18:30, no last day.
 */
export function createNuoto(casa: CasaNest): Promise<string> {
  return createEvent(casa, "Marco", {
    title: NUOTO,
    day: "2026-10-06",
    from: "17:00",
    to: "18:30",
    members: ["Sofia"],
    escort: "Laura",
    place: "Piscina comunale, Lissone",
    notes: "Portare la cuffia",
    repeat: { kind: "weekly", weekdays: [2, 4] },
  });
}

export type EventRow = {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  visibility: Visibility;
  author_member_id: string | null;
  escort_member_id: string | null;
  recurrence: "none" | "weekly" | "monthly";
  recurrence_weekdays: number[] | null;
  recurrence_until: string | null;
};

function adminOf(nest: CasaNest) {
  const user = Object.values(nest.users)[0];
  if (!user) throw new Error("Nest di prova senza utenti");
  return user.admin;
}

/** The row of `events`, read with the administrative key (null if gone). */
export async function eventRow(
  nest: CasaNest,
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await adminOf(nest)
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lettura dell'impegno di prova fallita");
  return data as EventRow | null;
}

/** Number of occurrences changed or removed by themselves. */
export async function exceptionCount(
  nest: CasaNest,
  id: string,
): Promise<number> {
  const { count, error } = await adminOf(nest)
    .from("event_exceptions")
    .select("event_id", { count: "exact", head: true })
    .eq("event_id", id);
  if (error) throw new Error("Lettura delle eccezioni di prova fallita");
  return count ?? 0;
}

/** Takes a participant off an event, as the test needs (administrative key). */
export async function removeParticipant(
  nest: CasaNest,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await adminOf(nest)
    .from("event_members")
    .delete()
    .eq("event_id", id)
    .eq("member_id", memberIdOf(nest, name));
  if (error) throw new Error("Partecipante di prova non tolto");
}

/** Deletes the whole event, as someone else would (administrative key). */
export async function deleteEventAsOther(
  nest: CasaNest,
  id: string,
): Promise<void> {
  const { error } = await adminOf(nest).from("events").delete().eq("id", id);
  if (error) throw new Error("Impegno di prova non eliminato");
}

/** The author leaves the Nest: the «Tutto il Nest» event stays without author. */
export async function orphanEvent(
  nest: CasaNest,
  authorName: string,
): Promise<void> {
  const { error } = await adminOf(nest)
    .from("household_members")
    .delete()
    .eq("id", memberIdOf(nest, authorName));
  if (error) throw new Error("Autore di prova non tolto");
}

/** Changes one occurrence by itself (what «Salva solo questo» does). */
export async function changeOccurrence(
  nest: CasaNest,
  who: string,
  id: string,
  day: Day,
  values: {
    title: string;
    start: Date;
    end: Date;
    place: string | null;
    notes: string | null;
    escort: string | null;
  },
): Promise<void> {
  const { error } = await clientOf(nest, who).rpc("update_event_occurrence", {
    p_event_id: id,
    p_day: day,
    p_title: values.title,
    p_starts_at: values.start.toISOString(),
    p_ends_at: values.end.toISOString(),
    p_location: values.place,
    p_escort_member_id: values.escort ? memberIdOf(nest, values.escort) : null,
    p_notes: values.notes,
  });
  if (error) {
    throw new Error(`Volta di prova non cambiata (${error.code ?? "?"})`);
  }
}

/** Removes one occurrence (what «Elimina solo questo» does). */
export async function removeOccurrence(
  nest: CasaNest,
  who: string,
  id: string,
  day: Day,
  scope: "this" | "following" = "this",
): Promise<void> {
  const { error } = await clientOf(nest, who).rpc("delete_event_occurrence", {
    p_event_id: id,
    p_day: day,
    p_scope: scope,
  });
  if (error) {
    throw new Error(`Volta di prova non tolta (${error.code ?? "?"})`);
  }
}

/** `list_household_events` as `who`, with the Rome day of each row. */
export async function listDays(
  nest: CasaNest,
  who: string,
  from: Day,
  to: Day,
): Promise<{ day: Day; title: string | null; masked: boolean }[]> {
  const { data, error } = await clientOf(nest, who).rpc(
    "list_household_events",
    {
      p_from: romeInstant(from, 0, 0).toISOString(),
      p_to: romeInstant(to, 0, 0).toISOString(),
    },
  );
  if (error) throw new Error("Lettura del calendario di prova fallita");
  return (
    data as { starts_at: string; title: string | null; is_masked: boolean }[]
  )
    .map((row) => ({
      day: romeDay(new Date(row.starts_at)),
      title: row.title,
      masked: row.is_masked,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

// ------------------------------------------------------------ pages and forms

export const detailPath = (id: string, day?: string) =>
  `/impegni/${id}${day ? `?giorno=${day}` : ""}`;

/** Signs `who` in and opens the detail. */
export async function openDetail(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
  id: string,
  day?: string,
): Promise<void> {
  await nest.signIn(page, baseURL, who);
  await page.goto(detailPath(id, day));
}

/** Signs another member of the Nest in, in the same browser. */
export async function switchTo(
  page: Page,
  baseURL: string | undefined,
  nest: CasaNest,
  who: string,
): Promise<void> {
  await page.context().clearCookies();
  await nest.signIn(page, baseURL, who);
}

export const h1 = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { level: 1, name });
export const card = (page: Page) => page.getByRole("main").getByRole("article");
export const pageEditButton = (page: Page) =>
  page.getByRole("main").getByRole("button", { name: "Modifica", exact: true });
export const barEditButton = (page: Page) =>
  page
    .getByRole("banner")
    .getByRole("button", { name: "Modifica", exact: true });
export const editDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Modifica impegno" });
export const confirmDialog = (page: Page) => page.getByRole("alertdialog");
export const toastOf = (page: Page, text: string | RegExp) =>
  page.getByRole("status").filter({ hasText: text });

/** A button of a dialog, by exact name. */
export const buttonOf = (dialog: Locator, name: string) =>
  dialog.getByRole("button", { name, exact: true });

/** The field of the form with that label. */
export const fieldOf = (dialog: Locator, label: string) =>
  dialog.getByLabel(label, { exact: true });
export const groupOf = (dialog: Locator, name: string) =>
  dialog.getByRole("group", { name, exact: true });
export const chipOf = (dialog: Locator, group: string, person: string) =>
  groupOf(dialog, group).getByRole("button", { name: person, exact: true });

/** The paragraph a group points to with `aria-describedby`. */
export async function helpOf(dialog: Locator, group: string): Promise<Locator> {
  const ids = (await groupOf(dialog, group).getAttribute("aria-describedby"))
    ?.split(" ")
    .filter(Boolean);
  if (!ids || ids.length === 0) {
    throw new Error(`Il gruppo «${group}» non ha aria-describedby`);
  }
  return dialog.locator(ids.map((id) => `[id="${id}"]`).join(", "));
}

/** Opens the form with the button of the page and waits for it. */
export async function openForm(page: Page): Promise<Locator> {
  await pageEditButton(page).click();
  const dialog = editDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Touches «Salva le modifiche» in the form. */
export async function pressSave(page: Page): Promise<void> {
  await buttonOf(editDialog(page), "Salva le modifiche").click();
}

/** Waits for the card of the event (the page has read it). */
export async function waitForCard(
  page: Page,
  title: string | RegExp,
): Promise<void> {
  await expect(h1(page, title)).toBeVisible();
}

export const RPC_UPDATE = /\/rest\/v1\/rpc\/update_event(_occurrence)?(\?|$)/;
export const RPC_UPDATE_ALL = /\/rest\/v1\/rpc\/update_event(\?|$)/;
export const RPC_UPDATE_ONE = /\/rest\/v1\/rpc\/update_event_occurrence(\?|$)/;
export const RPC_DELETE = /\/rest\/v1\/rpc\/delete_event_occurrence(\?|$)/;
export const RPC_READ = /\/rest\/v1\/rpc\/get_event_occurrence(\?|$)/;

/**
 * Runs `trigger` (the click on «Salva tutti i prossimi» or the like) and
 * returns what `update_event` answered: the event that now holds the opened
 * occurrence and the day for `?giorno=`.
 */
export async function savedAs(
  page: Page,
  trigger: () => Promise<void>,
): Promise<{ id: string; day: string }> {
  const answer = page.waitForResponse(
    (response) =>
      RPC_UPDATE_ALL.test(response.url()) &&
      response.request().method() === "POST",
  );
  await trigger();
  const body = (await (await answer).json()) as
    { id: string; day: string }[] | { id: string; day: string };
  const row = Array.isArray(body) ? body[0] : body;
  if (!row?.id || !row.day) throw new Error("update_event senza risposta");
  return { id: row.id, day: row.day };
}

/** The request that writes (`update_event` or `update_event_occurrence`). */
export async function writeRequest(
  page: Page,
  url: RegExp,
  trigger: () => Promise<void>,
): Promise<Request> {
  const request = page.waitForRequest(
    (candidate) => url.test(candidate.url()) && candidate.method() === "POST",
  );
  await trigger();
  return request;
}

/**
 * Holds the requests that match until `release()`; then they fail (`abort`)
 * or go on (`continue`). Used to see the busy states and the errors.
 */
export async function holdRequests(
  page: Page,
  url: RegExp,
  then: "abort" | "continue",
): Promise<() => void> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await gate;
    try {
      if (then === "abort") await route.abort("failed");
      else await route.continue();
    } catch {
      // The page is gone: nothing left to answer.
    }
  });
  return release;
}

/** Makes the requests that match fail (no connection). */
export async function failRequests(page: Page, url: RegExp): Promise<void> {
  await page.route(url, (route) => route.abort("failed"));
}

/**
 * Records the bodies of the answers of the data API and of the server
 * components, to prove a text never reached the browser.
 */
export function recordBodies(page: Page): () => Promise<string> {
  const pending: Promise<string>[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/rest/v1/") || url.includes("_rsc=")) {
      pending.push(response.text().catch(() => ""));
    }
  });
  return async () => (await Promise.all(pending)).join("\n");
}

/** The HTML the server sends for a path, with the session of the page. */
export async function serverHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  return response.text();
}

/**
 * Navigates inside the app without reloading (like tapping a link), so the
 * frame knows there is a page to go back to.
 */
export async function navigateInApp(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const win = window as unknown as {
      next?: { router?: { push: (path: string) => void } };
    };
    const router = win.next?.router;
    if (!router) throw new Error("Router dell'app non raggiungibile");
    router.push(target);
  }, href);
}

// ---------------------------------------------------------------------- axe

/** Serious and critical violations of axe on the page as it is. */
export async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    )
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }));
}

/**
 * Ids that appear more than once in the document, among the elements that are
 * rendered (Next.js keeps the page it left, hidden, after a client navigation:
 * that copy is not in the accessibility tree).
 */
export async function duplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const element of document.querySelectorAll("[id]")) {
      if (!element.checkVisibility()) continue;
      seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    }
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}
