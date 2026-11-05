import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CalendarStep,
  type CalendarNotice,
  type CalendarRow,
} from "@/components/onboarding/CalendarStep";
import { CalendarSkeleton } from "@/components/onboarding/CalendarSkeleton";
import {
  INVITE_PATH,
  PEOPLE_PATH,
  READY_PATH,
} from "@/components/onboarding/invite-routes";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import { requireUser } from "@/lib/auth/require-user";
import { LINK_RESULT_COOKIE, parseLinkResult } from "@/lib/calendar-sync/oauth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Porta qui il tuo calendario",
};

/**
 * Rows in the order of the mockup. iCloud has no row yet: its provider is not
 * on `main` (#36); the row comes with it.
 */
const PROVIDERS = [
  { id: "outlook", name: "Outlook", info: "Lavoro e calendari condivisi" },
  { id: "google", name: "Google", info: "Per il calendario personale" },
] as const;

function calendarsText(count: number): string {
  if (count === 0) return "nessun calendario";
  return count === 1 ? "1 calendario" : `${count} calendari`;
}

async function Calendar() {
  // No session -> /accesso.
  const { userId, failed } = await requireUser();
  if (failed || !userId) return <OnboardingError />;

  const supabase = await createClient();
  const household = await supabase.rpc("current_household_id");
  if (household.error) return <OnboardingError />;
  // Signed in but no Nest yet: back to step 1.
  if (!household.data) redirect("/onboarding");

  const [nest, members, accounts, calendars, jar] = await Promise.all([
    supabase
      .from("households")
      .select("household_type")
      .eq("id", household.data)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("kind, user_id, is_admin")
      .eq("household_id", household.data),
    // The rules of the table show each adult only their own accounts.
    supabase
      .from("calendar_accounts")
      .select("id, provider, email")
      .order("connected_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("external_calendars").select("account_id"),
    cookies(),
  ]);
  if (
    nest.error ||
    !nest.data ||
    members.error ||
    accounts.error ||
    calendars.error
  ) {
    return <OnboardingError />;
  }

  // The role is decided here, never by an address parameter: whoever is not
  // the administrator joined with an invitation.
  const me = members.data.find((member) => member.user_id === userId);
  const isAdmin = me?.is_admin === true;
  const single = nest.data.household_type === "single";
  const hasAdultToInvite = members.data.some(
    (member) => member.kind === "adult" && member.user_id === null,
  );
  const next = isAdmin
    ? !single && hasAdultToInvite
      ? INVITE_PATH
      : READY_PATH
    : "/oggi";
  const steps = isAdmin
    ? { current: 3, total: single ? 3 : 4 }
    : { current: 2, total: 3 };

  const perAccount = new Map<string, number>();
  for (const calendar of calendars.data) {
    perAccount.set(
      calendar.account_id,
      (perAccount.get(calendar.account_id) ?? 0) + 1,
    );
  }
  // Only a provider, the adult's own mail and counts reach the browser.
  const rows: CalendarRow[] = PROVIDERS.map((provider) => {
    const own = accounts.data.filter((a) => a.provider === provider.id);
    const count = own.reduce((sum, a) => sum + (perAccount.get(a.id) ?? 0), 0);
    const linkedInfo =
      own.length === 1
        ? `${own[0]?.email ?? ""} · ${calendarsText(count)}`
        : `${own.length} account · ${calendarsText(count)}`;
    return {
      provider: provider.id,
      name: provider.name,
      info: own.length > 0 ? linkedInfo : provider.info,
      linked: own.length > 0,
    };
  });

  const result = parseLinkResult(jar.get(LINK_RESULT_COOKIE)?.value);
  const notice: CalendarNotice | null = result
    ? { provider: result.provider, result: result.result }
    : null;

  return (
    <CalendarStep
      rows={rows}
      steps={steps}
      backHref={isAdmin ? PEOPLE_PATH : null}
      next={next}
      notice={notice}
    />
  );
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <Calendar />
    </Suspense>
  );
}
