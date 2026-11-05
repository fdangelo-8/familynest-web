"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PersonView } from "./model";
import type { MemberColor } from "@/components/ui/Avatar/Avatar";

export type SearchContext = {
  /**
   * `failed`: the people could not be read; the search still works.
   * Until `ready` or `failed` the people are not known.
   */
  status: "loading" | "ready" | "failed";
  /** In the order of the Nest (adults, children and animals) */
  people: PersonView[];
  /** The member of the signed-in user */
  meId: string | null;
  /**
   * Account of the browser, for the recent searches. Known as soon as the
   * session is read, before the people: the recent searches do not wait.
   */
  userId: string | null;
};

const NO_PEOPLE: PersonView[] = [];
const LOADING: SearchContext = {
  status: "loading",
  people: NO_PEOPLE,
  meId: null,
  userId: null,
};

/**
 * Reads, in the browser, who lives in the Nest and who is looking: the chips
 * of «Persone», the names of «cose di <Nome>» and the avatars of the rows. The
 * frame only carries the names it shows, not the ids the search needs.
 */
export function useSearchContext(): SearchContext {
  const [context, setContext] = useState<SearchContext>(LOADING);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let next: SearchContext;
      let userId: string | null = null;
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user.id ?? null;
        if (!cancelled) setContext((current) => ({ ...current, userId }));
        const [household, mine] = await Promise.all([
          supabase.rpc("current_household_id"),
          userId
            ? supabase
                .from("household_members")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (household.error || !household.data) throw new Error("household");
        const members = await supabase
          .from("household_members")
          .select("id, name, color")
          .eq("household_id", household.data)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });
        if (members.error) throw new Error("members");
        next = {
          status: "ready",
          people: (members.data ?? []).map((member) => ({
            id: member.id,
            name: member.name,
            color: member.color as MemberColor,
          })),
          meId: mine.error ? null : (mine.data?.id ?? null),
          userId,
        };
      } catch {
        next = { status: "failed", people: NO_PEOPLE, meId: null, userId };
      }
      if (!cancelled) setContext(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return context;
}
