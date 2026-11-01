import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";
import { SPACES, type SpaceKey } from "../../src/lib/spaces";
import { buildNest, CORS, type CasaNest, type MemberSpec } from "./casa";
import type { TestUserKey } from "./auth";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers for the tests of Esplora (#28). Everything that writes uses
// throwaway Nests and users (deleted at the end of the test); the seed users
// are only read. Keys and passwords come only from environment variables.
//
// Selectors expected from the page (see the list in the report of the tester):
//   - h1 "Cosa può fare la vostra casa"; the grid is `ul.griglia-moduli`
//     (visible one), one `li` per space with `.scheda-modulo__titolo` (name),
//     one `a` (the link) and one `button` (the pin, `aria-pressed`);
//   - toast: `role="status"` with a "Annulla" button when it has an action;
//   - loading: a container `[aria-busy="true"]` with the hidden text
//     "Caricamento in corso" and 6 `.skeleton--scheda`.

export const PATH = "/esplora";

/** Catalogue order (CA-4). */
export const CATALOGUE = SPACES.map((space) => space.name);

export function keyOf(name: string): SpaceKey {
  const found = SPACES.find((space) => space.name === name);
  if (!found) throw new Error(`Spazio sconosciuto: ${name}`);
  return found.key;
}

export const hrefOf = (name: string): string => {
  const found = SPACES.find((space) => space.name === name);
  if (!found) throw new Error(`Spazio sconosciuto: ${name}`);
  return found.href;
};

export const isMobileProject = (project: string) => project === "mobile";

// ------------------------------------------------------------------ locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** The list of the spaces (the visible one, in case both layouts are in the DOM). */
export const grid = (page: Page) => page.locator("ul.griglia-moduli:visible");

export const cards = (page: Page) => grid(page).getByRole("listitem");

/** The card of a space, found by its name. */
export const card = (page: Page, name: string) =>
  cards(page).filter({ has: page.getByText(name, { exact: true }) });

/** The pin of a space, whatever its state (the label changes with it). */
export const pin = (page: Page, name: string) =>
  card(page, name).getByRole("button");

export const pinFix = (page: Page, name: string) =>
  page.getByRole("button", { name: `Fissa ${name} in Oggi`, exact: true });

export const pinRemove = (page: Page, name: string) =>
  page.getByRole("button", { name: `Togli ${name} da Oggi`, exact: true });

export const linkOf = (page: Page, name: string) =>
  card(page, name).getByRole("link");

/** Every pin of the grid. */
export const pins = (page: Page) => grid(page).getByRole("button");

/** The toast (role=status). Next.js keeps its announcer as role=alert. */
export const toast = (page: Page, text?: string | RegExp) => {
  const all = page.getByRole("status");
  return text === undefined ? all : all.filter({ hasText: text });
};

export const undoButton = (page: Page) =>
  page.getByRole("status").getByRole("button", { name: "Annulla" });

/** The loading container. */
export const busy = (page: Page) =>
  page
    .locator('[aria-busy="true"]')
    .filter({ hasText: "Caricamento in corso" });

export const errorBox = (page: Page) =>
  page
    .getByRole("alert")
    .filter({ hasText: "Questa pagina non si è caricata" });

export const retryButton = (page: Page) =>
  page.getByRole("button", { name: "Riprova" });

// ----------------------------------------------------------------- hydration

/**
 * Waits until React has taken over the element: before that a click does
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

/**
 * Opens Esplora and waits for the grid with `count` spaces to be drawn and
 * hydrated. No fixed wait.
 */
export async function openEsplora(page: Page, count = 10): Promise<void> {
  await page.goto(PATH);
  await expect(h1(page)).toBeVisible();
  await expect(cards(page)).toHaveCount(count, { timeout: 20_000 });
  await waitHydrated(pins(page).first());
}

// ------------------------------------------------------------- network traps

const RPC = (name: "pin_space" | "unpin_space") =>
  new RegExp(`/rest/v1/rpc/${name}(\\?|$)`);

export const PINNED_READ = /\/rest\/v1\/pinned_spaces(\?|$)/;
export { RPC };

/** Makes the matching requests fail with a database error (HTTP 500). */
export async function failRequests(page: Page, pattern: RegExp) {
  await page.route(pattern, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ code: "XX000", message: "boom" }),
    });
  });
}

/**
 * Holds the matching requests until `release()` is called (the request is
 * slowed down by the test, not by a wait). Returns how many were seen.
 */
export async function holdRequests(page: Page, pattern: RegExp) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let seen = 0;
  await page.route(pattern, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    seen += 1;
    await gate;
    await route.continue();
  });
  return { release, seen: () => seen };
}

/** Counts the requests (of any method but OPTIONS) that match, without changing them. */
export async function countRequests(page: Page, pattern: RegExp) {
  let seen = 0;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "OPTIONS") seen += 1;
    await route.continue();
  });
  return () => seen;
}

// ------------------------------------------------------------------ the Nests

// Ten colours, all different inside a Nest (unique constraint).
const C = [
  "pomodoro",
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
] as unknown as MemberSpec["color"][];

/** «Solo io»: the only adult, no children, no pets (CA-9, CA-22). */
export const SOLO: MemberSpec[] = [
  { name: "Ilaria", kind: "adult", color: C[0]!, account: true },
];

