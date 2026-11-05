import type { Metadata } from "next";
import { PublicWishlistPage } from "@/components/desideri/PublicWishlistPage";

// The only public page with the data of a family (decision D2). The HTML has
// nothing of the list: no name of the child, no `og:` tags, no description.
// The title is always the same (it ends up in the history and in previews).
// The headers `X-Robots-Tag`, `Referrer-Policy` and `Cache-Control` of
// `/desideri/...` are in `next.config.ts`.
export const metadata: Metadata = {
  title: "FamilyNest · Lista desideri",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({
  params,
}: {
  params: Promise<{ codice: string }>;
}) {
  const { codice } = await params;
  // The form of the code is checked in the browser before any request.
  return <PublicWishlistPage code={codice} />;
}
