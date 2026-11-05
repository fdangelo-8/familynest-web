import type { Metadata } from "next";
import { SearchPageSwitch } from "@/components/ricerca/SearchEntry";
import { requireNest } from "@/lib/nest-frame";
import { PLACEHOLDERS } from "@/lib/app-routes";
import OggiPage from "../oggi/page";

export const metadata: Metadata = {
  title: PLACEHOLDERS["ricerca"].browserTitle,
};

/**
 * `/ricerca` opened directly: under 1024 px the search page; from 1024 px
 * Today under the palette, which comes from the `@modal` slot, like Aggiungi.
 * The search text is never in the address.
 */
export default async function Page() {
  // Session and Nest check before anything else (the layout is not a guard).
  await requireNest();
  return <SearchPageSwitch today={<OggiPage />} />;
}
