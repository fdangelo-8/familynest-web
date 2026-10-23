import type { Metadata } from "next";
import { SignOutForm } from "@/components/accesso/SignOutForm";
import { PlaceholderPage } from "@/components/ui/Placeholder/PlaceholderPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["profilo"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  await requireNest();
  // The real page (#38) takes over the "Esci" button.
  return <PlaceholderPage pageKey="profilo" extra={<SignOutForm />} />;
}
