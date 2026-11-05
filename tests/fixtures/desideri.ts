import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";
import { waitForAnimationsToEnd } from "./animations";
import {
  addDays,
  monthName,
  romeDay,
  romeInstant,
  setClock,
  type Day,
} from "./casa";
import { h1, section, type FigliCtx } from "./figlio";

// Helpers of the tests of «Lista desideri» (#32, /figli/<id>/lista-desideri)
// and of its public page (#33, /desideri/<codice>), PR #279. Every test builds
// its own throwaway Nests (withFigli / withAltraCasa) and writes the lists with
// the administrative key; nothing is shared between tests. The data are those
// of the «Utenti e dati dei test» of the issues: U = Ugo, U2 = Vera, Mia, Nico,
// Fido, V = Vito with Nina, and the ideas I1 ... I5. Keys come only from
// environment variables.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const LIST_TITLE = "FamilyNest · Lista desideri";
export const NOT_ACTIVE = "Questa lista non è più attiva";
export const NOT_ACTIVE_TEXT =
  "La festa è passata o chi l'ha creata ha chiuso il link. Chiedi ai genitori un link nuovo.";

export const listPath = (childId: string) => `/figli/${childId}/lista-desideri`;
export const publicPath = (code: string) => `/desideri/${code}`;

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ------------------------------------------------------------------ the data

export type IdeaKey = "I1" | "I2" | "I3" | "I4" | "I5";
export const IDEA_KEYS: IdeaKey[] = ["I1", "I2", "I3", "I4", "I5"];

export type IdeaSpec = {
  title: string;
  url?: string;
  shop?: string;
  /** Euro cents */
  price?: number;
  note?: string;
  /** Name left by the giver: the idea is taken */
  giver?: string;
};

/** I1 ... I5 of the issues, in the order they were added. */
export const IDEAS: Record<IdeaKey, IdeaSpec> = {
  I1: {
    title: "Diario segreto con lucchetto",
    url: "https://negozio.example/diario",
    shop: "Feltrinelli",
    price: 1800,
    note: "Lo vuole tanto",
  },
  I2: { title: "Set di acquerelli con pennelli", shop: "Amazon", price: 2490 },
  I3: {
    title: "Biglietti per il musical",
    note: "Un'esperienza da fare con la nonna",
  },
  I4: {
    title: "Casco per la bici",
    shop: "Decathlon",
    price: 3500,
    giver: "Nonna Anna",
  },
  I5: { title: "Puzzle da 1000 pezzi", price: 2200, giver: "Zia Carla" },
};

export const T_I1 = IDEAS.I1.title;
export const T_I2 = IDEAS.I2.title;
export const T_I3 = IDEAS.I3.title;
export const T_I4 = IDEAS.I4.title;
export const T_I5 = IDEAS.I5.title;

/** The error the browsers' admin client gives back is never shown. */
async function must<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await query;
  if (error || data === null) throw new Error(`${what} fallito`);
  return data;
}

async function mustWrite(
  query: PromiseLike<{ error: { message: string } | null }>,
  what: string,
) {
  const { error } = await query;
  if (error) throw new Error(`${what} fallito`);
}

/** What the writers need: the administrative client and the Nest. */
export type Scope = Pick<FigliCtx, "admin" | "householdId">;

export type WishCtx = FigliCtx & {
  /** `wishlists.id` of the list */
  listId: string;
  /** Ids of the ideas, by key */
  ids: Partial<Record<IdeaKey, string>>;
  /** A link closed from the start: the reservations of I4 and I5 use it */
  closedLinkId: string | null;
  /** The day of the occasion of the closed link (G + 10) */
  occasionDay: Day;
};

export async function createList(
  ctx: Scope,
  memberId: string,
): Promise<string> {
  const row = await must(
    ctx.admin
      .from("wishlists")
      .insert({ household_id: ctx.householdId, member_id: memberId })
      .select("id")
      .single(),
    "Lista di prova",
  );
  return (row as { id: string }).id;
}

export async function insertIdea(
  ctx: Scope,
  listId: string,
  spec: Omit<IdeaSpec, "giver"> & { createdAt?: Date },
): Promise<string> {
  const row = await must(
    ctx.admin
      .from("wishlist_items")
      .insert({
        household_id: ctx.householdId,
        wishlist_id: listId,
        title: spec.title,
        url: spec.url,
        shop_name: spec.shop,
        price_cents: spec.price,
        note: spec.note,
        created_at: spec.createdAt?.toISOString(),
      })
      .select("id")
      .single(),
    "Idea di prova",
  );
  return (row as { id: string }).id;
}

/** The expiry the database gives a link: 00:00 of Rome, two days after. */
export const expiryOf = (occasion: Day): Date =>
  romeInstant(addDays(occasion, 2), 0, 0);

export type LinkRow = { id: string; code: string };

