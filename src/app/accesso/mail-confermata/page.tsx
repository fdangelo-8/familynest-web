import type { Metadata } from "next";
import { pageTitle } from "@/lib/brand";
import { redirect } from "next/navigation";
import {
  ConfirmedError,
  ConfirmedScreen,
} from "@/components/accesso/ConfirmedScreen";
import { resolveDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: pageTitle("Mail confermata"),
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Read =
  | { kind: "error" }
  | { kind: "anonymous" }
  | { kind: "user"; email: string | null; destination: string };

// Not `redirectIfSignedIn`: this page is for whoever is signed in.
async function readAccount(next: string | null): Promise<Read> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    // Only a network failure is a technical error: any other answer means
    // there is no valid session.
    if (error?.name === "AuthRetryableFetchError") return { kind: "error" };
    if (error || !data.user) return { kind: "anonymous" };
    return {
      kind: "user",
      email: data.user.email ?? null,
      destination: await resolveDestination(supabase, next),
    };
  } catch {
    return { kind: "error" };
  }
}

export default async function MailConfirmedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;
  const result = await readAccount(
    (Array.isArray(next) ? next[0] : next) ?? null,
  );
  // redirect() throws: it stays outside the try block.
  if (result.kind === "anonymous") redirect("/accesso");
  if (result.kind === "error") return <ConfirmedError />;
  // An account without a mail has nothing to show: it goes on.
  if (!result.email) redirect(result.destination);
  return (
    <ConfirmedScreen email={result.email} destination={result.destination} />
  );
}
