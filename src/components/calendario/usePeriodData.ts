"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysToDayKey, startOfDay } from "@/lib/datetime";
import { listHouseholdEvents } from "@/lib/household-events";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { keyEvents, type KeyedEvent, type Roster } from "./model";

type Client = SupabaseClient<Database>;

export type PeriodEntry = {
  events: KeyedEvent[];
  /** Epoch ms of the last successful read of this period */
  readAt: number;
};

/** Members of the Nest and the one of the signed-in user. Null on failure. */
async function readRoster(client: Client): Promise<Roster | null> {
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const [members, me] = await Promise.all([
    client
      .from("household_members")
      .select("id, name, color, kind")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("household_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (members.error || me.error || !members.data) return null;
  return { members: members.data, meId: me.data?.id ?? null };
}

export type PeriodData = {
  /** Events of the period, once read at least one time */
  entry: PeriodEntry | undefined;
  roster: Roster | null;
  /** The last reading of this period did not succeed */
  failed: boolean;
  /** «Riprova» is running */
  retrying: boolean;
  retry: () => void;
};

/**
 * Reads the events of a period (a week, a day, a month grid) in the browser, so
 * the page owns its loading and error states. `periodKey` is the day key of the
 * first day and `days` how many days to read (at most 42). Periods already read
 * stay in memory while the page is open and are read again at each change of
 * period, with «Riprova» and when the network comes back.
 */
export function usePeriodData(periodKey: string, days: number): PeriodData {
  const [entries, setEntries] = useState<Record<string, PeriodEntry>>({});
  const [failures, setFailures] = useState<Record<string, boolean>>({});
  const [roster, setRoster] = useState<Roster | null>(null);
  const [retrying, setRetrying] = useState(false);

  const entriesRef = useRef(entries);
  const rosterRef = useRef<Roster | null>(null);
  const clientRef = useRef<Client | null>(null);
  const sequence = useRef<Record<string, number>>({});
  const currentKey = useRef(periodKey);
  const currentDays = useRef(days);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    currentKey.current = periodKey;
    currentDays.current = days;
  }, [periodKey, days]);

  const read = useCallback(
    async (key: string, length: number, keepFailure = false): Promise<void> => {
      const mine = (sequence.current[key] ?? 0) + 1;
      sequence.current[key] = mine;
      // A period never read goes back to loading while it is read again.
      await Promise.resolve();
      if (!keepFailure && !entriesRef.current[key]) {
        setFailures((current) =>
          current[key] ? { ...current, [key]: false } : current,
        );
      }
      let events: KeyedEvent[] | null = null;
      let nextRoster: Roster | null = null;
      try {
        clientRef.current ??= createClient();
        const client = clientRef.current;
        const [result, members] = await Promise.all([
          listHouseholdEvents(
            startOfDay(key),
            startOfDay(addDaysToDayKey(key, length)),
            client,
          ),
          rosterRef.current
            ? Promise.resolve(rosterRef.current)
            : readRoster(client),
        ]);
        if (result.ok && members) {
          events = keyEvents(result.events);
          nextRoster = members;
        }
      } catch {
        events = null;
      }
      // A newer reading of the same period wins.
      if (sequence.current[key] !== mine) return;
      if (events === null || nextRoster === null) {
        setFailures((current) => ({ ...current, [key]: true }));
        return;
      }
      rosterRef.current = nextRoster;
      setRoster(nextRoster);
      setEntries((current) => ({
        ...current,
        [key]: { events: events as KeyedEvent[], readAt: Date.now() },
      }));
      setFailures((current) =>
        current[key] ? { ...current, [key]: false } : current,
      );
    },
    [],
  );

  useEffect(() => {
    void read(periodKey, days);
  }, [read, periodKey, days]);

  // The network goes away or comes back: read the open period again.
  useEffect(() => {
    const reload = () => void read(currentKey.current, currentDays.current);
    window.addEventListener("online", reload);
    window.addEventListener("offline", reload);
    return () => {
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", reload);
    };
  }, [read]);

  const retry = useCallback(() => {
    setRetrying(true);
    void read(currentKey.current, currentDays.current, true).finally(() =>
      setRetrying(false),
    );
  }, [read]);

  return {
    entry: entries[periodKey],
    roster,
    failed: failures[periodKey] === true,
    retrying,
    retry,
  };
}
