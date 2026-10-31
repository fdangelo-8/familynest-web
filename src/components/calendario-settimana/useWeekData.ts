"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysToDayKey, startOfDay } from "@/lib/datetime";
import { listHouseholdEvents } from "@/lib/household-events";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { keyEvents, type KeyedEvent, type Roster } from "./model";

type Client = SupabaseClient<Database>;

export type WeekEntry = {
  events: KeyedEvent[];
  /** Epoch ms of the last successful read of this week */
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

export type WeekData = {
  /** Events of the week, once read at least one time */
  entry: WeekEntry | undefined;
  roster: Roster | null;
  /** The last reading of this week did not succeed */
  failed: boolean;
  /** «Riprova» is running */
  retrying: boolean;
  retry: () => void;
};

/**
 * Reads the events of a week in the browser (so the page owns its loading and
 * error states). Weeks already read stay in memory while the page is open and
 * are read again at each change of week, with «Riprova» and when the network
 * comes back.
 */
export function useWeekData(weekKey: string): WeekData {
  const [entries, setEntries] = useState<Record<string, WeekEntry>>({});
  const [failures, setFailures] = useState<Record<string, boolean>>({});
  const [roster, setRoster] = useState<Roster | null>(null);
  const [retrying, setRetrying] = useState(false);

  const entriesRef = useRef(entries);
  const rosterRef = useRef<Roster | null>(null);
  const clientRef = useRef<Client | null>(null);
  const sequence = useRef<Record<string, number>>({});
  const currentKey = useRef(weekKey);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  useEffect(() => {
    currentKey.current = weekKey;
  }, [weekKey]);

  const read = useCallback(
    async (key: string, keepFailure = false): Promise<void> => {
      const mine = (sequence.current[key] ?? 0) + 1;
      sequence.current[key] = mine;
      // A week never read goes back to loading while it is read again.
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
            startOfDay(addDaysToDayKey(key, 7)),
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
      // A newer reading of the same week wins.
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
    void read(weekKey);
  }, [read, weekKey]);

  // The network goes away or comes back: read the open week again.
  useEffect(() => {
    const reload = () => void read(currentKey.current);
    window.addEventListener("online", reload);
    window.addEventListener("offline", reload);
    return () => {
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", reload);
    };
  }, [read]);

  const retry = useCallback(() => {
    setRetrying(true);
    void read(currentKey.current, true).finally(() => setRetrying(false));
  }, [read]);

  return {
    entry: entries[weekKey],
    roster,
    failed: failures[weekKey] === true,
    retrying,
    retry,
  };
}
