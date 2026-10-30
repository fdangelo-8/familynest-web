import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InviteColor } from "@/components/invito/InviteColor";
import { InviteColorSkeleton } from "@/components/invito/InviteColorSkeleton";
import { readInviteSession } from "@/components/invito/server";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import type { TakenColor } from "@/components/ui/ColorChoice/ColorChoice";
import { getInvitationPreview } from "@/lib/invitation-preview";
import { INVITE_WELCOME_PATH, readInviteToken } from "@/lib/invitations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Scegli il tuo colore",
  robots: { index: false },
};

async function ColorPage() {
  const token = readInviteToken(await cookies());
  const supabase = await createClient();
  const session = await readInviteSession(supabase);
  if (session.kind === "error") return <OnboardingError />;

  // No session: the welcome page (to sign in) if there is an invitation.
  if (session.kind === "anonymous") {
    redirect(token ? INVITE_WELCOME_PATH : "/accesso");
  }
  // Already in a Nest: the welcome page decides (same Nest or another one).
  if (session.householdId) redirect(token ? INVITE_WELCOME_PATH : "/oggi");
  // Signed in, no Nest, no invitation: the usual onboarding.
  if (!token) redirect("/onboarding");

  // Signed in without a Nest: the preview carries the names for «già di …».
  const preview = await getInvitationPreview(supabase, token, true);
  if (preview.status === "error") return <OnboardingError />;
  if (preview.status === "invalid") redirect("/invito/chiudi?vai=errore");

  const taken: TakenColor[] = preview.members.map((member) => ({
    color: member.color,
    by: member.name,
  }));

  return (
    <InviteColor
      inviteeName={preview.inviteeName}
      inviteeColor={preview.inviteeColor}
      inviterName={preview.inviterName}
      taken={taken}
    />
  );
}

// Reading the cookie and the session is request-time data, so it sits inside
// <Suspense>.
export default function InviteColorPage() {
  return (
    <Suspense fallback={<InviteColorSkeleton />}>
      <ColorPage />
    </Suspense>
  );
}
