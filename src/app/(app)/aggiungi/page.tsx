import type { Metadata } from "next";
import { PLACEHOLDERS } from "@/lib/app-routes";
import { requireNest } from "@/lib/nest-frame";
import OggiPage from "../oggi/page";

export const metadata: Metadata = {
  title: PLACEHOLDERS["aggiungi"].browserTitle,
};

/**
 * Today under the sheet. The sheet itself comes from the `@modal` slot. The
 * page is Today's own page, so it follows Today when it is built (#30).
 */
export default async function Page() {
  await requireNest();
  return <OggiPage />;
}
