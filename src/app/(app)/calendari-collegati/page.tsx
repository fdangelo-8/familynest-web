import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/Placeholder/PlaceholderPage";
import { PLACEHOLDERS } from "@/lib/app-routes";

export const metadata: Metadata = {
  title: PLACEHOLDERS["calendari-collegati"].browserTitle,
};

export default function Page() {
  return <PlaceholderPage pageKey="calendari-collegati" />;
}
