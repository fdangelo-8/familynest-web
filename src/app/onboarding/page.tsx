import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";

export const metadata: Metadata = {
  title: "FamilyNest · Chi vive con te?",
};

// Placeholder until the real onboarding (#12). No app frame.
export default function OnboardingPage() {
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
