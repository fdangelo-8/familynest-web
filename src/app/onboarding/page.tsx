import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import { LIVING_BY_TYPE } from "@/components/onboarding/choices";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { greeting } from "@/components/onboarding/names";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Chi vive con te?",
};

type SearchParams = Promise<{ cambia?: string | string[] }>;

async function Onboarding({ searchParams }: { searchParams: SearchParams }) {
  // ?cambia=1 only matters to the administrator of an existing Nest.
  const change = (await searchParams).cambia === "1";
  // Needs a session, not a Nest: no session -> /accesso.
  const { userId, failed } = await requireUser();
  // Auth did not answer: page-wide error with "Riprova".
  if (failed || !userId) return <OnboardingError />;

  const supabase = await createClient();
  const [household, profile] = await Promise.all([
    supabase.rpc("current_household_id"),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (household.error || profile.error) return <OnboardingError />;
  if (household.data) {
    // Someone who already has a Nest never sees this page, except its
    // administrator coming back from step 2 to change the answer.
    if (!change) redirect("/oggi");
    const [member, nest] = await Promise.all([
      supabase
        .from("household_members")
        .select("is_admin")
        .eq("household_id", household.data)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("households")
        .select("household_type")
        .eq("id", household.data)
        .maybeSingle(),
    ]);
    if (member.error || nest.error) return <OnboardingError />;
    if (!member.data?.is_admin || !nest.data) redirect("/oggi");
    return (
      <OnboardingStep
        greeting={greeting(profile.data?.display_name)}
        saved={LIVING_BY_TYPE[nest.data.household_type]}
      />
    );
  }

  // Only the greeting reaches the browser: no email, no id.
  return <OnboardingStep greeting={greeting(profile.data?.display_name)} />;
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={null}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}
