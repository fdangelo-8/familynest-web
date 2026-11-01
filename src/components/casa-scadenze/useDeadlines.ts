"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  notifyListsRefreshed,
  subscribeListsChanged,
} from "@/components/aggiungi/coordination";
import { createClient } from "@/lib/supabase/client";
import { byDueDate, type Deadline, type DeadlineMember } from "./model";

export type DeadlinesStatus = "loading" | "ready" | "error";

type ReadResult =
  | {
      ok: true;
      deadlines: Deadline[];
      members: DeadlineMember[];
      meId: string | null;
    }
  | { ok: false };

/**
 * Reads what the page needs with the session of the signed-in user (RLS
 * decides what is visible: «Solo io» deadlines of the others never arrive).
 * On a failure only the fact is kept: the error object can carry the whole
 * row in `details`, so it is never read, shown or logged.
 */
async function readEverything(): Promise<ReadResult> {
  try {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return { ok: false };

    const [deadlines, members, me] = await Promise.all([
      supabase
        .from("deadlines")
        .select(
          "id, title, due_date, note, assignee_member_id, for_member_id, is_private, created_at",
        )
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("household_members")
        .select("id, name, color")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("household_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (deadlines.error || members.error || me.error) return { ok: false };

    return {
      ok: true,
      deadlines: (deadlines.data ?? [])
        .map((row) => ({
          id: row.id,
          title: row.title,
          dueDate: row.due_date,
          note: row.note,
          assigneeId: row.assignee_member_id,
          forMemberId: row.for_member_id,
          isPrivate: row.is_private,
          createdAt: row.created_at,
        }))
        .sort(byDueDate),
      members: members.data ?? [],
      meId: me.data?.id ?? null,
    };
  } catch {
    return { ok: false };
  }
}

export type DeadlinesList = {
  status: DeadlinesStatus;
  deadlines: Deadline[];
  members: DeadlineMember[];
  /** The member of the signed-in user */
  meId: string | null;
  /** "Riprova" is running */
  retrying: boolean;
  retry: () => void;
};

/** Reads the deadlines when the page opens; later changes show on reload. */
export function useDeadlines(): DeadlinesList {
  const [status, setStatus] = useState<DeadlinesStatus>("loading");
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [members, setMembers] = useState<DeadlineMember[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const running = useRef(false);
  const again = useRef(false);

  const load = useCallback(async () => {
    if (running.current) {
      // A change arrived while reading: read once more when this one ends.
      again.current = true;
      return;
    }
    running.current = true;
    let result = await readEverything();
    // Changes that arrived during the read: read once more, the last one counts.
    while (again.current) {
      again.current = false;
      result = await readEverything();
    }
    running.current = false;
    if (!result.ok) {
      setStatus("error");
    } else {
      setDeadlines(result.deadlines);
      setMembers(result.members);
      setMeId(result.meId);
      setStatus("ready");
      notifyListsRefreshed("deadlines");
    }
    setRetrying(false);
  }, []);

  useEffect(() => {
    // Reads once when the page opens.
    void load();
  }, [load]);

  // Aggiungi saved, changed or removed a deadline: read again.
  useEffect(
    () => subscribeListsChanged("deadlines", () => void load()),
    [load],
  );

  const retry = useCallback(() => {
    setRetrying(true);
    void load();
  }, [load]);

  return { status, deadlines, members, meId, retrying, retry };
}
