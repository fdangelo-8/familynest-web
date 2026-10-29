import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/Placeholder/PlaceholderPage";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["casa-scadenze"].browserTitle,
};

export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  await requireNest();
  return <PlaceholderPage pageKey="casa-scadenze" />;
}
