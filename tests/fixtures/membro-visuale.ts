import { expect, test, type Page } from "@playwright/test";
import { createThrowawayUser, type ThrowawayUser } from "./throwaway-user";

// Helpers shared by tests/visual/membro.spec.ts and tests/a11y/membro.spec.ts
// (page /membri/<id>, issue #18). Seed users only read; every test that
// writes uses throwaway users, deleted at the end.

export const LAURA_A = "a1000000-0000-4000-8000-000000000002";
export const BISCOTTO_A = "a1000000-0000-4000-8000-000000000005";
export const PAOLO_B = "b1000000-0000-4000-8000-000000000002";
export const ANNA_B = "b1000000-0000-4000-8000-000000000004";
export const GIULIA_B = "b1000000-0000-4000-8000-000000000001";

export const FIXED_NOW = new Date("2026-10-29T12:00:00+01:00");

const COLORS = [
  "glicine",
  "salvia",
  "cobalto",
  "zafferano",
  "lampone",
  "ceruleo",
  "peonia",
] as const;

export const baseURL = () =>
  test.info().project.use.baseURL ?? "http://localhost:3000";

/**
 * Opens /membri/<id> and waits for the real page and for React: a click
 * before hydration does nothing. Relative texts that the server writes from
 * the real clock are pinned, so the references do not change with the day.
 */
export async function openMember(page: Page, id: string, heading: string) {
  await expect(async () => {
    await page.goto(`/membri/${id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await freezeTexts(page);
}

export async function freezeTexts(page: Page) {
  await page.evaluate(() => {
    for (const p of document.querySelectorAll("p.intestazione__sotto")) {
      if (/invito inviato/.test(p.textContent ?? "")) {
        p.textContent = "Adulto · invito inviato ieri alle 21:10";
      }
    }
    for (const s of document.querySelectorAll(".riga-lista__info")) {
      if (/^Il link scade/.test(s.textContent ?? "")) {
        s.textContent = "Il link scade tra 6 giorni";
      }
    }
  });
}

export async function userWithNest(page: Page): Promise<ThrowawayUser> {
  const user = await createThrowawayUser("Ilaria De Santis");
  const { error } = await user.client.rpc("create_household", {
    name: "Casa De Santis",
    household_type: "family_with_children",
    member_name: "Ilaria",
    color: "pomodoro",
  });
  if (error) {
    await user.remove();
    throw new Error("Nest di prova non creato");
  }
  await user.signInContext(page.context(), baseURL());
  return user;
}

/** Adds a member with the user's own client and returns its id. */
export async function addMember(
  user: ThrowawayUser,
  member: { name: string; kind: "adult" | "pet"; birth?: string },
): Promise<string> {
  const { data: householdId } = await user.client.rpc("current_household_id");
  const { data: used } = await user.client
    .from("household_members")
    .select("color");
  const taken = new Set((used ?? []).map((m) => m.color));
  const color = COLORS.find((c) => !taken.has(c))!;
  const { error } = await user.client.from("household_members").insert({
    household_id: householdId as string,
    kind: member.kind,
    name: member.name,
    color,
    ...(member.birth ? { birth_date: member.birth } : {}),
  });
  if (error) throw new Error("Membro di prova non aggiunto");
  const { data } = await user.client
    .from("household_members")
    .select("id")
    .eq("color", color)
    .single();
  if (!data) throw new Error("Membro di prova non letto");
  return data.id;
}

export async function addInvite(user: ThrowawayUser, memberId: string) {
  const { data: householdId } = await user.client.rpc("current_household_id");
  const { error } = await user.client.from("invitations").insert({
    household_id: householdId as string,
    member_id: memberId,
  });
  if (error) throw new Error("Invito di prova non creato");
}

/** U with a Nest and Laura, an adult without account and without invitation. */
export async function withLaura(page: Page) {
  const user = await userWithNest(page);
  const lauraId = await addMember(user, { name: "Laura", kind: "adult" });
  return { user, lauraId };
}

/** U with a Nest and Rita, an adult with account (U2 accepted the invitation). */
export async function withRita(page: Page) {
  const user = await userWithNest(page);
  const ritaId = await addMember(user, { name: "Rita", kind: "adult" });
  await addInvite(user, ritaId);
  const { data: invite } = await user.admin
    .from("invitations")
    .select("token")
    .eq("member_id", ritaId)
    .eq("status", "pending")
    .single();
  const user2 = await createThrowawayUser("Rita Verdi");
  const { error } = await user2.client.rpc("accept_invitation", {
    token: invite!.token,
  });
  if (error) {
    await user2.remove();
    await user.remove();
    throw new Error("Invito di prova non accettato");
  }
  return { user, user2, ritaId };
}

/** Pins the pointer away and shoots: no hover state in the reference. */
export async function shoot(page: Page, name: string, fullPage = true) {
  await page.mouse.move(0, 0);
  await freezeTexts(page);
  await expect(page).toHaveScreenshot(name, { fullPage });
}
