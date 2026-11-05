import { isFakeCalendarProviderEnabled } from "@/lib/env";
import { createFakeProvider } from "./fake-provider";
import {
  ProviderUnavailableError,
  type CalendarProvider,
  type ProviderId,
} from "./types";

/*
 * Which provider answers (#34 §11): the fake one when it is switched on
 * (development and tests, never on Vercel) and when the account is a fake account; the
 * real one otherwise. The real adapters of Google (#34 part 3) and Outlook
 * (#35) are added to `REAL` when they exist; until then a real provider is
 * simply unavailable, and nobody pretends otherwise.
 *
 * A fake account is ignored by production: with the fake switched off,
 * `providerFor(id, true)` throws, and the synchronisation skips the account.
 */
const REAL: Partial<Record<ProviderId, () => CalendarProvider | null>> = {};

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