export async function insertLink(
  ctx: Scope,
  listId: string,
  options: {
    occasion: Day;
    expiresAt?: Date;
    /** Closed from the start (never works) */
    closed?: boolean;
  },
): Promise<LinkRow> {
  const row = await must(
    ctx.admin
      .from("wishlist_share_links")
      .insert({
        household_id: ctx.householdId,
        wishlist_id: listId,
        occasion_date: options.occasion,
        expires_at: (
          options.expiresAt ?? expiryOf(options.occasion)
        ).toISOString(),
        disabled_at: options.closed ? new Date().toISOString() : undefined,
      })
      .select("id, code")
      .single(),
    "Link di prova",
  );
  return row as LinkRow;
}

export async function insertReservation(
  ctx: Scope,
  itemId: string,
  linkId: string,
  name: string,
  takenAt: Date,
) {
  await mustWrite(
    ctx.admin.from("wishlist_reservations").insert({
      household_id: ctx.householdId,
      item_id: itemId,
      share_link_id: linkId,
      giver_name: name,
      created_at: takenAt.toISOString(),
    }),
    "Prenotazione di prova",
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * «Lista di Mia» of the issues: I1 ... I5 added a minute apart, I4 and then I5
 * taken (hours ago, so the rate limit of the public page does not count them).
 * There is no active link: the reservations hang from a link that is closed.
 */
export async function seedList(
  ctx: FigliCtx,
  memberId: string = ctx.mia,
  keys: IdeaKey[] = IDEA_KEYS,
): Promise<WishCtx> {
  const listId = await createList(ctx, memberId);
  const base = Date.now() - 6 * HOUR;
  const ids: Partial<Record<IdeaKey, string>> = {};
  const occasionDay = addDays(romeDay(), 10);
  let closed: LinkRow | null = null;
  for (const [index, key] of keys.entries()) {
    const { giver, ...spec } = IDEAS[key];
    const id = await insertIdea(ctx, listId, {
      ...spec,
      createdAt: new Date(base + IDEA_KEYS.indexOf(key) * MINUTE),
    });
    ids[key] = id;
    if (giver) {
      closed ??= await insertLink(ctx, listId, {
        occasion: occasionDay,
        closed: true,
      });
      const takenAt = new Date(
        Date.now() - (key === "I4" ? 3 : 2) * HOUR + index,
      );
      await insertReservation(ctx, id, closed.id, giver, takenAt);
    }
  }
  return {
    ...ctx,
    listId,
    ids,
    closedLinkId: closed?.id ?? null,
    occasionDay,
  };
}

/** Sets the birth date of Mia so that she celebrates `days` days from today. */
export function birthIn(days: number): string {
  const day = addDays(romeDay(), days);
  return `2016-${day.slice(5, 10)}`;
}

/** The next 14 December, today included (the occasion of K). */
export function nextDecember14(): Day {
  const today = romeDay();
  const year = Number(today.slice(0, 4));
  const thisYear: Day = `${year}-12-14`;
  return thisYear >= today ? thisYear : `${year + 1}-12-14`;
}

/**
 * K: an active link of the list, with the occasion on 14 December. Returns the
 * link (id and code).
 */
export async function activeLink(
  ctx: WishCtx,
  occasion: Day = nextDecember14(),
): Promise<LinkRow> {
  return insertLink(ctx, ctx.listId, { occasion });
}

/** «14 dicembre» / «15 dicembre 2027» (year only if it is not the current). */
export function dayText(day: Day, today: Day = romeDay()): string {
  const year =
    day.slice(0, 4) === today.slice(0, 4) ? "" : ` ${day.slice(0, 4)}`;
  return `${Number(day.slice(8, 10))} ${monthName(day)}${year}`;
}

// ------------------------------------------------------------------ database

export function anonClient(): SupabaseClient {
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Chiavi Supabase non impostate");
  }
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A browser key as the page makes it (random, hexadecimal). */
export const randomKey = () => randomBytes(32).toString("hex");

export type PublicRow = {
  status: string;
  child_name: string | null;
  child_color: string | null;
  occasion_month: number | null;
  occasion_day: number | null;
  items: {
    id: string;
    title: string;
    url: string | null;
    shop_name: string | null;
    note: string | null;
    price_cents: number | null;
    has_photo: boolean;
    state: string;
  }[];
};

/** What the page reads for a code, like the browser does, without a session. */
export async function readPublic(
  code: string,
  key: string | null = null,
): Promise<{ row: PublicRow | null; failed: boolean }> {
  const { data, error } = await anonClient().rpc("get_public_wishlist", {
    p_code: code,
    ...(key ? { p_giver_key: key } : {}),
  });
  const row = Array.isArray(data)
    ? (data[0] as PublicRow | undefined)
    : undefined;
  return { row: row ?? null, failed: !!error };
}

/** «Lo regalo io» as the public page calls it. */
export async function reservePublic(
  code: string,
  itemId: string,
  name: string,
  key: string = randomKey(),
): Promise<string> {
  const { data, error } = await anonClient().rpc(
    "reserve_public_wishlist_item",
    {
      p_code: code,
      p_item_id: itemId,
      p_name: name,
      p_giver_key: key,
    },
  );
  if (error) throw new Error("Presa di prova fallita");
  return String(data);
}

export async function reservationsOf(
  ctx: Scope,
  itemId: string,
): Promise<{ giver_name: string }[]> {
  const rows = await must(
    ctx.admin
      .from("wishlist_reservations")
      .select("giver_name")
      .eq("item_id", itemId),
    "Lettura delle prenotazioni",
  );
  return rows as { giver_name: string }[];
}

export async function reservationCount(
  ctx: Scope,
  listId: string,
): Promise<number> {
  const items = await ideasOf(ctx, listId);
  if (items.length === 0) return 0;
  const { count, error } = await ctx.admin
    .from("wishlist_reservations")
    .select("id", { count: "exact", head: true })
    .in(
      "item_id",
      items.map((item) => item.id),
    );
  if (error) throw new Error("Conteggio delle prenotazioni fallito");
  return count ?? 0;
}

export type IdeaRow = {
  id: string;
  title: string;
  url: string | null;
  shop_name: string | null;
  price_cents: number | null;
  note: string | null;
};

export async function ideasOf(ctx: Scope, listId: string): Promise<IdeaRow[]> {
  const rows = await must(
    ctx.admin
      .from("wishlist_items")
      .select("id, title, url, shop_name, price_cents, note")
      .eq("wishlist_id", listId),
    "Lettura delle idee",
  );
  return rows as IdeaRow[];
}

/** All the ideas of the Nest, whatever the list (a list may not exist yet). */
export async function ideasOfNest(ctx: Scope): Promise<IdeaRow[]> {
  const rows = await must(
    ctx.admin
      .from("wishlist_items")
      .select("id, title, url, shop_name, price_cents, note")
      .eq("household_id", ctx.householdId),
    "Lettura delle idee del Nest",
  );
  return rows as IdeaRow[];
}

export type LinkState = {
  id: string;
  code: string;
  disabled_at: string | null;
  expires_at: string;
};

export async function linksOf(
  ctx: Scope,
  householdId: string = ctx.householdId,
): Promise<LinkState[]> {
  const rows = await must(
    ctx.admin
      .from("wishlist_share_links")
      .select("id, code, disabled_at, expires_at")
      .eq("household_id", householdId),
    "Lettura dei link",
  );
  return rows as LinkState[];
}

/** The links of the Nest that work now (not closed, not expired). */
export async function activeLinksOf(ctx: Scope): Promise<LinkState[]> {
  const now = Date.now();
  return (await linksOf(ctx)).filter(
    (link) => link.disabled_at === null && Date.parse(link.expires_at) > now,
  );
}

// ------------------------------------------------------------------ locators

export const wishH1 = (name: string) => `I desideri di ${name}`;

/** The «+» of the bar (390) or, for the empty state, the button of the page. */
export const addTrigger = (page: Page): Locator =>
  page
    .locator(".barra, main")
    .getByRole("button", { name: "Aggiungi un'idea", exact: true })
    .first();
/** The button inside `main` (head at 1280, empty state at both sizes). */
export const mainAdd = (page: Page): Locator =>
  page
    .locator("main")
    .getByRole("button", { name: "Aggiungi un'idea", exact: true });
export const barAdd = (page: Page): Locator =>
  page
    .locator(".barra")
    .getByRole("button", { name: "Aggiungi un'idea", exact: true });

export const addDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "Aggiungi un'idea", exact: true });
export const editDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "Modifica l'idea", exact: true });
export const copyDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "Copia il link", exact: true });
export const confirmDialog = (page: Page, title: string): Locator =>
  page.getByRole("alertdialog", { name: title, exact: true });

