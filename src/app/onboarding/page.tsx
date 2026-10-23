import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = {
  title: "FamilyNest · Chi vive con te?",
};

// Placeholder until the real onboarding (#12). No app frame.
export default async function OnboardingPage() {
  // Needs a session, not a Nest: no session -> /accesso.
  await requireUser();
  return (
    <main className="pagina pagina-desktop pagina-desktop--centrata">
      <div className="intestazione">
        <p className="intestazione__sopra">Primo passo</p>
        <h1 className="intestazione__titolo t-titolo-pagina">
          Chi vive con te?
        </h1>
      </div>
      <EmptyState
        icon="users"
        title="In arrivo"
        text="Qui creerai il tuo Nest e dirai chi vive con te. Stiamo preparando questa pagina."
        actions={null}
      />
    </main>
  );
}
