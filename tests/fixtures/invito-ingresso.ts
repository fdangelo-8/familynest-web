import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";
import {
  SEED_LAURA_MEMBER_ID,
  pendingInviteOf,
  type InviteRow,
} from "./invito";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Shared by tests/e2e/invito-ingresso.spec.ts and
// tests/a11y/invito-ingresso.spec.ts (pages /invito and /invito/colore, #16).
// The seed users A, B and C only read. Everything that changes invitations or
// members uses a throwaway Nest "Casa De Santis" (user U) and a throwaway
// visitor without a Nest (user V), both deleted at the end of the test.

export const COOKIE = "familynest_invito";
export const COLORS = [
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
] as const;
export type Color = (typeof COLORS)[number];

export const ROME = "Europe/Rome";

export const capitalized = (color: string) =>
  color.charAt(0).toUpperCase() + color.slice(1);

/** Valid invitation of Laura in the seed (Marco's Nest, "Casa D'Angelo"). */
export const lauraInvite = (): Promise<InviteRow> =>
  pendingInviteOf(SEED_LAURA_MEMBER_ID);

export const linkOf = (origin: string, token: string) =>
  `${origin}/invito/${token}`;

/** The invitation cookie as the browser context holds it, or `undefined`. */
export async function inviteCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === COOKIE);
}

