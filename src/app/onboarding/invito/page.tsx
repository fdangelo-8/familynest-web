import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InviteSkeleton } from "@/components/onboarding/InviteSkeleton";
import {
  InviteStep,
  type InviteFailure,
} from "@/components/onboarding/InviteStep";
import { READY_PATH } from "@/components/onboarding/invite-routes";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import { requireUser } from "@/lib/auth/require-user";
import { formatLongDay, formatTime, toDayKey } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Invito",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string | null } | null;

type Invitation = { token: string; expiresAt: string; fresh: boolean };
type InvitationResult =
  { ok: true; invitation: Invitation } | { ok: false; failure: InviteFailure };

/** supabase-js reports an unreachable server as an error without a code. */
function failureOf(error: NonNullable<DbError>): InviteFailure {
  return error.code ? "server" : "network";
}

/**
 * The pending invitation of the adult, if any (the database allows one).
 * With `validAt` only one that has not expired by then counts. The reread
 * after the insert passes it: Next merges identical GET requests of one
 * render, so the same query as the first read would return the same empty
 * answer instead of the new invitation.
 */
async function readPending(
  supabase: Supabase,
  memberId: string,
  validAt?: string,
) {
  const pending = supabase
    .from("invitations")
    .select("id, token, expires_at")
    .eq("member_id", memberId)
    .eq("status", "pending");
  return (validAt ? pending.gt("expires_at", validAt) : pending)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

/**
 * Makes sure the adult has one valid invitation and returns it: reuses a
 * pending one, revokes an expired one, creates a new one otherwise. Opening
 * the page again creates nothing more. Never throws, never keeps the message.
 */
async function ensureInvitation(
  supabase: Supabase,
  householdId: string,
  memberId: string,
): Promise<InvitationResult> {
  try {
    const found = await readPending(supabase, memberId);
    if (found.error) return { ok: false, failure: failureOf(found.error) };
    if (found.data && Date.parse(found.data.expires_at) > Date.now()) {
      return {
        ok: true,
        invitation: {
          token: found.data.token,
          expiresAt: found.data.expires_at,
          fresh: false,
        },
      };
    }
    // Only one pending invitation per person: the expired one goes first.
    if (found.data) {
      const revoked = await supabase
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", found.data.id);
      if (revoked.error) {
        return { ok: false, failure: failureOf(revoked.error) };
      }
    }
    const created = await supabase
      .from("invitations")
      .insert({ household_id: householdId, member_id: memberId });
    // 23505: another tab created it first. Not an error: read that one.
    if (created.error && created.error.code !== "23505") {
      return { ok: false, failure: failureOf(created.error) };
    }
    const reread = await readPending(
      supabase,
      memberId,
      new Date().toISOString(),
    );
    if (reread.error) return { ok: false, failure: failureOf(reread.error) };
    if (!reread.data || Date.parse(reread.data.expires_at) <= Date.now()) {
      return { ok: false, failure: "server" };
    }
    return {
      ok: true,
      invitation: {
        token: reread.data.token,
        expiresAt: reread.data.expires_at,
        fresh: !created.error,
      },
    };
  } catch {
    return { ok: false, failure: "network" };
  }
}

/** Sentence under the title, with the expiry, in Rome time. */
function describe(invitation: Invitation): string {
  if (invitation.fresh) return "Il link vale 7 giorni.";
  const today = toDayKey(new Date()) === toDayKey(invitation.expiresAt);
  return today
    ? `Il link vale fino a oggi alle ${formatTime(invitation.expiresAt)}.`
    : `Il link vale fino a ${formatLongDay(invitation.expiresAt, { capitalized: false })}.`;
}

/** `?persona=n`: position of the adult; anything else means the first. */
function positionOf(raw: string | string[] | undefined, total: number) {
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw)) return 1;
  const value = Number(raw);
  return value >= 1 && value <= total ? value : 1;
}

async function Invite({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string | string[] }>;
}) {
  const { persona } = await searchParams;

  // No session -> /accesso.
  const { userId, failed } = await requireUser();
  if (failed || !userId) return <OnboardingError />;

  const supabase = await createClient();
  const household = await supabase.rpc("current_household_id");
  if (household.error) return <OnboardingError />;
  // Signed in but no Nest yet: back to step 1.
  if (!household.data) redirect("/onboarding");

  const members = await supabase
    .from("household_members")
    .select("id, name, kind, user_id, is_admin")
    .eq("household_id", household.data)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (members.error) return <OnboardingError />;

  // Only the administrator invites.
  const me = members.data.find((member) => member.user_id === userId);
  if (!me?.is_admin) redirect("/oggi");

  // Adults added at step 2 who have no account yet.
  const adults = members.data.filter(
    (member) => member.kind === "adult" && member.user_id === null,
  );
  // Nobody to invite: straight on, nothing is created.
  if (adults.length === 0) redirect(READY_PATH);

  const position = positionOf(persona, adults.length);
  const adult = adults[position - 1];
  if (!adult) redirect(READY_PATH);
  const result = await ensureInvitation(supabase, household.data, adult.id);

  return (
    <InviteStep
      name={adult.name}
      position={position}
      total={adults.length}
      nextName={adults[position]?.name ?? null}
      token={result.ok ? result.invitation.token : null}
      failure={result.ok ? null : result.failure}
      note={result.ok ? describe(result.invitation) : ""}
    />
  );
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Invite searchParams={searchParams} />
    </Suspense>
  );
}
