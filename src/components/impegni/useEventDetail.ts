"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEventOccurrence,
  type EventOccurrence,
} from "@/lib/household-events";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { EventMember } from "./model";

type Client = SupabaseClient<Database>;

export type DetailState =
  | { status: "loading" }
  /** The reading failed (network or technical error) */
  | { status: "error" }
  /** No such event for this reader: gone, not visible, or not an occurrence */
  | { status: "missing" }
  | {
      status: "ready";
      occurrence: EventOccurrence;
      members: EventMember[];
      /** Member id of the signed-in user */
      meId: string;
    };

type Read =
  | {
      kind: "ok";
      occurrence: EventOccurrence;
      members: EventMember[];
      meId: string;
    }
  | { kind: "missing" }
  | { kind: "error" };

async function readMembers(
  supabase: Client,
): Promise<{ members: EventMember[]; meId: string } | null> {
  const [session, rows] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("household_members")
      .select("id, name, color, kind, user_id")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  const userId = session.data.session?.user.id;
  if (!userId || rows.error) return null;
  const members: EventMember[] = rows.data.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    kind: row.kind,
    userId: row.user_id,
  }));
  const me = members.find((member) => member.userId === userId);
  return me ? { members, meId: me.id } : null;
}

/** Reads one occurrence and the members of the Nest. Never throws. */
async function read(
  supabase: Client,
  id: string,
  day: string | null,
): Promise<Read> {
  try {
    const [occurrence, people] = await Promise.all([
      getEventOccurrence(id, day, supabase),
      readMembers(supabase),
    ]);
    if (!occurrence.ok || !people) return { kind: "error" };
    if (!occurrence.occurrence) return { kind: "missing" };
    return {
      kind: "ok",
      occurrence: occurrence.occurrence,
      members: people.members,
      meId: people.meId,
    };
  } catch {
    return { kind: "error" };
  }
}

export type EventDetail = {
  state: DetailState;
  /** «Riprova» is reading again */
  retrying: boolean;
  retry: () => void;
  /** Reads again (after a save) for the given occurrence; resolves when done */
  reload: (id: string, day: string) => Promise<void>;
  /** The event turned out to be gone (deleted by someone else) */
  markMissing: () => void;
};

/**
 * Reads the occurrence in the browser, so the page shows its own loading and
 * error states and the server HTML carries no data of the event (#19).
 */
export function useEventDetail(
  eventId: string,
  day: string | null,
): EventDetail {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [retrying, setRetrying] = useState(false);
  const client = useRef<Client | null>(null);
  // What the page shows now: «Riprova» reads this, not the first address.
  const current = useRef<{ id: string; day: string | null }>({
    id: eventId,
    day,
  });
  const alive = useRef(true);
  const sequence = useRef(0);

  const getClient = useCallback((): Client => {
    client.current ??= createClient();
    return client.current;
  }, []);

  const run = useCallback(
    async (id: string, nextDay: string | null) => {
      const mine = ++sequence.current;
      current.current = { id, day: nextDay };
      const result = await read(getClient(), id, nextDay);
      // A newer reading took over, or the page is gone.
      if (!alive.current || mine !== sequence.current) return;
      if (result.kind === "ok") {
        setState({
          status: "ready",
          occurrence: result.occurrence,
          members: result.members,
          meId: result.meId,
        });
      } else {
        setState({ status: result.kind });
      }
    },
    [getClient],
  );

  useEffect(() => {
    alive.current = true;
    void run(eventId, day);
    return () => {
      alive.current = false;
    };
  }, [run, eventId, day]);

  const retry = useCallback(() => {
    setRetrying(true);
    void run(current.current.id, current.current.day).finally(() => {
      if (alive.current) setRetrying(false);
    });
  }, [run]);

  const reload = useCallback(
    (id: string, nextDay: string) => run(id, nextDay),
    [run],
  );

  const markMissing = useCallback(() => {
    sequence.current += 1;
    setState({ status: "missing" });
  }, []);

  return { state, retrying, retry, reload, markMissing };
}
