import { randomUUID } from "node:crypto";
import { expect, type Page, type Route } from "@playwright/test";
import {
  adminClient,
  invitesOf,
  withInviteNest,
  type InviteNest,
  type InviteRow,
} from "./invito";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Shared by tests/e2e/membro-nest.spec.ts and tests/a11y/membro-nest.spec.ts
// (page "Un membro del Nest", #18, /membri/<id>). Seeded users A, B, B2, C only
// read; everything that writes uses throwaway users (U, U2), deleted at the end.

export const IDS = {
  // Casa D'Angelo (user A = Marco, administrator)
  marco: "a1000000-0000-4000-8000-000000000001",
  laura: "a1000000-0000-4000-8000-000000000002",
  sofia: "a1000000-0000-4000-8000-000000000003",
  tommaso: "a1000000-0000-4000-8000-000000000004",
  biscotto: "a1000000-0000-4000-8000-000000000005",
  // Casa Bianchi (B = Giulia administrator, B2 = Paolo not administrator)
  giulia: "b1000000-0000-4000-8000-000000000001",
  paolo: "b1000000-0000-4000-8000-000000000002",
  leo: "b1000000-0000-4000-8000-000000000003",
  anna: "b1000000-0000-4000-8000-000000000004",
} as const;

export const NOT_FOUND = "Questa pagina non c’è";
export const LOAD_ERROR = "Questa pagina non si è caricata";
export const PAGE_TITLE = "FamilyNest · Un membro del Nest";

export const memberPath = (id: string) => `/membri/${id}`;

// ---------------------------------------------------------------- locators

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
export const subtitle = (page: Page) => page.locator(".intestazione__sotto");
export const sendAgain = (page: Page) =>
  page.getByRole("button", { name: /^Manda di nuovo l'invito/ });
export const sendFirst = (page: Page) =>
  page.getByRole("button", { name: /^Manda l'invito/ });
export const roleSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Amministratore" });
export const removeButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Togli ${name} dal Nest`, exact: true });
export const backLink = (page: Page) =>
  page.getByRole("link", { name: "Indietro", exact: true });
export const toast = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });
export const nestList = (page: Page) =>
  page.getByRole("list", { name: "Chi c’è" });

/** Waits for the page of a member (h1 = its name). */
export async function openMember(page: Page, id: string, name: string) {
  await page.goto(memberPath(id));
  await expect(h1(page)).toHaveText(name);
}

/** Text of the whole page as the user reads it. */
export const pageText = (page: Page) => page.locator("body").innerText();

// ------------------------------------------------------------------ dates

const romeFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", ...options });

function romeDay(value: Date): string {
  return romeFormat({ year: "numeric", month: "2-digit", day: "2-digit" })
    .format(value)
    .slice(0, 10);
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** «21:10», «9:05» in Europe/Rome. */
export function romeTime(value: Date): string {
  const parts = romeFormat({
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${Number(get("hour"))}:${get("minute")}`;
}

/**
 * «oggi alle 21:10», «ieri alle 21:10» or «3 giorni fa»: when the invitation
 * was created, counted in calendar days in Rome (rule of the requirement,
 * written here on purpose without the functions of the app).
 */
export function sentText(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  const days = dayNumber(romeDay(now)) - dayNumber(romeDay(created));
  if (days <= 0) return `oggi alle ${romeTime(created)}`;
  if (days === 1) return `ieri alle ${romeTime(created)}`;
  return `${days} giorni fa`;
}

/** Date `years` years before today in Europe/Rome, as YYYY-MM-DD. */
export function yearsAgo(years: number): string {
  const [y, m, d] = romeDay(new Date()).split("-");
  const day = m === "02" && d === "29" ? "28" : d;
  return `${Number(y) - years}-${m}-${day}`;
}

// ------------------------------------------------------------ network/clipboard

/** Clipboard whose `writeText` always rejects (denied permission). */
export async function breakClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
    });
  });
}

