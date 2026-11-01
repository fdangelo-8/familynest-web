"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { getPinnedSpaces, pinSpace, unpinSpace } from "@/lib/pinned-spaces";
import {
  countPinnedAvailable,
  isPinLimitError,
  MAX_PINNED_SPACES,
  SPACES,
  type MemberCounts,
  type SpaceKey,
} from "@/lib/spaces";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type NestPerson = {
  name: string;
  color: Database["public"]["Enums"]["member_color"];
};

export type SpacesData = {
  counts: MemberCounts;
  /** Names and colours, in order of insertion. Never birth dates. */
  children: NestPerson[];
  pets: NestPerson[];
};

export type SpacesStatus = "loading" | "ready" | "error";

type ReadResult =
  { ok: true; data: SpacesData; pinned: SpaceKey[] } | { ok: false };

/** Reads members and my pinned spaces in the browser (RLS applies). */
async function readEverything(): Promise<ReadResult> {
  try {
    const supabase = createClient();
    const [people, adults, pinned] = await Promise.all([
      // Only names and colours of children and pets: no birth date.
      supabase
        .from("household_members")
        .select("name, color, kind")
        .in("kind", ["child", "pet"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      // Adults are only counted: their names never reach the browser.
      supabase
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("kind", "adult"),
      getPinnedSpaces(supabase),
    ]);
    if (people.error || adults.error || pinned.error) return { ok: false };
    return {
      ok: true,
      data: {
        counts: {
          adults: adults.count ?? 0,
          children: people.data.filter((m) => m.kind === "child").length,
          pets: people.data.filter((m) => m.kind === "pet").length,
        },
        children: people.data
          .filter((m) => m.kind === "child")
          .map(({ name, color }) => ({ name, color })),
        pets: people.data
          .filter((m) => m.kind === "pet")
          .map(({ name, color }) => ({ name, color })),
      },
      pinned: pinned.spaces,
    };
  } catch {
    return { ok: false };
  }
}

function nameOf(key: SpaceKey): string {
  return SPACES.find((space) => space.key === key)?.name ?? "";
}

/**
 * Loads the Nest members and my pinned spaces, and pins / unpins with an
 * optimistic puntina, a toast with «Annulla» and the limit of six.
 */
export function useSpaces(buttonRefs: RefObject<Map<SpaceKey, HTMLElement>>) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SpacesStatus>("loading");
  const [data, setData] = useState<SpacesData | null>(null);
  const [pinned, setPinned] = useState<SpaceKey[]>([]);
  const [retrying, startRetry] = useTransition();

  // Mirrors for the handlers kept alive by the toast («Annulla»).
  const pinnedRef = useRef<SpaceKey[]>([]);
  const countsRef = useRef<MemberCounts>({ adults: 0, children: 0, pets: 0 });
  // Spaces with a save in progress: a new tap on the same one is ignored.
  const saving = useRef(new Set<SpaceKey>());

  const commitPinned = useCallback((next: SpaceKey[]) => {
    pinnedRef.current = next;
    setPinned(next);
  }, []);

  const apply = useCallback(
    (result: ReadResult) => {
      if (!result.ok) {
        setStatus("error");
        return false;
      }
      countsRef.current = result.data.counts;
      commitPinned(result.pinned);
      setData(result.data);
      setStatus("ready");
      return true;
    },
    [commitPinned],
  );

  useEffect(() => {
    let cancelled = false;
    void readEverything().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  /** Tries again; calls `onLoaded` when the page is ready. */
  const retry = useCallback(
    (onLoaded: () => void) => {
      startRetry(async () => {
        const result = await readEverything();
        if (apply(result)) onLoaded();
      });
    },
    [apply],
  );

  const setSpace = useCallback(
    (key: SpaceKey, on: boolean) => {
      const without = pinnedRef.current.filter((item) => item !== key);
      commitPinned(on ? [...without, key] : without);
    },
    [commitPinned],
  );

  const showLimit = useCallback(
    (key: SpaceKey) =>
      showToast({
        icon: null,
        text: "Puoi fissare al massimo sei spazi: togline uno per fissare",
        emphasis: nameOf(key),
        after: ".",
      }),
    [showToast],
  );

  const focusButton = useCallback(
    (key: SpaceKey) => buttonRefs.current.get(key)?.focus(),
    [buttonRefs],
  );

  /** Saves the opposite of what the user last did, without a second toast. */
  const undo = useCallback(
    async (key: SpaceKey, wasPinning: boolean) => {
      focusButton(key);
      if (saving.current.has(key)) return;
      saving.current.add(key);
      setSpace(key, !wasPinning);
      const { error } = wasPinning
        ? await unpinSpace(createClient(), key)
        : await pinSpace(createClient(), key);
      saving.current.delete(key);
      if (!error) return;
      // The real state is the one saved before «Annulla».
      setSpace(key, wasPinning);
      if (!wasPinning && isPinLimitError(error)) {
        showLimit(key);
        return;
      }
      showToast({
        icon: null,
        text: "Non siamo riusciti ad annullare:",
        emphasis: nameOf(key),
        after: wasPinning ? " resta in Oggi." : " non è più in Oggi.",
      });
    },
    [focusButton, setSpace, showLimit, showToast],
  );

  const toggle = useCallback(
    async (key: SpaceKey) => {
      if (saving.current.has(key)) return;
      const pinning = !pinnedRef.current.includes(key);
      if (
        pinning &&
        countPinnedAvailable(pinnedRef.current, countsRef.current) >=
          MAX_PINNED_SPACES
      ) {
        showLimit(key);
        return;
      }
      saving.current.add(key);
      setSpace(key, pinning);
      const { error } = pinning
        ? await pinSpace(createClient(), key)
        : await unpinSpace(createClient(), key);
      saving.current.delete(key);
      const name = nameOf(key);
      if (error) {
        setSpace(key, !pinning);
        if (pinning && isPinLimitError(error)) {
          showLimit(key);
          return;
        }
        showToast({
          icon: null,
          text: pinning
            ? "Non siamo riusciti a fissare"
            : "Non siamo riusciti a togliere",
          emphasis: name,
          after: ". Riprova tra qualche secondo.",
        });
        return;
      }
      showToast({
        icon: "pin",
        lead: name,
        text: pinning ? "fissato in fondo a Oggi." : "tolto da Oggi.",
        onUndo: () => void undo(key, pinning),
      });
    },
    [setSpace, showLimit, showToast, undo],
  );

  return { status, data, pinned, retrying, retry, toggle };
}
