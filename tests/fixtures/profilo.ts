import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient, type MemberNest } from "./membro";
import { throwawayConfigured, throwawaySkipReason } from "./throwaway-user";
import { skipReason, usersConfigured, type TestUserKey } from "./auth";

// Shared by the specs of "Il tuo profilo" (#38, /profilo). The seeded users only
// read; every test that writes (colour, preferences, file with data, sign out,
// deletion) uses throwaway users, deleted at the end of the test.

export {
  IDS,
  adminClient,
  withMemberNest,
  withRita,
  type MemberNest,
  type RitaNest,
} from "./membro";

export const PATH = "/profilo";
export const PAGE_TITLE = "FamilyNest · Il tuo profilo";
export const LOAD_ERROR = "Questa pagina non si è caricata";
export const DELETED_NOTICE = "Il tuo account è stato eliminato.";

export const COLOR_SERVER_ERROR =
  "Non siamo riusciti a cambiare il colore per un problema nostro. Riprova tra qualche minuto.";
export const COLOR_NETWORK_ERROR =
  "Non siamo riusciti a cambiare il colore. Controlla la connessione e riprova.";
export const COLOR_TAKEN_ERROR =
  "Questo colore l'ha appena preso qualcun altro: scegline un altro.";
export const PREFERENCE_SERVER_ERROR =
  "Non siamo riusciti a salvare la scelta per un problema nostro. Riprova tra qualche minuto.";
export const PREFERENCE_NETWORK_ERROR =
  "Non siamo riusciti a salvare la scelta. Controlla la connessione e riprova.";
export const DATA_SERVER_ERROR =
  "Non siamo riusciti a preparare i tuoi dati per un problema nostro. Riprova tra qualche minuto.";
export const DATA_NETWORK_ERROR =
  "Non siamo riusciti a preparare i tuoi dati. Controlla la connessione e riprova.";
export const DELETE_SERVER_ERROR =
  "Non siamo riusciti a eliminare l'account per un problema nostro. Non è cambiato niente: riprova tra qualche minuto.";
export const DELETE_NETWORK_ERROR =
  "Non siamo riusciti a eliminare l'account. Controlla la connessione e riprova.";

export const isMobile = () => test.info().project.name === "mobile";

export function needsUsers(...keys: TestUserKey[]) {
  test.skip(!usersConfigured(...keys), skipReason(...keys));
}

export function needsThrowaway() {
  test.skip(!throwawayConfigured(), throwawaySkipReason);
}

// ---------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
export const mainOf = (page: Page) => page.getByRole("main");
export const subtitle = (page: Page) => page.locator(".intestazione__sotto");

export const colorGroup = (page: Page) =>
  page.getByRole("radiogroup", { name: "Il tuo colore" });
export const colorRadio = (page: Page, name: string) =>
  colorGroup(page).getByRole("radio", { name, exact: true });
/** The avatar of the head of the page. */
export const headAvatar = (page: Page) =>
  page.locator(".profilo-testa .avatar").first();

/** A row (`.riga-lista`) of the page, found by its title. */
export const rowOf = (page: Page, title: string) =>
  page
    .locator(".riga-lista")
    .filter({ has: page.getByText(title, { exact: true }) });
export const valueOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-lista__valore");
export const infoOf = (page: Page, title: string) =>
  rowOf(page, title).locator(".riga-lista__info");

export const sheetOf = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title, exact: true });
export const alertWith = (page: Page, text: string) =>
  page.getByRole("alert").filter({ hasText: text });

/** The buttons of the page (the dialogs are outside <main>). */
export const signOutButton = (page: Page) =>
  mainOf(page).getByRole("button", { name: "Esci", exact: true });
export const deleteButton = (page: Page) =>
  mainOf(page).getByRole("button", { name: "Elimina l'account", exact: true });

export const signOutDialog = (page: Page) =>
  page.getByRole("alertdialog", { name: "Uscire da FamilyNest?", exact: true });
export const deleteDialog = (page: Page) =>
  page.getByRole("alertdialog", {
    name: "Eliminare il tuo account?",
    exact: true,
  });

// --------------------------------------------------------------- hydration

/** Waits until React has taken over the element (a click before is lost). */
export async function waitHydrated(target: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        target.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactFiber$")),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** Opens /profilo, waits for the heading and for the page to be hydrated. */
export async function openProfile(page: Page) {
  await page.goto(PATH);
  await expect(h1(page)).toBeVisible();
  await waitHydrated(signOutButton(page));
}

// ------------------------------------------------------------ network traps

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};

/**
 * Makes the writes (PATCH) of a table fail: `server` answers 500 with a body
 * that has no database code, `network` aborts the request (status 0).
 */
export async function breakWrites(
  page: Page,
  table: "household_members" | "profiles",
  how: "server" | "network",
) {
  await page.route(new RegExp(`/rest/v1/${table}(\\?|$)`), async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    if (how === "network") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ message: "boom" }),
    });
  });
}

/** Makes a route of the app answer 500, or fail like a lost connection. */
export async function breakRoute(
  page: Page,
  path: string,
  how: "server" | "network",
) {
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (how === "network") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false }),
    });
  });
}

/** Counts the "refresh" requests of the router (RSC GET of the page). */
export function countRefreshes(page: Page) {
  let seen = 0;
  page.on("request", (request) => {
    const headers = request.headers();
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname === PATH &&
      headers["rsc"] === "1" &&
      !headers["next-router-prefetch"]
    ) {
      seen += 1;
    }
  });
  return () => seen;
}

// ---------------------------------------------------------------- database

