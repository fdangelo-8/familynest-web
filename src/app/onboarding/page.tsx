import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { greeting } from "@/components/onboarding/names";
import { FrameError } from "@/components/ui/AppFrame/FrameError";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Chi vive con te?",
};

async function Onboarding() {
  // Needs a session, not a Nest: no session -> /accesso.
  const { userId, failed } = await requireUser();
  // Auth did not answer: page-wide error with "Riprova".
  if (failed || !userId) return <FrameError />;

  const supabase = await createClient();
  const [household, profile] = await Promise.all([
    supabase.rpc("current_household_id"),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (household.error || profile.error) return <FrameError />;
  // Someone who already has a Nest never sees this page.
  if (household.data) redirect("/oggi");

  // Only the greeting reaches the browser: no email, no id.
  return <OnboardingStep greeting={greeting(profile.data?.display_name)} />;
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
