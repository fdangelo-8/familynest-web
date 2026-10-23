import {
  AccessScreen,
  type AccessError,
} from "@/components/accesso/AccessScreen";
import { redirectIfSignedIn } from "@/lib/auth/destination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// `?errore=google|apple|accesso` is set by /auth/callback; `annullato=1` marks
// a sign-in cancelled by the person at the provider. Other values are ignored.
function readError(params: Record<string, string | string[] | undefined>) {
  const value = first(params.errore);
  const provider = value === "google" || value === "apple" ? value : null;
  if (!provider && value !== "accesso") return null;
  const error: AccessError = {
    provider,
    cancelled: provider !== null && first(params.annullato) === "1",
  };
  return error;
}

export default async function AccessoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Someone who is already signed in never sees the sign-in page.
  await redirectIfSignedIn();
  const params = await searchParams;
  return <AccessScreen initialError={readError(params)} />;
}
