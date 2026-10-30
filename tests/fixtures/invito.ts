import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Shared by tests/e2e/onboarding-invito.spec.ts and
// tests/a11y/onboarding-invito.spec.ts (onboarding step 4 "Invito", #14).
// Written before the page exists: selectors use the roles and texts of the
// requirement and checked against the code of the PR.
// The seed users A and B only read (parallel desktop and mobile runs would
// race on a mutated seed); every test that changes invitations or members uses
// its own throwaway user, deleted at the end.

export const PATH = "/onboarding/invito";
export const SEED_LAURA_INVITE_ID = "a2000000-0000-4000-8000-000000000001";
export const SEED_LAURA_MEMBER_ID = "a1000000-0000-4000-8000-000000000002";
export const NEST_A = "Casa D'Angelo";
export const NEST_B = "Casa Bianchi";
// Fixed ids of the two seed Nests (supabase/seed.sql). Tests that look a seed
// Nest up must use these, never the name: the throwaway Nests of other tests
// running in parallel are also called "Casa D'Angelo" and "Casa Bianchi".
export const SEED_HOME_A = "11111111-1111-4111-8111-111111111111";
export const SEED_HOME_B = "22222222-2222-4222-8222-222222222222";

export const isMobileProject = () => test.info().project.name === "mobile";

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    { auth: { persistSession: false } },
  );
}

export type InviteRow = {
  id: string;
  member_id: string;
  household_id: string;
  token: string;
  status: string;
  message: string | null;
  invited_by_member_id: string | null;
  expires_at: string;
};

/** Every invitation of a member, read with the administrative client. */
export async function invitesOf(memberId: string): Promise<InviteRow[]> {
  const { data, error } = await adminClient()
    .from("invitations")
    .select(
      "id, member_id, household_id, token, status, message, invited_by_member_id, expires_at",
    )
    .eq("member_id", memberId);
  if (error) throw new Error("Lettura degli inviti di prova fallita");
  return data as InviteRow[];
}

export async function pendingInviteOf(memberId: string): Promise<InviteRow> {
  const pending = (await invitesOf(memberId)).filter(
    (row) => row.status === "pending",
  );
  expect(pending, "un solo invito pending").toHaveLength(1);
  return pending[0]!;
}

export async function inviteCountOfHousehold(
  householdId: string,
): Promise<number> {
  const { count, error } = await adminClient()
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);
  if (error) throw new Error("Conteggio degli inviti fallito");
  return count ?? 0;
}

export async function householdIdByName(name: string): Promise<string> {
  if (name === NEST_A) return SEED_HOME_A;
  if (name === NEST_B) return SEED_HOME_B;
  const { data, error } = await adminClient()
    .from("households")
    .select("id")
    .eq("name", name)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Nest di prova non trovato: ${name}`);
  return data.id as string;
}

/** Id of a member by name in a Nest (seed members have unique names there). */
export async function memberIdByName(
  householdId: string,
  name: string,
): Promise<string> {
  const { data, error } = await adminClient()
    .from("household_members")
    .select("id")
    .eq("household_id", householdId)
    .eq("name", name)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Membro di prova non trovato: ${name}`);
  return data.id as string;
}

/**
 * Text of the note for a reused invitation, in Europe/Rome:
 * "Il link vale fino a lunedì 26 ottobre." or, on the last day,
 * "Il link vale fino a oggi alle 15:52." (decision of 30/10).
 */
