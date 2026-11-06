import { ExpiredScreen } from "@/components/accesso/ExpiredScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// `?tipo=password` is the recovery link; `conferma` and every other value
// (or none) is the confirmation link.
export default async function LinkScadutoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Someone who is already signed in never sees the sign-in pages.
  await redirectIfSignedIn();
  const { tipo } = await searchParams;
  const value = Array.isArray(tipo) ? tipo[0] : tipo;
  return (
    <ExpiredScreen kind={value === "password" ? "password" : "conferma"} />
  );
}
