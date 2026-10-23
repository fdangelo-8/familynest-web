import type { Metadata } from "next";
import { LegalPage } from "@/components/accesso/LegalPage";

export const metadata: Metadata = {
  title: "FamilyNest · Termini d'uso",
};

// Visible to everyone, with or without a session.
export default function TerminiPage() {
  return (
    <LegalPage
      title="Termini d'uso"
      icon="book-open"
      soonText="Qui leggerai le regole per usare FamilyNest. Stiamo preparando questa pagina."
    />
  );
}
