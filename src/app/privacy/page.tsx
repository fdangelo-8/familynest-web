import type { Metadata } from "next";
import { LegalPage } from "@/components/accesso/LegalPage";

export const metadata: Metadata = {
  title: "FamilyNest · Informativa sulla privacy",
};

// Visible to everyone, with or without a session.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa sulla privacy"
      icon="shield"
      soonText="Qui leggerai quali dati raccoglie FamilyNest, perché e come li proteggiamo. Stiamo preparando questa pagina."
    />
  );
}
