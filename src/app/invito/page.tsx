import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InviteEnded } from "@/components/invito/InviteEnded";
import { InviteSkeleton } from "@/components/invito/InviteSkeleton";
import { InviteWelcome } from "@/components/invito/InviteWelcome";
import { expiryLead } from "@/components/invito/invite-text";
import { readInviteSession } from "@/components/invito/server";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import type { AccessError } from "@/lib/auth/oauth";
import { getInvitationPreview } from "@/lib/invitation-preview";
import { readInviteToken } from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  // No names: the title stays in the browser history.
  title: "FamilyNest · Invito",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// `?errore=google|apple|accesso` and `annullato=1` come from /auth/callback.
function readError(
  params: Record<string, string | string[] | undefined>,
): AccessError | null {
  const value = first(params.errore);
  const provider = value === "google" || value === "apple" ? value : null;
  if (!provider && value !== "accesso") return null;
  return {
    provider,
    cancelled: provider !== null && first(params.annullato) === "1",
  };
}

async function Welcome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = readInviteToken(await cookies());
  const supabase = await createClient();
  const session = await readInviteSession(supabase);
  if (session.kind === "error") return <OnboardingError />;
  const householdId = session.kind === "user" ? session.householdId : null;

  // No invitation cookie: the same page as for an invitation that is gone.
  // Only someone with a Nest, sent here after the cookie was deleted, sees
  // the «already in another Nest» state.
  if (!token) {
    return (
      <InviteEnded
        kind={
          householdId && first(params.stato) === "altro-nest"
            ? "other-nest"
            : "expired"
        }
      />
    );
  }

  // The names are never asked for here: this page is public.
  const preview = await getInvitationPreview(supabase, token, false);
  if (preview.status === "error") return <OnboardingError />;

  if (householdId) {
    // Same Nest as the invitation: nothing to do, go to Oggi. Another Nest:
    // one account stays in one Nest. Either way the cookie goes. The database
    // says whether the caller is a member of the invitation's Nest.
    const sameNest = preview.status === "valid" && preview.callerIsMember;
    redirect(`/invito/chiudi?vai=${sameNest ? "oggi" : "altro-nest"}`);
  }

  // Scaduto, revocato, già usato, sconosciuto: nothing of the Nest.
  if (preview.status === "invalid") redirect("/invito/chiudi?vai=errore");

  return (
    <InviteWelcome
      nestName={preview.householdName}
      inviterName={preview.inviterName}
      message={preview.message}
      inviteeName={preview.inviteeName}
      members={preview.members.map((m) => ({
        initial: m.initial,
        color: m.color,
      }))}
      expiryLead={expiryLead(preview.expiresAt)}
      initialError={readError(params)}
    />
  );
}

// Reading the cookie and the session is request-time data, so it sits inside
// <Suspense>.
export default function InvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Welcome searchParams={searchParams} />
    </Suspense>
  );
}