export const occasionRow = (page: Page): Locator =>
  page.locator(".riga-scadenza");
export const shareBlock = (page: Page): Locator =>
  page.locator(".scheda--scura");
export const shareButton = (page: Page): Locator =>
  shareBlock(page).getByRole("button", { name: "Condividi", exact: true });
export const disableButton = (page: Page): Locator =>
  shareBlock(page).getByRole("button", {
    name: "Disattiva il link",
    exact: true,
  });

/** The rows of a section of the page of the parents («Da regalare», «Già presi»). */
export const ideaRows = (page: Page, title: string): Locator =>
  section(page, title).locator("li.riga-regalo");
export const ideaRow = (page: Page, title: string): Locator =>
  page.locator("li.riga-regalo").filter({ hasText: title });

export const toastWith = (page: Page, text: string): Locator =>
  page.getByTestId("toast").filter({ hasText: text });

export const field = (scope: Locator, label: string): Locator =>
  scope.getByLabel(label, { exact: true });

/** Opens the list of the parents with Ugo (or `who`) and waits for the h1. */
export async function openList(
  page: Page,
  baseURL: string | undefined,
  ctx: FigliCtx,
  who: string,
  childId: string,
  name: string,
  options: { clock?: Date } = {},
) {
  if (options.clock) await setClock(page, options.clock);
  await ctx.nest.signIn(page, baseURL, who);
  await page.goto(listPath(childId));
  await expect(h1(page)).toHaveText(wishH1(name));
}

