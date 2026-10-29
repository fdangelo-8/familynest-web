import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test as base, type Page } from "@playwright/test";
import type { Database } from "../../src/types/database";
import { skipReason, usersConfigured, type TestUserKey } from "./auth";

// Helpers for the shopping list tests (#21): data set-up through the API with
// the session of a test user (RLS applies, no secret key), a lock that keeps
// the tests on the same Nests in series, and the geometry of the "strappo".
//
// Credentials come only from environment variables (see tests/fixtures/auth.ts).

export const HOME_A = "11111111-1111-4111-8111-111111111111";
export const HOME_B = "22222222-2222-4222-8222-222222222222";

type Client = SupabaseClient<Database>;

const clients = new Map<string, Promise<Client>>();

/** Signed-in API client of a test user (A = Marco, B = Giulia, B2 = Paolo). */
export function apiAs(key: TestUserKey): Promise<Client> {
  let client = clients.get(key);
  if (!client) {
    client = (async () => {
      const created = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error } = await created.auth.signInWithPassword({
        email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
        password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
      });
      if (error) throw new Error(`Accesso API fallito per ${key}`);
      return created;
    })();
    clients.set(key, client);
  }
  return client;
}

/** Empties the shopping list of the Nest of a user (takes everything, tears it). */
export async function resetShopping(key: TestUserKey): Promise<void> {
  const api = await apiAs(key);
  const { data, error } = await api
    .from("shopping_items")
    .select("id, checked_at");
  if (error) throw new Error("Lettura della spesa fallita");
  const open = (data ?? []).filter((row) => !row.checked_at);
  if (open.length > 0) {
    await api
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .in(
        "id",
        open.map((row) => row.id),
      );
  }
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { error: clearError } = await api.rpc(
      "clear_checked_shopping_items",
      { item_ids: ids },
    );
    if (clearError) throw new Error("Pulizia della spesa fallita");
  }
}

export type NewItem = string | { name: string; quantity?: string };

/** Adds things in order (one request each, so the creation order is certain). */
export async function addShopping(
  key: TestUserKey,
  items: NewItem[],
): Promise<void> {
  const api = await apiAs(key);
  for (const item of items) {
    const row = typeof item === "string" ? { name: item } : item;
    const { error } = await api.from("shopping_items").insert(row);
    if (error) throw new Error("Aggiunta alla spesa fallita");
  }
}

/** Takes things in order: the last one in the list is the last one taken. */
export async function takeShopping(
  key: TestUserKey,
  names: string[],
): Promise<void> {
  const api = await apiAs(key);
  for (const name of names) {
    const { data } = await api
      .from("shopping_items")
      .select("id")
      .eq("name", name)
      .is("checked_at", null);
    const id = data?.[0]?.id;
    if (!id) throw new Error("Cosa da spuntare non trovata");
    const { error } = await api
      .from("shopping_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error("Spunta fallita");
  }
}

/** Tears all the taken things through the API (what another member does). */
export async function tearShopping(key: TestUserKey): Promise<void> {
  const api = await apiAs(key);
  const { data } = await api
    .from("shopping_items")
    .select("id")
    .not("checked_at", "is", null);
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length === 0) return;
  const { error } = await api.rpc("clear_checked_shopping_items", {
    item_ids: ids,
  });
  if (error) throw new Error("Strappo fallito");
}

/** What the database holds for the Nest of the user, in the order of the page. */
export async function readShopping(key: TestUserKey): Promise<{
  toTake: string[];
  taken: string[];
}> {
  const api = await apiAs(key);
  const { data, error } = await api
    .from("shopping_items")
    .select("name, checked_at, created_at, id");
  if (error) throw new Error("Lettura della spesa fallita");
  const rows = data ?? [];
  return {
    toTake: rows
      .filter((row) => row.checked_at === null)
      .sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      )
      .map((row) => row.name),
    taken: rows
      .filter((row) => row.checked_at !== null)
      .sort(
        (a, b) =>
          (b.checked_at as string).localeCompare(a.checked_at as string) ||
          a.id.localeCompare(b.id),
      )
      .map((row) => row.name),
  };
}

// ---------------------------------------------------------------------- lock

// Desktop and mobile run in parallel and share the same two Nests: the tests
// that touch a shopping list take this lock, so they run one at a time.
const LOCK_DIR = join(tmpdir(), "familynest-spesa-test-lock");
const STALE_MS = 3 * 60 * 1000;

function tryLock(): boolean {
  try {
    mkdirSync(LOCK_DIR);
    return true;
  } catch {
    try {
      if (Date.now() - statSync(LOCK_DIR).mtimeMs > STALE_MS) {
        rmSync(LOCK_DIR, { recursive: true, force: true });
      }
    } catch {
      // the other test just released it
    }
    return false;
  }
}

/**
 * `test` with the lock and clean lists: before and after each test the lists
 * of Casa D'Angelo and Casa Bianchi are empty, so every test creates its data.
 */
export const test = base.extend<{ cleanLists: void }>({
  cleanLists: [
    async ({}, provide) => {
      base.skip(!usersConfigured("A", "B"), skipReason("A", "B"));
      await expect
        .poll(() => tryLock(), {
          timeout: 20 * 60 * 1000,
          intervals: [50, 100, 250],
        })
        .toBe(true);
      try {
        await resetShopping("A");
        await resetShopping("B");
        await provide();
      } finally {
        try {
          await resetShopping("A");
          await resetShopping("B");
        } finally {
          rmSync(LOCK_DIR, { recursive: true, force: true });
        }
      }
    },
    // The wait for the lock must not eat the time of the test.
    { auto: true, timeout: 21 * 60 * 1000 },
  ],
});

// --------------------------------------------------------------------- helpers

/**
 * Checks that `predicate` stays true for `ms` milliseconds (to prove that
 * nothing happens, without a fixed wait).
 */
export async function holdsFor(
  ms: number,
  predicate: () => Promise<boolean>,
  message: string,
): Promise<void> {
  const start = Date.now();
  let failed = false;
  await expect
    .poll(
      async () => {
        if (!(await predicate())) failed = true;
        return failed || Date.now() - start >= ms;
      },
      { timeout: ms + 10_000, intervals: [100] },
    )
    .toBe(true);
  expect(failed, message).toBe(false);
}

/** Value of a size token in pixels (for example `--size-tocco`). */
export async function tokenPx(page: Page, token: string): Promise<number> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.width = `var(${name})`;
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  }, token);
}

/**
 * Drags the scissors of the "strappo" to a part of the run and releases them.
 * Run = width of the strip - `--size-tocco` - 2 x `--space-1` (spec section 4).
 * Returns the run in pixels.
 */
export async function dragBlade(page: Page, fraction: number): Promise<number> {
  const blade = page.getByRole("button", { name: /^Togli dalla lista/ });
  await blade.hover();
  const strip = page.getByTestId("spesa-strappo");
  const stripWidth = (await strip.boundingBox())?.width ?? 0;
  const run =
    stripWidth -
    (await tokenPx(page, "--size-tocco")) -
    2 * (await tokenPx(page, "--space-1"));
  const box = await blade.boundingBox();
  if (!box) throw new Error("Forbici non trovate");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + run * fraction, y, { steps: 12 });
  await page.mouse.up();
  return run;
}
