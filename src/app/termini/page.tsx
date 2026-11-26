import type { Metadata } from "next";
import { LegalPage } from "@/components/accesso/LegalPage";
import { brandText, messages, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Termini d'uso"),
};

// Visible to everyone, with or without a session.
export default function TerminiPage() {
  return (
    <LegalPage
      title="Termini d'uso"
      icon="book-open"
      soonText={brandText(messages.accesso.termsSoon)}
    />
  );
}
