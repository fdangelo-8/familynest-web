import type { Page } from "@playwright/test";
import type { ThrowawayUser } from "../fixtures/throwaway-user";
import { userWithNest, type HouseholdType } from "./persone-helpers";

// Shared by tests/visual/onboarding-pronto.spec.ts and
// tests/a11y/onboarding-pronto.spec.ts (onboarding step 4 "Pronto", #15).
// The Nest, its members and its invitations are written with the
// administrative key of the local Supabase; the page only reads.

/** A throwaway user with a Nest, and a pending invitation for each name in `invite`. */
export async function readyUser(
  type: HouseholdType,
  members: Parameters<typeof userWithNest>[1],
  invite: string[] = [],
): Promise<ThrowawayUser> {
  const user = await userWithNest(type, members);
  try {
    const household = await user.client.rpc("current_household_id");
    for (const name of invite) {
      const { data: member, error } = await user.admin
        .from("household_members")
        .select("id, household_id")
        .is("user_id", null)
        .eq("name", name)
        .eq("household_id", household.data as string)
        .single();
      if (error || !member) throw new Error(`Membro non trovato: ${name}`);
      const { error: inviteError } = await user.admin
        .from("invitations")
        .insert({ household_id: member.household_id, member_id: member.id });
      if (inviteError) throw new Error(`Invito non creato: ${name}`);
    }
    return user;
  } catch (error) {
    await user.remove();
    throw error;
  }
}

/** Opens the page as the user and waits for the real one (not the skeleton). */
export async function openReady(
  page: Page,
  user: ThrowawayUser,
  baseURL: string | undefined,
) {
  await user.signInContext(page.context(), baseURL as string);
  await page.goto("/onboarding/pronto");
  await page.getByRole("link", { name: "Vai a Oggi" }).first().waitFor({
    state: "attached",
  });
}

/** Fonts loaded, pointer away from any control (no hover state). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}
