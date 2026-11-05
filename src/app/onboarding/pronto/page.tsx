import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import { ReadyLoading, ReadyScreen } from "@/components/onboarding/ReadyScreen";
import { requireUser } from "@/lib/auth/require-user";
import { startOfDay, toDayKey } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The first synchronisation gets this long to finish before Pronto shows (#37 §6). */
const SYNC_WAIT_MS = 10_000;
const SYNC_POLL_MS = 500;

const PROVIDER_NAMES = { google: "Google", outlook: "Outlook" } as const;

/**
 * «12 impegni arrivati da Outlook»: the adult's own imported events from today
 * (Rome) on. Waits for the first synchronisation at most 10 seconds, then
 * counts what has arrived. Null when there is no account, nothing arrived, or
 * the count cannot be read: Pronto is a summary, not a gate.
 */
async function importedLine(supabase: Supabase): Promise<string | null> {
  try {
    const deadline = Date.now() + SYNC_WAIT_MS;
    for (;;) {
      const accounts = await supabase
        .from("calendar_accounts")
        .select("last_synced_at");
      if (accounts.error || accounts.data.length === 0) return null;
      const waiting = accounts.data.some((a) => a.last_synced_at === null);
      if (!waiting || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_MS));
    }
    const from = startOfDay(toDayKey(new Date())).toISOString();
    const counted = await supabase.rpc("count_imported_events", {
      p_from: from,
    });
    if (counted.error || counted.data.length === 0) return null;
    const total = counted.data.reduce((sum, row) => sum + row.event_count, 0);
    if (total === 0) return null;
    const names = counted.data.map((row) => PROVIDER_NAMES[row.provider]);
    const sources =
      names.length === 1
        ? (names[0] ?? "")
        : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
    return total === 1
      ? `1 impegno arrivato da ${sources}`
      : `${total} impegni arrivati da ${sources}`;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "FamilyNest · Pronto",
};

/** True while `expiresAt` (UTC) is after the moment the page is opened. */
function isStillValid(expiresAt: string): boolean {
  return Date.parse(expiresAt) > Date.now();
}

/** Line about the invitations still valid; null when there are none. */
function invitesLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `Invito condiviso con ${names[0]}`;
  if (names.length === 2) {
    return `Inviti condivisi con ${names[0]} e ${names[1]}`;
  }
  return `Inviti condivisi con ${names.length} persone`;
}

async function Ready() {
  // No session -> /accesso.
  const { userId, failed } = await requireUser();
  if (failed || !userId) return <OnboardingError />;

  const supabase = await createClient();
  const household = await supabase.rpc("current_household_id");
  if (household.error) return <OnboardingError />;
  // Signed in but no Nest yet: back to step 1.
  if (!household.data) redirect("/onboarding");

  const [nest, members, invitations, imported] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", household.data)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("id, name, color, kind, user_id, is_admin")
      .eq("household_id", household.data)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("invitations")
      .select("member_id, expires_at")
      .eq("household_id", household.data)
      .eq("status", "pending"),
    importedLine(supabase),
  ]);
  if (nest.error || members.error || invitations.error || !nest.data) {
    return <OnboardingError />;
  }

  // Only the administrator sets up the Nest.
  const me = members.data.find((member) => member.user_id === userId);
  if (!me?.is_admin) redirect("/oggi");

  // An invitation counts while it is pending and not expired.
  const invited = new Set(
    invitations.data
      .filter((invitation) => isStillValid(invitation.expires_at))
      .map((invitation) => invitation.member_id),
  );
  const names = members.data
    .filter(
      (member) =>
        member.kind === "adult" &&
        member.user_id === null &&
        invited.has(member.id),
    )
    .map((member) => member.name);

  // Only names and colours reach the browser: no ids, no account ids.
  return (
    <ReadyScreen
      nest={nest.data.name}
      members={members.data.map((member) => ({
        name: member.name,
        color: member.color,
      }))}
      invites={invitesLine(names)}
      imported={imported}
    />
  );
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function ReadyPage() {
  return (
    <Suspense fallback={<ReadyLoading />}>
      <Ready />
    </Suspense>
  );
}