export function expiryNote(expiresAt: string): string {
  const when = new Date(expiresAt);
  const zone = { timeZone: "Europe/Rome" };
  const day = (d: Date) => d.toLocaleDateString("it-IT", { ...zone });
  if (day(when) === day(new Date())) {
    const time = when.toLocaleTimeString("it-IT", {
      ...zone,
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Il link vale fino a oggi alle ${time}.`;
  }
  const label = when.toLocaleDateString("it-IT", {
    ...zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `Il link vale fino a ${label}.`;
}

export const inviteUrl = (page: Page, token: string) =>
  `${new URL(page.url()).origin}/invito/${token}`;

// ---------------------------------------------------------------- locators

/** Exit and next-adult controls are buttons; "Indietro" is a link everywhere. */
export const control = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
export const sendButton = (page: Page, who: string) =>
  page.getByRole("button", { name: `Manda il link a ${who}`, exact: true });
export const copyButton = (page: Page) =>
  page.getByRole("button", { name: "Copia il link", exact: true });
export const skipControl = (page: Page) => control(page, "Lo faccio dopo");
export const doneControl = (page: Page) => control(page, "Ho finito");
export const backControl = (page: Page) =>
  page.getByRole("link", { name: "Indietro", exact: true });
export const heading = (page: Page) => page.getByRole("heading", { level: 1 });
export const progress = (page: Page) => page.getByRole("progressbar");

/** Text shown in the visible layout (both layouts are in the DOM). */
export const visibleText = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

/** Any visible toast or alert with text (the Next route announcer is empty). */
export const messages = (page: Page) =>
  page
    .locator('[role="status"], [role="alert"]')
    .filter({ hasText: /\S/ })
    .filter({ visible: true });

/** Opens the page and waits for the main landmark and the heading (LEZIONI). */
export async function openInvite(page: Page, query = "") {
  const response = await page.goto(`${PATH}${query}`);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(heading(page)).toBeVisible();
  return response;
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/** Replaces navigator.share with a recorder (resolves, or rejects with `reject`). */
export async function stubShare(
  page: Page,
  reject?: "AbortError" | "NotAllowedError",
) {
  await page.addInitScript((rejectWith) => {
    const calls: unknown[] = [];
    (window as unknown as { __shareCalls: unknown[] }).__shareCalls = calls;
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: (data: unknown) => {
        calls.push(data);
        return rejectWith
          ? Promise.reject(new DOMException("test", rejectWith))
          : Promise.resolve();
      },
    });
  }, reject ?? null);
}

export async function removeShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: undefined,
    });
  });
}

export async function shareCalls(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __shareCalls: Record<string, unknown>[] })
        .__shareCalls,
  );
}

// ------------------------------------------------------ throwaway Nest

const COLORS = [
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
  "basilico",
  "cannella",
];

export type InviteNest = {
  user: ThrowawayUser;
  nest: string;
  householdId: string;
  /** Member id of the administrator (the throwaway user). */
  adminMemberId: string;
  /** Adds an adult without account; returns its member id. */
  addAdult: (name: string, color?: string) => Promise<string>;
  /** Inserts an invitation for a member (pending, expired, or revoked). */
  invite: (
    memberId: string,
    state?: "valid" | "expired" | "revoked",
  ) => Promise<InviteRow>;
};

/** Throwaway administrator with a Nest created the way step 1 creates it. */
export async function withInviteNest(
  body: (ctx: InviteNest) => Promise<void>,
  type: "single" | "couple" | "roommates" = "couple",
) {
  const user = await createThrowawayUser("Ilaria De Santis");
  try {
    const nest = "Casa di Ilaria";
    const { error } = await user.client.rpc("create_household", {
      name: nest,
      household_type: type,
      member_name: "Ilaria",
      color: "pomodoro",
    });
    if (error) throw new Error("Creazione del Nest di prova fallita");
    const { data } = await user.client.rpc("current_household_id");
    const householdId = data as string;
    const { data: me, error: meError } = await user.admin
      .from("household_members")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (meError || !me) throw new Error("Amministratore di prova non trovato");
    let next = 0;
    const addAdult = async (name: string, color?: string) => {
      const { data: row, error: insertError } = await user.admin
        .from("household_members")
        .insert({
          household_id: householdId,
          kind: "adult",
          name,
          color: color ?? COLORS[next++],
        })
        .select("id")
        .single();
      if (insertError || !row)
        throw new Error(`Membro di prova non aggiunto: ${name}`);
      return row.id as string;
    };
    const invite = async (
      memberId: string,
      state: "valid" | "expired" | "revoked" = "valid",
    ) => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const base = {
        household_id: householdId,
        member_id: memberId,
        invited_by_member_id: me.id,
      };
      const values =
        state === "expired"
          ? {
              ...base,
              created_at: new Date(now - 10 * day).toISOString(),
              expires_at: new Date(now - 3 * day).toISOString(),
            }
          : base;
      const { data: row, error: insertError } = await user.admin
        .from("invitations")
        .insert(values)
        .select(
          "id, member_id, household_id, token, status, message, invited_by_member_id, expires_at",
        )
        .single();
      if (insertError || !row) throw new Error("Invito di prova non creato");
      if (state === "revoked") {
        const { error: updateError } = await user.admin
          .from("invitations")
          .update({ status: "revoked" })
          .eq("id", row.id);
        if (updateError) throw new Error("Invito di prova non revocato");
      }
      return row as InviteRow;
    };
    await body({
      user,
      nest,
      householdId,
      adminMemberId: me.id as string,
      addAdult,
      invite,
    });
  } finally {
    await user.remove();
  }
}

export async function signInThrowaway(
  page: Page,
  baseURL: string | undefined,
  user: ThrowawayUser,
) {
  await user.signInContext(page.context(), baseURL as string);
}
