import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import { PeopleSkeleton } from "@/components/onboarding/PeopleSkeleton";
import { PeopleStep, type Person } from "@/components/onboarding/PeopleStep";
import { requireUser } from "@/lib/auth/require-user";
import { formatAge } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "FamilyNest · Chi c'è nel Nest?",
};

/** Second line of a row: the role, plus age or invitation note. */
function infoOf(member: {
  kind: "adult" | "child" | "pet";
  birth_date: string | null;
  user_id: string | null;
}): string {
  if (member.kind === "adult") {
    return member.user_id ? "Adulto" : "Adulto · riceverà un invito";
  }
  const role = member.kind === "child" ? "Figlio o figlia" : "Animale";
  return member.birth_date ? `${role} · ${formatAge(member.birth_date)}` : role;
}

async function People() {
  // No session -> /accesso.
  const { userId, failed } = await requireUser();
  if (failed || !userId) return <OnboardingError />;

  const supabase = await createClient();
  const household = await supabase.rpc("current_household_id");
  if (household.error) return <OnboardingError />;
  // Signed in but no Nest yet: back to step 1.
  if (!household.data) redirect("/onboarding");

  const [nest, members] = await Promise.all([
    supabase
      .from("households")
      .select("household_type")
      .eq("id", household.data)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("id, name, color, kind, birth_date, user_id, is_admin")
      .eq("household_id", household.data)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (nest.error || members.error || !nest.data) return <OnboardingError />;

  // Only the administrator sets up the Nest.
  const me = members.data.find((member) => member.user_id === userId);
  if (!me?.is_admin) redirect("/oggi");

  // Account ids and emails never reach the browser: only these flags.
  const people: Person[] = members.data.map((member) => ({
    id: member.id,
    name: member.name,
    color: member.color,
    kind: member.kind,
    birthDate: member.birth_date,
    isYou: member.user_id === userId,
    hasAccount: member.user_id !== null,
    info: infoOf(member),
  }));

  return (
    <PeopleStep householdType={nest.data.household_type} people={people} />
  );
}

// Reading the session is request-time data, so it sits inside <Suspense>.
export default function PeoplePage() {
  return (
    <Suspense fallback={<PeopleSkeleton />}>
      <People />
    </Suspense>
  );
}
