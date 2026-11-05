import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { mintFakeConsentCodes } from "@/lib/calendar-sync/fake-provider";
import { ADMIN_APPROVAL_ERROR } from "@/lib/calendar-sync/oauth";
import { isProviderId } from "@/lib/calendar-sync/types";
import { isFakeCalendarProviderEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/*
 * The consent page of the fake provider (#34 §11): the page of Google or
 * Outlook for the tests, with «Consenti», «Consenti senza calendario» and
 * «Nega». It exists only where the fake provider is switched on (never in
 * production): everywhere else it is a 404.
 */
export const metadata: Metadata = {
  title: "FamilyNest · Fornitore finto",
  robots: { index: false, follow: false },
};

const NAMES = { google: "Google", outlook: "Outlook" } as const;
const SAFE_VALUE = /^[A-Za-z0-9_-]{1,200}$/;

function first(value: string | string[] | undefined): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return one && SAFE_VALUE.test(one) ? one : null;
}

type PageProps = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/* Request data (params, searchParams, cookies) is read below a Suspense
 * boundary, as cacheComponents requires. */
export default function FakeProviderPage(props: PageProps) {
  if (!isFakeCalendarProviderEnabled()) notFound();
  return (
    <Suspense fallback={null}>
      <FakeProviderConsent {...props} />
    </Suspense>
  );
}

async function FakeProviderConsent({ params, searchParams }: PageProps) {
  const { provider } = await params;
  if (!isProviderId(provider)) notFound();
  const query = await searchParams;
  const state = first(query.state);
  const challenge = first(query.code_challenge);
  if (!state || !challenge) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const codes = data.user
    ? mintFakeConsentCodes(provider, data.user.id, challenge)
    : null;

  const back = (extra: Record<string, string>) => {
    const search = new URLSearchParams({ ...extra, state });
    return `/calendari-collegati/ritorno/${provider}?${search.toString()}`;
  };

  return (
    <main className="pagina">
      <div className="intestazione">
        <p className="intestazione__sopra">Solo per le prove</p>
        <h1 className="intestazione__titolo t-titolo-pagina">
          {NAMES[provider]} finto
        </h1>
        <p className="intestazione__sotto">
          {codes
            ? "FamilyNest chiede di leggere i tuoi calendari e di scrivere i loro impegni."
            : "Non c'è nessun account preparato per questa prova."}
        </p>
      </div>
      <div className="colonna">
        {codes ? (
          <>
            <a className="btn-primary" href={back({ code: codes.full })}>
              Consenti
            </a>
            <a
              className="btn-secondary"
              href={back({ code: codes.withoutCalendar })}
            >
              Consenti senza calendario
            </a>
          </>
        ) : null}
        <a className="btn-secondary" href={back({ error: "access_denied" })}>
          Nega
        </a>
        <a
          className="btn-secondary"
          href={back({ error: ADMIN_APPROVAL_ERROR })}
        >
          {"Serve l'approvazione dell'amministratore"}
        </a>
      </div>
    </main>
  );
}