/** Opens the sheet to add an idea and waits for its animation. */
export async function openAdd(page: Page): Promise<Locator> {
  await addTrigger(page).click();
  const dialog = addDialog(page);
  await expect(dialog).toBeVisible();
  await waitForAnimationsToEnd(page);
  return dialog;
}

/** Fills the sheet of the new idea (only the fields that are given). */
export async function fillIdea(
  dialog: Locator,
  values: { link?: string; idea?: string; note?: string },
) {
  if (values.link !== undefined) {
    await field(dialog, "Link del negozio").fill(values.link);
  }
  if (values.idea !== undefined) {
    await field(dialog, "Oppure scrivi l'idea").fill(values.idea);
  }
  if (values.note !== undefined) {
    await field(dialog, "Nota per chi regala").fill(values.note);
  }
}

export const submitIdea = (dialog: Locator): Locator =>
  dialog.getByRole("button", { name: "Aggiungi alla lista", exact: true });

/** Opens the sheet of an idea of the page of the parents. */
export async function openIdea(page: Page, title: string): Promise<Locator> {
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = editDialog(page);
  await expect(dialog).toBeVisible();
  await waitForAnimationsToEnd(page);
  return dialog;
}

// ------------------------------------------------------------------- network

/** Makes the calls of the page to a path fail without an answer (no network). */
export async function abortRequests(page: Page, url: RegExp) {
  await page.route(url, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fallback();
      return;
    }
    await route.abort("failed");
  });
}

/** Makes the server actions of a page fail without an answer (no network). */
export async function abortServerActions(page: Page, path: RegExp) {
  await page.route(path, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await route.abort("failed");
      return;
    }
    await route.fallback();
  });
}

/** Stops the calls of the page to a path until `release()`. */
export async function holdRequests(page: Page, url: RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fallback();
      return;
    }
    await gate;
    try {
      await route.fallback();
    } catch {
      // The page is gone.
    }
  });
  return { release };
}

export const RPC_RESERVE = /\/rest\/v1\/rpc\/reserve_public_wishlist_item/;
export const RPC_READ_PUBLIC = /\/rest\/v1\/rpc\/get_public_wishlist(\?|$)/;
export const RPC_SHARE = /\/rest\/v1\/rpc\/share_wishlist/;
export const RPC_ANY = /\/rest\/v1\/rpc\//;

/** Every URL the browser asked for, from now on. */
export function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

// ----------------------------------------------------------------- test shops

/**
 * The only shop origin the app accepts even if local: `SHOP_LINK_TEST_ORIGIN`
 * (read by the app, ignored on Vercel). The CI workflows do not set it, so the
 * tests that need it are skipped there: the idea is then added by hand.
 */
export const SHOP_ORIGIN = process.env.SHOP_LINK_TEST_ORIGIN?.replace(
  /\/+$/,
  "",
);

/** A 1x1 JPEG, enough for the app to copy and reduce. */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

/** Serves `/diario` and `/vuota` on the port of the test origin. */
export async function startShop(): Promise<Server> {
  if (!SHOP_ORIGIN) throw new Error("Origine di prova non impostata");
  const port = Number(new URL(SHOP_ORIGIN).port);
  const server = createServer((request, response) => {
    if (request.url === "/diario") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(
        `<!doctype html><html><head><title>Diario</title>
<meta property="og:title" content="Diario segreto con lucchetto">
<meta property="og:site_name" content="Feltrinelli">
<meta property="product:price:amount" content="18.00">
<meta property="product:price:currency" content="EUR">
<meta property="og:image" content="${SHOP_ORIGIN}/diario.jpg">
</head><body>Diario</body></html>`,
      );
      return;
    }
    if (request.url === "/diario.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(TINY_JPEG);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("no");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

/** A local server on a port the app does not allow: counts what it receives. */
export async function startCounter(): Promise<{
  port: number;
  count: () => number;
  close: () => Promise<void>;
}> {
  let received = 0;
  const server = createServer((_request, response) => {
    received += 1;
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<title>x</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    count: () => received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/** A link that cannot be read: nothing answers on `.example`. */
export const UNREADABLE_LINK = "https://negozio.example/vuota";
