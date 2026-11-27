import type { Metadata } from "next";
import { pageTitle } from "@/lib/brand";
import { redirect } from "next/navigation";
import { ConfirmLinkScreen } from "@/components/accesso/ConfirmLinkScreen";
import { readCurrentAccount } from "@/lib/auth/current-account";

// Answer of `/auth/confirm?token_hash=…&type=recovery` (next.config.ts rewrites
// that address here, the person never sees this one). Reading the page does
// not use the link: only the button does (POST /auth/recupero). `next` is
// never read: the link always ends on the new-password page.
export const metadata: Metadata = {
  title: pageTitle("Nuova password"),
  robots: { index: false, follow: false },
  // Other sites never learn the address of the link.
  referrer: "same-origin",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return one ?? null;
}

export default async function ConfirmRecoveryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  if (!tokenHash || first(params.type) !== "recovery") {
    redirect("/accesso/link-scaduto?tipo=password");
  }

  const current = await readCurrentAccount();
  return (
    <ConfirmLinkScreen
      tokenHash={tokenHash}
      type="recovery"
      current={current ?? undefined}
    />
  );
}
