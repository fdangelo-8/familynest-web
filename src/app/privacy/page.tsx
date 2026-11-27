import type { Metadata } from "next";
import { LegalPage } from "@/components/accesso/LegalPage";
import { brandText, messages, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Informativa sulla privacy"),
};

// Visible to everyone, with or without a session.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa sulla privacy"
      icon="shield"
      soonText={brandText(messages.accesso.privacySoon)}
    />
  );
}
