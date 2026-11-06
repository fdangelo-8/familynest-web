import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/*
 * What «Il tuo profilo», «Il tuo Nest» and Oggi say about the calendars the
 * signed-in adult linked (issue #34, part 2). Plain module (no "use client").
 *
 * It reads with the adult's own session: the policies of `calendar_accounts`
 * and `external_calendars` give back only that adult's rows, never those of
 * another adult (not even an administrator). Only the provider names and a
 * count leave: no mail, no calendar name, no credentials.
 */

type Provider = Database["public"]["Enums"]["calendar_provider"];

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  outlook: "Outlook",
};

/** «Google», «Outlook»: the name the app uses for a provider. */
export function providerName(
  provider: Provider | string | null,
): string | null {
  if (provider === null) return null;
  return (PROVIDER_LABEL as Record<string, string>)[provider] ?? null;
}

export type LinkedCalendarsSummary = {
  /** Provider names in order of linking, without repetitions */
  providers: string[];
  /** Calendars switched on, over all the accounts */
  enabledCount: number;
};

export type LinkedCalendarsResult =
  { ok: true; summary: LinkedCalendarsSummary } | { ok: false };

export async function readLinkedCalendars(
  supabase: SupabaseClient<Database>,
): Promise<LinkedCalendarsResult> {
  const [accounts, calendars] = await Promise.all([
    supabase
      .from("calendar_accounts")
      .select("provider")
      .order("connected_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("external_calendars").select("id").eq("is_enabled", true),
  ]);
  if (accounts.error || calendars.error) return { ok: false };
  const providers: string[] = [];
  for (const account of accounts.data) {
    const name = providerName(account.provider);
    if (name && !providers.includes(name)) providers.push(name);
  }
  return {
    ok: true,
    summary: { providers, enabledCount: calendars.data.length },
  };
}

/** «Outlook, Google» (profile); «Nessuno collegato» without accounts. */
export function profileCalendarsInfo(summary: LinkedCalendarsSummary): string {
  return summary.providers.length > 0
    ? summary.providers.join(", ")
    : "Nessuno collegato";
}

/** «Outlook, Google · 3 attivi» (Nest); `null` without accounts. */
export function nestCalendarsInfo(
  summary: LinkedCalendarsSummary,
): string | null {
  if (summary.providers.length === 0) return null;
  const count = summary.enabledCount;
  return `${summary.providers.join(", ")} · ${count} ${count === 1 ? "attivo" : "attivi"}`;
}
