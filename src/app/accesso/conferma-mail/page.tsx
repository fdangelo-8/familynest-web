import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmLinkScreen } from "@/components/accesso/ConfirmLinkScreen";
import { readCurrentAccount } from "@/lib/auth/current-account";
import { safeNextPath } from "@/lib/auth/safe-next";

// Answer of `/auth/confirm?token_hash=…&type=email|signup` (next.config.ts
// rewrites that address here, the person never sees this one). Reading the
// page does not use the link: only the button does (POST /auth/confirm).
export const metadata: Metadata = {
  title: "FamilyNest · Conferma dell'indirizzo",
  robots: { index: false, follow: false },
  // Other sites never learn the address of the link.
  referrer: "same-origin",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return one ?? null;
}

export default async function ConfirmMailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  if (!tokenHash || (type !== "email" && type !== "signup")) {
    redirect("/accesso/link-scaduto?tipo=conferma");
  }

  const current = await readCurrentAccount();
  return (
    <ConfirmLinkScreen
      tokenHash={tokenHash}
      type={type}
      next={safeNextPath(first(params.next)) ?? undefined}
      current={current ?? undefined}
    />
  );
}
