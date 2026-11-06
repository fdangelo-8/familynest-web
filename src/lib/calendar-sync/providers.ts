import {
  getCalendarEncryptionKey,
  getGoogleCalendarClient,
  getMicrosoftCalendarClient,
  isFakeCalendarProviderEnabled,
} from "@/lib/env";
import { createFakeProvider } from "./fake-provider";
import { createGoogleProvider } from "./google-provider";
import { createOutlookProvider } from "./outlook-provider";
import {
  ProviderUnavailableError,
  type CalendarProvider,
  type ProviderId,
} from "./types";

/*
 * Which provider answers (#34 §11): the fake one when it is switched on
 * (development and tests, never on Vercel) and when the account is a fake account; the
 * real one otherwise. The real adapters of Google and Outlook (#329) exist
 * only when the keys of their OAuth client are in the environment; without
 * them a real provider is simply unavailable, and nobody pretends otherwise.
 *
 * A fake account is ignored by production: with the fake switched off,
 * `providerFor(id, true)` throws, and the synchronisation skips the account.
 */
const REAL: Partial<Record<ProviderId, () => CalendarProvider | null>> = {
  google: () => {
    const client = getGoogleCalendarClient();
    return client ? createGoogleProvider(realDeps(client)) : null;
  },
  outlook: () => {
    const client = getMicrosoftCalendarClient();
    return client ? createOutlookProvider(realDeps(client)) : null;
  },
};

function realDeps(client: { clientId: string; clientSecret: string }) {
  return {
    ...client,
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      fetch(input, init),
    sleep: (ms: number) => new Promise<void>((done) => setTimeout(done, ms)),
    now: () => new Date(),
  };
}

/**
 * Whether a link to this provider can start: the fake one is on, or the two
 * keys of the OAuth client and the key that encrypts the credentials exist.
 */
export function isProviderConfigured(id: ProviderId): boolean {
  if (isFakeCalendarProviderEnabled()) return true;
  const client =
    id === "google" ? getGoogleCalendarClient() : getMicrosoftCalendarClient();
  if (!client) return false;
  try {
    getCalendarEncryptionKey();
  } catch {
    return false;
  }
  return true;
}

export function providerFor(id: ProviderId, isFake: boolean): CalendarProvider {
  if (isFake) {
    if (!isFakeCalendarProviderEnabled()) throw new ProviderUnavailableError();
    return createFakeProvider(id);
  }
  const real = REAL[id]?.() ?? null;
  if (!real) throw new ProviderUnavailableError();
  return real;
}

/**
 * The provider for a new link: the fake when it is switched on, otherwise the
 * real one. Returns also whether the account it creates is a fake one.
 */
export function providerForNewLink(id: ProviderId): {
  provider: CalendarProvider;
  isFake: boolean;
} {
  if (isFakeCalendarProviderEnabled()) {
    return { provider: createFakeProvider(id), isFake: true };
  }
  return { provider: providerFor(id, false), isFake: false };
}