/**
 * The Nest of CA-10: Ilaria (with account) and Luca (adult never invited),
 * children Anna, Bea, Carlo and pets Fido, Micia, in this order.
 */
export const FULL: MemberSpec[] = [
  { name: "Ilaria", kind: "adult", color: C[0]!, account: true },
  { name: "Luca", kind: "adult", color: C[1]! },
  { name: "Anna", kind: "child", color: C[2]! },
  { name: "Bea", kind: "child", color: C[3]! },
  { name: "Carlo", kind: "child", color: C[4]! },
  { name: "Fido", kind: "pet", color: C[5]! },
  { name: "Micia", kind: "pet", color: C[6]! },
];

/** The Nest of CA-21: all the spaces, and Fido as the only animal. */
export const WITH_FIDO: MemberSpec[] = [
  { name: "Ilaria", kind: "adult", color: C[0]!, account: true },
  { name: "Luca", kind: "adult", color: C[1]! },
  { name: "Anna", kind: "child", color: C[2]! },
  { name: "Fido", kind: "pet", color: C[5]! },
];

export type EsploraNest = {
  nest: CasaNest;
  /** The owner of the Nest (the user who signs in) */
  user: ThrowawayUser;
  /** Member id of the owner */
  memberId: string;
  /** Signs the page in as the owner */
  signIn: (page: Page, baseURL: string | undefined) => Promise<void>;
  /** Pins spaces with the session of the owner, one after the other */
  pinAll: (names: string[]) => Promise<void>;
  /** Pinned spaces of the owner in order of pinning, read through RLS */
  pinned: () => Promise<SpaceKey[]>;
  /** Rows of `pinned_spaces` of the whole Nest, read with the administrative key */
  rowsOfNest: () => Promise<{ member_id: string; space: SpaceKey }[]>;
};

/** Runs `body` with a throwaway Nest; everything is deleted at the end. */
export async function withNest(
  specs: MemberSpec[],
  body: (ctx: EsploraNest) => Promise<void>,
): Promise<void> {
  const { nest, cleanup } = await buildNest("Casa di Ilaria", specs);
  try {
    const user = nest.users[specs[0]!.name]!;
    const memberId = nest.members[specs[0]!.name]!;
    const pinned = async () => {
      const { data, error } = await user.client
        .from("pinned_spaces")
        .select("space")
        .order("pinned_at", { ascending: true });
      if (error) throw new Error("Lettura degli spazi fissati fallita");
      return (data ?? []).map((row) => row.space as SpaceKey);
    };
    const ctx: EsploraNest = {
      nest,
      user,
      memberId,
      signIn: (page, baseURL) => nest.signIn(page, baseURL, specs[0]!.name),
      async pinAll(names) {
        for (const name of names) {
          const { error } = await user.client.rpc("pin_space", {
            p_space: keyOf(name),
          });
          if (error) throw new Error(`Spazio non fissato: ${name}`);
        }
      },
      pinned,
      async rowsOfNest() {
        const { data, error } = await user.admin
          .from("pinned_spaces")
          .select("member_id, space")
          .eq("household_id", nest.householdId);
        if (error) throw new Error("Lettura amministrativa fallita");
        return (data ?? []) as { member_id: string; space: SpaceKey }[];
      },
    };
    await body(ctx);
  } finally {
    await cleanup();
  }
}

/** Waits until the owner has exactly these pinned spaces (in order) in the database. */
export async function expectPinned(
  ctx: EsploraNest,
  names: string[],
): Promise<void> {
  await expect.poll(() => ctx.pinned()).toEqual(names.map(keyOf));
}

/**
 * A second member with account who joins the Nest of `ctx` through an
 * invitation (`accept_invitation`), as in the real flow. Returns the new user
 * and its member id; the caller removes the user.
 */
export async function joinWithInvitation(
  ctx: EsploraNest,
  name: string,
  color: string,
): Promise<{ user: ThrowawayUser; memberId: string }> {
  const { data: member, error: memberError } = await ctx.user.admin
    .from("household_members")
    .insert({
      household_id: ctx.nest.householdId,
      kind: "adult",
      name,
      color,
    })
    .select("id")
    .single();
  if (memberError || !member) throw new Error("Membro invitato non aggiunto");
  const { data: invitation, error: inviteError } = await ctx.user.admin
    .from("invitations")
    .insert({
      household_id: ctx.nest.householdId,
      member_id: member.id,
      invited_by_member_id: ctx.memberId,
    })
    .select("token")
    .single();
  if (inviteError || !invitation) throw new Error("Invito di prova non creato");
  const user = await createThrowawayUser(name);
  try {
    const { error } = await user.client.rpc("accept_invitation", {
      token: invitation.token,
    });
    if (error) throw new Error("Invito di prova non accettato");
  } catch (error) {
    await user.remove();
    throw error;
  }
  return { user, memberId: member.id as string };
}

// ------------------------------------------------------------------ seed user

/** Client signed in as a seed user (read only: the seed users never pin). */
export async function seedClient(key: TestUserKey): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const publishable = process.env
    .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  });
  if (error) throw new Error(`Accesso di prova fallito per ${key}`);
  return client;
}