export async function colorOf(userId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("household_members")
    .select("color")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Lettura del colore di prova fallita");
  return data ? (data.color as string) : null;
}

export type ProfileRow = {
  start_lens: string;
  morning_digest_time: string;
  default_event_visibility: string;
};

export async function profileOf(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("start_lens, morning_digest_time, default_event_visibility")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Lettura del profilo di prova fallita");
  return data as ProfileRow | null;
}

export async function authUserExists(userId: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.getUserById(userId);
  return !error && !!data.user;
}

export async function householdExists(householdId: string): Promise<boolean> {
  const { count, error } = await adminClient()
    .from("households")
    .select("id", { count: "exact", head: true })
    .eq("id", householdId);
  if (error) throw new Error("Lettura del Nest di prova fallita");
  return (count ?? 0) > 0;
}

/** Number of rows of a table of the Nest, read with the administrative key. */
export async function rowsOfHousehold(
  table:
    | "household_members"
    | "invitations"
    | "shopping_items"
    | "events"
    | "todos"
    | "pinned_spaces",
  householdId: string,
): Promise<number> {
  const { count, error } = await adminClient()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);
  if (error) throw new Error(`Conteggio di ${table} fallito`);
  return count ?? 0;
}

// ---------------------------------------------------------- data of a person

const DAY = 24 * 60 * 60 * 1000;

export type EventVisibility = "private" | "busy" | "household";

/** Creates an event with the session of the user (the author is the user). */
export async function createEventAs(
  user: MemberNest["user"],
  memberIds: string[],
  title: string,
  visibility: EventVisibility,
): Promise<void> {
  const start = Date.now() + 2 * DAY;
  const { error } = await user.client.rpc("create_event", {
    p_title: title,
    p_starts_at: new Date(start).toISOString(),
    p_ends_at: new Date(start + 60 * 60 * 1000).toISOString(),
    p_visibility: visibility,
    p_member_ids: memberIds,
  });
  if (error) throw new Error(`Impegno di prova non creato: ${title}`);
}

export async function addShoppingAs(
  user: MemberNest["user"],
  name: string,
): Promise<void> {
  const { error } = await user.client.from("shopping_items").insert({ name });
  if (error) throw new Error(`Spesa di prova non aggiunta: ${name}`);
}

/**
 * The things the user "put in", as CA-25 and CA-35 describe them: three events
 * (Tutto il Nest, Solo io, Occupato), two things to do (one only for the user),
 * a deadline, a shopping item and the pinned space `meals`.
 */
export async function seedMine(ctx: MemberNest, titles: SeedTitles) {
  const { user, adminMemberId } = ctx;
  await createEventAs(user, [adminMemberId], titles.shared, "household");
  await createEventAs(user, [adminMemberId], titles.private, "private");
  await createEventAs(user, [adminMemberId], titles.busy, "busy");
  const todos = await user.client.from("todos").insert([
    { title: titles.todo, is_private: false },
    { title: titles.privateTodo, is_private: true },
  ]);
  if (todos.error) throw new Error("Cose da fare di prova non create");
  const deadline = await user.client
    .from("deadlines")
    .insert({ title: titles.deadline, due_date: "2027-03-01" });
  if (deadline.error) throw new Error("Scadenza di prova non creata");
  await addShoppingAs(user, titles.shopping);
  const pin = await user.client.rpc("pin_space", { p_space: "meals" });
  if (pin.error) throw new Error("Spazio di prova non fissato");
}

export type SeedTitles = {
  shared: string;
  private: string;
  busy: string;
  todo: string;
  privateTodo: string;
  deadline: string;
  shopping: string;
};

export const MY_TITLES: SeedTitles = {
  shared: "Riunione di classe",
  private: "Corsa",
  busy: "Cena fuori",
  todo: "Pagare la mensa",
  privateTodo: "Regalo a sorpresa",
  deadline: "Rinnovo carta d'identità",
  shopping: "Latte",
};

// ------------------------------------------------------------- the data file

export type DataFile = {
  esportato_il: string;
  account: { mail: string | null; nome: string; accesso: string };
  preferenze: {
    all_apertura: string;
    sintesi_del_mattino: string;
    visibilita_predefinita: string;
  };
  preferenze_di_notifica: {
    impegni: boolean;
    cose_da_fare_assegnate: boolean;
    spesa: boolean;
    liberi_insieme: boolean;
    sintesi_del_mattino: boolean;
  } | null;
  nest: { nome: string };
  impegni: Array<{ titolo: string }>;
  da_fare: Array<{ titolo: string }>;
  scadenze: Array<{ titolo: string }>;
  spesa: Array<{ nome: string }>;
  idee_regalo: Array<{
    titolo: string;
    link: string | null;
    nota: string | null;
  }>;
  avvisi_degli_spazi: Array<{ spazio: string }>;
  spazi_fissati: Array<{ spazio: string }>;
};

/** Taps «I tuoi dati» and reads the file the browser downloads. */
export async function downloadData(page: Page) {
  const waiting = page.waitForEvent("download");
  await rowOf(page, "I tuoi dati").click();
  const download = await waiting;
  const path = await download.path();
  const text = await readFile(path, "utf8");
  return {
    name: download.suggestedFilename(),
    text,
    json: JSON.parse(text) as DataFile,
  };
}

/** Today in Europe/Rome as YYYY-MM-DD. */
export function romeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 10);
}

export const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Names of the Supabase session cookies in the context. */
export async function sessionCookieNames(page: Page): Promise<string[]> {
  const cookies = await page.context().cookies();
  return cookies
    .map((cookie) => cookie.name)
    .filter((name) => /^sb-.+-auth-token/.test(name));
}