/** The server action POST of the page (not the Next.js route announcer). */
export const isServerAction = (route: Route) => {
  const request = route.request();
  return request.method() === "POST" && !!request.headers()["next-action"];
};

/** Aborts every server action POST of the member pages (network down). */
export async function cutServerActions(page: Page) {
  await page.route("**/membri/**", async (route) => {
    if (isServerAction(route)) await route.abort("connectionfailed");
    else await route.continue();
  });
}

/** Slows every server action POST of the member pages down by `ms`. */
export async function slowServerActions(page: Page, ms: number) {
  await page.route("**/membri/**", async (route) => {
    if (isServerAction(route)) {
      // Slows the answer of the server (not a wait of the test).
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    await route.continue();
  });
}

// ---------------------------------------------------------------- database

export type MemberRow = {
  id: string;
  name: string;
  kind: string;
  color: string;
  is_admin: boolean;
  user_id: string | null;
  birth_date: string | null;
};

/** One member read with the administrative client, `null` if it does not exist. */
export async function memberById(id: string): Promise<MemberRow | null> {
  const { data, error } = await adminClient()
    .from("household_members")
    .select("id, name, kind, color, is_admin, user_id, birth_date")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Lettura del membro di prova fallita");
  return data as MemberRow | null;
}

/** The pending invitations of a member, with dates and short code. */
export async function pendingDetails(memberId: string) {
  const { data, error } = await adminClient()
    .from("invitations")
    .select(
      "id, token, status, created_at, expires_at, short_code, invited_by_member_id",
    )
    .eq("member_id", memberId)
    .eq("status", "pending");
  if (error) throw new Error("Lettura dell'invito di prova fallita");
  return data as {
    id: string;
    token: string;
    status: string;
    created_at: string;
    expires_at: string;
    short_code: string;
    invited_by_member_id: string | null;
  }[];
}

/** Every invitation of a member, whatever its status. */
export async function anyInvites(memberId: string): Promise<InviteRow[]> {
  return invitesOf(memberId);
}

// -------------------------------------------------------- throwaway Nests

/** U with a Nest («Casa di Ilaria»): helpers to add adults, invitations and pets. */
export type MemberNest = InviteNest & {
  addPet: (name: string, color: string, birthDate?: string) => Promise<string>;
};

export async function withMemberNest(body: (ctx: MemberNest) => Promise<void>) {
  await withInviteNest(async (ctx) => {
    const addPet = async (name: string, color: string, birthDate?: string) => {
      const { data, error } = await ctx.user.admin
        .from("household_members")
        .insert({
          household_id: ctx.householdId,
          kind: "pet",
          name,
          color,
          ...(birthDate ? { birth_date: birthDate } : {}),
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Animale di prova non aggiunto: ${name}`);
      }
      return data.id as string;
    };
    await body({ ...ctx, addPet });
  });
}

export type RitaNest = MemberNest & {
  /** Member id of Rita: an adult with account (U2), not administrator. */
  ritaId: string;
  /** U2, the account of Rita. */
  u2: ThrowawayUser;
};

/**
 * «U con Rita»: U with a Nest, an adult «Rita» (glicine) with an invitation,
 * and U2 who accepts it: Rita becomes an adult with account, not administrator.
 */
export async function withRita(body: (ctx: RitaNest) => Promise<void>) {
  await withMemberNest(async (ctx) => {
    const ritaId = await ctx.addAdult("Rita", "glicine");
    const invitation = await ctx.invite(ritaId);
    const u2 = await createThrowawayUser("Rita Verdi");
    try {
      const { error } = await u2.client.rpc("accept_invitation", {
        token: invitation.token,
      });
      if (error) throw new Error("Invito di Rita non accettato");
      await body({ ...ctx, ritaId, u2 });
    } finally {
      await u2.remove();
    }
  });
}

export const randomId = () => randomUUID();

export { adminClient };
