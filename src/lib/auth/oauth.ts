import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "./safe-next";

/**
 * Sign-in with Apple and Google started from the browser, shared by the
 * sign-in page (01) and the invitation welcome page (07). Browser only.
 */
export type Provider = "google" | "apple";

/** Error shown on top of the buttons. `provider` null = unknown provider. */
export type AccessError = { provider: Provider | null; cancelled: boolean };

export const PROVIDER_NAME: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
};

/** Text of the error notice, the same on every page that signs in. */
export function accessErrorText({ provider, cancelled }: AccessError): string {
  if (!provider) {
    return "Accesso non riuscito. Controlla la connessione e riprova.";
  }
  const name = PROVIDER_NAME[provider];
  return cancelled
    ? `Accesso con ${name} annullato. Riprova o scegli un altro modo per entrare.`
    : `Accesso con ${name} non riuscito. Controlla la connessione e riprova.`;
}

/**
 * Starts the sign-in. `started`: the browser is going to the provider's page
 * (the loading state stays). `failed`: no connection or the start failed,
 * nothing happened. `next` is an internal path, never a token: the return is
 * `/auth/callback?provider=…&next=…`.
 */
export async function startOAuthSignIn(
  provider: Provider,
  options: { next?: string } = {},
): Promise<"started" | "failed"> {
  if (!navigator.onLine) return "failed";
  // `next` goes through the same check as the return routes: an external or
  // forbidden path (an invitation address with its token) is refused.
  const next = options.next === undefined ? null : safeNextPath(options.next);
  if (options.next !== undefined && next === null) return "failed";
  try {
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("provider", provider);
    if (next) redirectTo.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString() },
    });
    return error ? "failed" : "started";
  } catch {
    return "failed";
  }
}