/** Puts a token in the invitation cookie, as the link route would. */
export async function setInviteCookie(
  page: Page,
  baseURL: string,
  token: string,
) {
  await page.context().addCookies([
    {
      name: COOKIE,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// ----------------------------------------------------------------- dates

function romeFields(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function romeDayNumber(date: Date): number {
  const { year, month, day } = romeFields(date);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** The instant at `hour:minute` Rome time, `dayOffset` days from today. */
export function romeInstant(
  dayOffset: number,
  hour: number,
  minute: number,
  now: Date = new Date(),
): Date {
  const today = romeFields(now);
  const wanted = Date.UTC(
    today.year,
    today.month - 1,
    today.day + dayOffset,
    hour,
    minute,
  );
  let guess = wanted;
  // Two passes settle the offset, also around a change of the clocks.
  for (let pass = 0; pass < 2; pass += 1) {
    const f = romeFields(new Date(guess));
    const shown = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
    guess -= shown - wanted;
  }
  return new Date(guess);
}

/**
 * The validity sentence the welcome page must show for an invitation, with the
 * days counted on the Rome calendar (written here, not taken from the app).
 */
export function expectedLead(expiresAt: string, now: Date = new Date()) {
  const expires = new Date(expiresAt);
  const days = romeDayNumber(expires) - romeDayNumber(now);
  if (days >= 2) return `Invito valido ancora ${days} giorni.`;
  const { hour, minute } = romeFields(expires);
  const time = `${hour}:${String(minute).padStart(2, "0")}`;
  return days === 1
    ? `Invito valido fino a domani alle ${time}.`
    : `Invito valido fino a oggi alle ${time}.`;
}

// ------------------------------------------------------------ text checks

/**
 * True when `needle` appears in `haystack` as a whole word or number: the
 * characters around it are not letters, digits or the separators of file names
 * (a chunk called `4821-ab12.js` is not the code 4821).
 */
export function mentions(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_./-])${escaped}(?![A-Za-z0-9_-])`).test(
    haystack,
  );
}

/** The raw HTML the server sends for a path, with the cookies of the page. */
export async function rawHtml(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  return response.text();
}

// -------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** Group of avatars of the welcome page, in the visible layout. */
export const avatarGroup = (page: Page) =>
  page.locator(".avatar-gruppo").filter({ visible: true });

export type AvatarInfo = { text: string; classes: string[] };

export async function avatarsOf(page: Page): Promise<AvatarInfo[]> {
  return avatarGroup(page)
    .locator(".avatar")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: (node.textContent ?? "").trim(),
        classes: [...node.classList],
      })),
    );
}

export const colorGroup = (page: Page) =>
  page.getByRole("radiogroup", { name: "Il tuo colore" });

export const radio = (page: Page, name: string) =>
  colorGroup(page).getByRole("radio", { name, exact: true });

/** Accessible names of the ten colours, in the order they are shown. */
export async function colorNames(page: Page): Promise<string[]> {
  return colorGroup(page)
    .getByRole("radio")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")!));
}

export const backControl = (page: Page) =>
  page.getByLabel("Indietro", { exact: true }).filter({ visible: true });

export const continueButton = (page: Page) =>
  page.getByRole("button", { name: "Continua", exact: true });

/** Alerts with a text (the Next route announcer is also a role=alert). */
export const alertWith = (page: Page, text: string) =>
  page.getByRole("alert").filter({ hasText: text });

export const statusWith = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

/**
 * Waits until React has taken over the element: before that, a click does
 * nothing. React marks the nodes it hydrates with `__reactFiber$…`.
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

/** Waits for the colour page to be drawn and hydrated. */
export async function colorPageReady(page: Page) {
  await expect(h1(page)).toHaveText("Scegli il tuo colore");
  await expect(colorGroup(page).getByRole("radio")).toHaveCount(10);
  await waitHydrated(colorGroup(page).getByRole("radio").first());
}

/** Clicks a button of the welcome page until the page is hydrated and `done` holds. */
export async function clickUntil(
  target: Locator,
  done: () => Promise<void> | void,
) {
  await expect(async () => {
    await target.click({ timeout: 2000, noWaitAfter: true });
    await done();
  }).toPass({ timeout: 15_000 });
}

// ----------------------------------------------------------- Supabase

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const publishableKey = process.env
  .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

/** Client without a session (the "anonymous" caller of the functions). */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client signed in as a seed user (credentials from the environment). */
export async function seedClient(
  key: "A" | "B" | "C",
): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${key}_EMAIL`] ?? "",
    password: process.env[`TEST_USER_${key}_PASSWORD`] ?? "",
  });
  if (error) throw new Error(`Accesso di prova fallito per ${key}`);
  return client;
}

// ------------------------------------------------- throwaway Nest and visitor

type MemberKind = "adult" | "child" | "pet";
type InviteState = "valid" | "expired" | "revoked";

export type DeSantisNest = {
  /** U: administrator of the Nest. */
  owner: ThrowawayUser;
  nest: string;
  householdId: string;
  ilariaId: string;
  davideId: string;
  pietroId: string;
  /** Valid invitation of Davide (invited by Ilaria). */
  invite: InviteRow;
  addMember: (name: string, color: Color, kind?: MemberKind) => Promise<string>;
  /** Pending invitation of another adult (valid, expired or revoked). */
  inviteFor: (memberId: string, state?: InviteState) => Promise<InviteRow>;
  /** Everything about a member, read with the administrative client. */
  member: (id: string) => Promise<{
    user_id: string | null;
    joined_at: string | null;
    is_admin: boolean;
    color: string;
  }>;
  memberCount: () => Promise<number>;
  invitation: (id: string) => Promise<{
    status: string;
    accepted_at: string | null;
  }>;
};

const INVITE_COLUMNS =
  "id, member_id, household_id, token, status, message, invited_by_member_id, expires_at";

/**
 * U with the Nest "Casa De Santis": Ilaria (administrator, pomodoro), Davide
 * (adult without account, cobalto) and Pietro (child, salvia), and a valid
 * invitation for Davide.
 */
export async function withDeSantisNest(
  body: (nest: DeSantisNest) => Promise<void>,
) {
  const owner = await createThrowawayUser("Ilaria De Santis");
  try {
    const nest = "Casa De Santis";
    const created = await owner.client.rpc("create_household", {
      name: nest,
      household_type: "family_with_children",
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (created.error) throw new Error("Creazione del Nest di prova fallita");
    const { data: householdId } = await owner.client.rpc(
      "current_household_id",
    );
    const { data: ilaria, error: ilariaError } = await owner.admin
      .from("household_members")
      .select("id")
      .eq("user_id", owner.id)
      .single();
    if (ilariaError || !ilaria) throw new Error("Ilaria non trovata");

    const addMember = async (
      name: string,
      color: Color,
      kind: MemberKind = "adult",
    ) => {
      const { data, error } = await owner.admin
        .from("household_members")
        .insert({
          household_id: householdId as string,
          kind,
          name,
          color,
          birth_date: kind === "child" ? "2016-05-05" : null,
        })
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`Membro di prova non aggiunto: ${name}`);
      return data.id as string;
    };

    const inviteFor = async (
      memberId: string,
      state: InviteState = "valid",
    ) => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const base = {
        household_id: householdId as string,
        member_id: memberId,
        invited_by_member_id: ilaria.id as string,
      };
      const values =
        state === "expired"
          ? {
              ...base,
              created_at: new Date(now - 10 * day).toISOString(),
              expires_at: new Date(now - 3 * day).toISOString(),
            }
          : base;
      const { data, error } = await owner.admin
        .from("invitations")
        .insert(values)
        .select(INVITE_COLUMNS)
        .single();
      if (error || !data) throw new Error("Invito di prova non creato");
      if (state === "revoked") {
        const revoked = await owner.admin
          .from("invitations")
          .update({ status: "revoked" })
          .eq("id", data.id);
        if (revoked.error) throw new Error("Invito di prova non revocato");
      }
      return data as InviteRow;
    };

    const davideId = await addMember("Davide", "cobalto");
    const pietroId = await addMember("Pietro", "salvia", "child");
    const invite = await inviteFor(davideId);

    await body({
      owner,
      nest,
      householdId: householdId as string,
      ilariaId: ilaria.id as string,
      davideId,
      pietroId,
      invite,
      addMember,
      inviteFor,
      async member(id) {
        const { data, error } = await owner.admin
          .from("household_members")
          .select("user_id, joined_at, is_admin, color")
          .eq("id", id)
          .single();
        if (error || !data) throw new Error("Lettura del membro fallita");
        return data;
      },
      async memberCount() {
        const { count, error } = await owner.admin
          .from("household_members")
          .select("id", { count: "exact", head: true })
          .eq("household_id", householdId as string);
        if (error) throw new Error("Conteggio dei membri fallito");
        return count ?? 0;
      },
      async invitation(id) {
        const { data, error } = await owner.admin
          .from("invitations")
          .select("status, accepted_at")
          .eq("id", id)
          .single();
        if (error || !data) throw new Error("Lettura dell'invito fallita");
        return data;
      },
    });
  } finally {
    await owner.remove();
  }
}

/** V: a visitor with an account and no Nest, deleted at the end. */
export async function withVisitor(
  body: (visitor: ThrowawayUser) => Promise<void>,
) {
  const visitor = await createThrowawayUser("Valeria Visitatrice");
  try {
    await body(visitor);
  } finally {
    await visitor.remove();
  }
}

/** The Nest of U and the visitor V together. */
export async function withNestAndVisitor(
  body: (nest: DeSantisNest, visitor: ThrowawayUser) => Promise<void>,
) {
  await withDeSantisNest((nest) =>
    withVisitor((visitor) => body(nest, visitor)),
  );
}
