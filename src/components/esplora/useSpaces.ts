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
import { getPinToastText } from "@/lib/pin-texts";
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

/**
 * Which people the page reads: "people" = names and colours of children and
 * pets (Esplora), "children" / "pets" = only the names of those (the promise
 * of Crescere / Zampe), "none" = only how many they are. Names reach the
 * browser only where the page needs them.
 */
export type NamesRead = "people" | "children" | "pets" | "none";

type ChildrenOf<N extends NamesRead> = N extends "people"
  ? NestPerson[]
  : N extends "children"
    ? string[]
    : null;
type PetsOf<N extends NamesRead> = N extends "people"
  ? NestPerson[]
  : N extends "pets"
    ? string[]
    : null;

export type SpacesData<N extends NamesRead = "people"> = {
  counts: MemberCounts;
  /** In order of insertion. Never birth dates. `null` = not read. */
  children: ChildrenOf<N>;
  pets: PetsOf<N>;
};

export type SpacesStatus = "loading" | "ready" | "error";

type ReadResult<N extends NamesRead> =
  { ok: true; data: SpacesData<N>; pinned: SpaceKey[] } | { ok: false };

type Client = ReturnType<typeof createClient>;
/** Names (and colours) asked by `names`, in order of insertion. */
async function readNames(supabase: Client, names: NamesRead) {
  const members = supabase.from("household_members");
  if (names === "people") {
    const { data, error } = await members
      .select("name, color, kind")
      .in("kind", ["child", "pet"])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) return null;
    return {
      children: data.filter((m) => m.kind === "child"),
      pets: data.filter((m) => m.kind === "pet"),
    };
  }
  if (names === "none") return { children: [], pets: [] };
  const kind = names === "children" ? "child" : "pet";
  const { data, error } = await members
    .select("name")
    .eq("kind", kind)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) return null;
  const list = data.map((m) => ({ name: m.name }));
  return names === "children"
    ? { children: list, pets: [] }
    : { children: [], pets: list };
}

/** Reads members and my pinned spaces in the browser (RLS applies). */
async function readEverything<N extends NamesRead>(
  names: N,
): Promise<ReadResult<N>> {
  try {
    const supabase = createClient();
    const count = (kind: "adult" | "child" | "pet") =>
      supabase
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind);
    // Adults are only counted: their names never reach the browser.
    const [adults, children, pets, listed, pinned] = await Promise.all([
      count("adult"),
      count("child"),
      count("pet"),
      readNames(supabase, names),
      getPinnedSpaces(supabase),
    ]);
    if (
      adults.error ||
      children.error ||
      pets.error ||
      !listed ||
      pinned.error
    ) {
      return { ok: false };
    }
    const data = {
      counts: {
        adults: adults.count ?? 0,
        children: children.count ?? 0,
        pets: pets.count ?? 0,
      },
      children:
        names === "people"
          ? listed.children
          : names === "children"
            ? listed.children.map((m) => m.name)
            : null,
      pets:
        names === "people"
          ? listed.pets
          : names === "pets"
            ? listed.pets.map((m) => m.name)
            : null,
    };
    // The shape follows `names`, as the types of `SpacesData` say.
    return { ok: true, data: data as SpacesData<N>, pinned: pinned.spaces };
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
export function useSpaces<N extends NamesRead>(
  buttonRefs: RefObject<Map<SpaceKey, { focus: () => void }>>,
  names: N,
) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SpacesStatus>("loading");
  const [data, setData] = useState<SpacesData<N> | null>(null);
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
    (result: ReadResult<N>) => {
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
    void readEverything(names).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, names]);

  /** Tries again; calls `onLoaded` when the page is ready. */
  const retry = useCallback(
    (onLoaded: () => void) => {
      startRetry(async () => {
        const result = await readEverything(names);
        if (apply(result)) onLoaded();
      });
    },
    [apply, names],
  );

  const setSpace = useCallback(
    (key: SpaceKey, on: boolean) => {
      const without = pinnedRef.current.filter((item) => item !== key);
      commitPinned(on ? [...without, key] : without);
    },
    [commitPinned],
  );

  const showLimit = useCallback(
    (key: SpaceKey) => showToast(getPinToastText("limit", nameOf(key))),
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
      showToast(
        getPinToastText(
          wasPinning ? "undo-failed-stays" : "undo-failed-gone",
          nameOf(key),
        ),
      );
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
        showToast(
          getPinToastText(pinning ? "pin-failed" : "unpin-failed", name),
        );
        return;
      }
      showToast({
        ...getPinToastText(pinning ? "pinned" : "unpinned", name),
        onUndo: () => void undo(key, pinning),
      });
    },
    [setSpace, showLimit, showToast, undo],
  );

  return { status, data, pinned, retrying, retry, toggle };
}
