"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEMBER_COLORS, type MemberColor } from "@/components/ui/Avatar/Avatar";
import type {
  ChoosableColor,
  TakenColor,
} from "@/components/ui/ColorChoice/ColorChoice";
import { listHouseholdEvents } from "@/lib/household-events";
import { createClient } from "@/lib/supabase/client";
import {
  pickWeekEvents,
  toTimeValue,
  weekBounds,
  type ChildData,
} from "./model";

export type ChildStatus = "loading" | "ready" | "error" | "missing";

type ReadResult =
  { kind: "ok"; data: ChildData } | { kind: "missing" } | { kind: "error" };

const isMemberColor = (value: string): value is MemberColor =>
  (MEMBER_COLORS as ReadonlyArray<string>).includes(value);

/**
 * Reads everything the page needs with the session of the signed-in user (RLS
 * decides what is visible: «Solo io» events and deadlines of the others never
 * arrive). «Now» is taken here, in the browser. On a failure only the fact is
 * kept: the error objects can carry the rows in `details`, so they are never
 * read, shown or logged.
 */
async function readChild(childId: string): Promise<ReadResult> {
  try {
    const supabase = createClient();
    const now = new Date();
    const { from, to } = weekBounds(now);

    const [members, birth, profile, teachers, deadlines, events] =
      await Promise.all([
        supabase
          .from("household_members")
          .select("id, kind, name, color")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        // The birth date is read for the open child only.
        supabase
          .from("household_members")
          .select("birth_date")
          .eq("id", childId)
          .maybeSingle(),
        supabase
          .from("child_profiles")
          .select(
            "school_name, school_class, school_starts_at, school_ends_at, school_days, school_note, shoe_size, clothing_size, pajama_size, sizes_updated_at",
          )
          .eq("member_id", childId)
          .maybeSingle(),
        supabase
          .from("child_teachers")
          .select("id, name, subject, phone")
          .eq("member_id", childId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("deadlines")
          .select("title, due_date")
          .or(`for_member_id.eq.${childId},assignee_member_id.eq.${childId}`)
          .order("due_date", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(1),
        listHouseholdEvents(from, to, supabase),
      ]);
    if (
      members.error ||
      birth.error ||
      profile.error ||
      teachers.error ||
      deadlines.error ||
      !events.ok
    ) {
      return { kind: "error" };
    }

    const child = members.data.find((member) => member.id === childId);
    if (!child || child.kind !== "child") return { kind: "missing" };
    if (!isMemberColor(child.color)) return { kind: "error" };

    const taken: TakenColor[] = members.data
      .filter((member) => member.id !== childId && isMemberColor(member.color))
      .map((member) => ({
        color: member.color as ChoosableColor,
        by: member.name,
      }));

    const row = profile.data;
    const next = deadlines.data[0];
    const full = events.events.flatMap((event) =>
      event.masked ? [] : [event],
    );

    return {
      kind: "ok",
      data: {
        child: {
          id: child.id,
          name: child.name,
          color: child.color,
          birthDate: birth.data?.birth_date ?? null,
        },
        taken,
        profile: {
          schoolName: row?.school_name ?? null,
          schoolClass: row?.school_class ?? null,
          startsAt: toTimeValue(row?.school_starts_at ?? null),
          endsAt: toTimeValue(row?.school_ends_at ?? null),
          days: row?.school_days ?? [],
          note: row?.school_note ?? null,
          shoeSize: row?.shoe_size ?? null,
          clothingSize: row?.clothing_size ?? null,
          pajamaSize: row?.pajama_size ?? null,
          sizesUpdatedAt: row?.sizes_updated_at ?? null,
        },
        teachers: teachers.data.map((teacher) => ({
          id: teacher.id,
          name: teacher.name,
          subject: teacher.subject,
          phone: teacher.phone,
        })),
        weekEvents: pickWeekEvents(full, childId, now),
        deadline: next ? { title: next.title, dueDate: next.due_date } : null,
        readAt: now,
      },
    };
  } catch {
    return { kind: "error" };
  }
}

export type ChildProfile = {
  status: ChildStatus;
  data: ChildData | null;
  /** The page was loaded, but the last reading failed (no network) */
  offline: boolean;
  /** «Riprova» is reading */
  retrying: boolean;
  /** «Riprova» of the page error and of the offline notice */
  retry: () => Promise<boolean>;
  /** Reads again after a save. Resolves with `false` if the reading failed. */
  reload: () => Promise<boolean>;
};

/**
 * Reads the profile in the browser, so the server HTML carries no data of the
 * child and the page has its own loading and error states.
 */
export function useChildProfile(childId: string): ChildProfile {
  const [status, setStatus] = useState<ChildStatus>("loading");
  const [data, setData] = useState<ChildData | null>(null);
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const loaded = useRef(false);

  const run = useCallback(async (): Promise<boolean> => {
    const mine = ++sequence.current;
    const result = await readChild(childId);
    // A newer reading took over, or the page is gone.
    if (!alive.current || mine !== sequence.current)
      return result.kind === "ok";
    if (result.kind === "ok") {
      loaded.current = true;
      setData(result.data);
      setStatus("ready");
      setOffline(false);
      return true;
    }
    if (loaded.current && result.kind === "error") {
      // Keep what is on screen and say that it may be old.
      setOffline(true);
    } else {
      setStatus(result.kind);
    }
    return false;
  }, [childId]);

  useEffect(() => {
    alive.current = true;
    // Reads once when the page opens.
    const first = () => void run();
    first();
    return () => {
      alive.current = false;
    };
  }, [run]);

  // The network goes away or comes back while the page is open.
  useEffect(() => {
    const goOffline = () => {
      if (loaded.current) setOffline(true);
    };
    const comeBack = () => {
      if (loaded.current) void run();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", comeBack);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", comeBack);
    };
  }, [run]);

  const retry = useCallback(async () => {
    setRetrying(true);
    const ok = await run();
    if (alive.current) setRetrying(false);
    return ok;
  }, [run]);

  return { status, data, offline, retrying, retry, reload: run };
}
