"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ProviderKey } from "./model";

/**
 * The way to a provider (#34 §10): a plain form that sends the browser, in the
 * same window, to the route of the server. The server draws `state` and PKCE,
 * keeps them in an HttpOnly cookie and answers with a redirect to the page of
 * Google or Microsoft. Nothing secret is ever in this page.
 *
 * `children` gets `loading`: from the submit until the page changes the
 * button shows its spinner. Coming back with the «Indietro» of the browser
 * restores the page from memory, so the state is put back then.
 */
export function ConnectForm({
  provider,
  children,
}: {
  provider: ProviderKey;
  children: (loading: boolean) => ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLoading(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      method="post"
      action={`/calendari-collegati/collega/${provider}`}
      onSubmit={() => setLoading(true)}
    >
      <input type="hidden" name="destination" value="page" />
      {children(loading)}
    </form>
  );
}
