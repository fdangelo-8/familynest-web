"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import {
  byCreation,
  byLastTaken,
  nameKey,
  thingsLabel,
  type ShoppingItem,
  type ShoppingMember,
} from "./model";

type Client = SupabaseClient<Database>;
type ItemRow = Pick<
  Database["public"]["Tables"]["shopping_items"]["Row"],
  | "id"
  | "name"
  | "quantity"
  | "checked_at"
  | "created_at"
  | "added_by_member_id"
>;

export type ListStatus = "loading" | "ready" | "error";

type Op =
  | { type: "add"; tempId: string; name: string; inserted: boolean }
  | {
      type: "check";
      id: string;
      checked: boolean;
      previousCheckedAt: string | null;
    }
  | { type: "clear"; token: number; items: ShoppingItem[] }
  | { type: "restore"; items: ShoppingItem[] };

type OpResult = "done" | "network";

const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
/** Without a working realtime channel the list is re-read this often. */
const FALLBACK_POLL_MS = 4000;
const REFETCH_DELAY_MS = 120;
const DEFAULT_SETTLE_MS = 600;

/** A failed request with no database code never reached the server. */
function isNetworkError(error: { code?: string | null }): boolean {
  return !error.code;
}

function readSettleMs(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--durata-ampia")
    .trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return DEFAULT_SETTLE_MS;
  return raw.endsWith("ms") ? value : value * 1000;
}

function toItem(row: ItemRow, keys: Map<string, string>): ShoppingItem {
  return {
    key: keys.get(row.id) ?? row.id,
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
    authorId: row.added_by_member_id,
  };
}

type Identity = { householdId: string; meMemberId: string | null };

/** Which Nest the signed-in user is in, and which member they are. */
async function readIdentity(supabase: Client): Promise<Identity | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const [household, member] = await Promise.all([
    supabase.rpc("current_household_id"),
    supabase
      .from("household_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (household.error || !household.data || member.error) return null;
  return { householdId: household.data, meMemberId: member.data?.id ?? null };
}

type ReadResult =
  | { kind: "ok"; rows: ItemRow[]; members: ShoppingMember[] }
  | { kind: "network" }
  | { kind: "error" };

async function readEverything(
  supabase: Client,
  householdId: string,
): Promise<ReadResult> {
  const [itemsResult, membersResult] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, quantity, checked_at, created_at, added_by_member_id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("household_members")
      .select("id, name, color, kind")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  const failure = itemsResult.error ?? membersResult.error;
  if (failure) {
    return isNetworkError(failure) ? { kind: "network" } : { kind: "error" };
  }
  return {
    kind: "ok",
    rows: itemsResult.data ?? [],
    members: membersResult.data ?? [],
  };
}

export type ShoppingList = {
  status: ListStatus;
  items: ShoppingItem[];
  members: ShoppingMember[];
  /** The member of the signed-in user */
  meMemberId: string | null;
  /** Keys of the rows that were just toggled and wait before changing list */
  settling: ReadonlySet<string>;
  /** The browser is offline or a request did not reach the server */
  offline: boolean;
  retrying: boolean;
  /** Text for the polite live region */
  announcement: string;
  addItem: (name: string) => void;
  toggleItem: (key: string) => void;
  tear: (fromKeyboard: boolean) => void;
  retry: () => void;
  /** After the next render, focuses the first of these selectors that exists */
  requestFocus: (selectors: string[]) => void;
};

/**
 * Reads the shopping list of the Nest, keeps it up to date (realtime) and
 * sends the changes. Changes show at once and wait in a queue (in memory)
 * while the connection is down.
 */
export function useShoppingList({
  rootRef,
  onAddRejected,
}: {
  /** The page element: focus requests look for their target inside it */
  rootRef: RefObject<HTMLElement | null>;
  /** The server refused a new thing: gives back its text for the field */
  onAddRejected: (name: string) => void;
}): ShoppingList {
  const { showToast } = useToast();
  const [status, setStatus] = useState<ListStatus>("loading");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [meMemberId, setMeMemberId] = useState<string | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const [items, setItemsState] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<ShoppingMember[]>([]);
  const [settling, setSettlingState] = useState<ReadonlySet<string>>(new Set());
  const [networkDown, setNetworkDown] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const clientRef = useRef<Client | null>(null);
  const itemsRef = useRef<ShoppingItem[]>([]);
  const settlingRef = useRef<Set<string>>(new Set());
  const settleTimers = useRef(new Map<string, number>());
  const queueRef = useRef<Op[]>([]);
  const inFlightRef = useRef<Op | null>(null);
  const processingRef = useRef(false);
  const idMapRef = useRef(new Map<string, string>());
  const mutationRef = useRef(0);
  const fetchSeqRef = useRef(0);
  const dirtyRef = useRef(false);
  const refetchTimer = useRef<number | undefined>(undefined);
  const tempCounter = useRef(0);
  const tearToken = useRef(0);
  const focusRequest = useRef<string[] | null>(null);
  const onAddRejectedRef = useRef(onAddRejected);

  useEffect(() => {
    onAddRejectedRef.current = onAddRejected;
  }, [onAddRejected]);

  const getClient = useCallback((): Client => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  const setItems = useCallback(
    (update: (current: ShoppingItem[]) => ShoppingItem[]) => {
      itemsRef.current = update(itemsRef.current);
      setItemsState(itemsRef.current);
    },
    [],
  );

  const setSettling = useCallback((update: (set: Set<string>) => void) => {
    const next = new Set(settlingRef.current);
    update(next);
    settlingRef.current = next;
    setSettlingState(next);
  }, []);

  const requestFocus = useCallback((selectors: string[]) => {
    focusRequest.current = selectors;
  }, []);

  // Moves the focus after the render that follows a change (rows change list).
  useLayoutEffect(() => {
    const selectors = focusRequest.current;
    const root = rootRef.current;
    if (!selectors || !root) return;
    for (const selector of selectors) {
      const target = root.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        break;
      }
    }
    focusRequest.current = null;
  });

  const toastRejected = useCallback(() => {
    showToast({ text: SAVE_FAILED, icon: null });
  }, [showToast]);

  /** Server truth replaces the local list, keeping the React keys. */
  const applyRead = useCallback(
    (rows: ItemRow[], nextMembers: ShoppingMember[]) => {
      const keys = new Map<string, string>();
      for (const item of itemsRef.current) keys.set(item.id, item.key);
      // Remember what had the focus: a change by someone else can remove it.
      const active = document.activeElement;
      const root = rootRef.current;
      if (root && active && root.contains(active)) {
        const row = active.closest<HTMLElement>("[data-item-key]");
        const chip = active.closest<HTMLElement>("[data-chip]");
        const headings = [
          '[data-focus="to-take-heading"]',
          '[data-focus="common-heading"]',
        ];
        if (row?.dataset.itemKey) {
          const inTaken = row.closest('[data-testid="spesa-presi"]');
          focusRequest.current = [
            `[data-item-key="${CSS.escape(row.dataset.itemKey)}"] [role="checkbox"]`,
            ...(inTaken ? ['[data-testid="spesa-presi"] h3'] : []),
            ...headings,
          ];
        } else if (chip?.dataset.chip) {
          focusRequest.current = [
            `[data-chip="${CSS.escape(chip.dataset.chip)}"]`,
            '[data-focus="common-heading"]',
            '[data-focus="to-take-heading"]',
          ];
        }
      }
      setItems(() => rows.map((row) => toItem(row, keys)));
      setMembers(nextMembers);
    },
    [rootRef, setItems],
  );

  const queueIsBusy = useCallback(
    () => queueRef.current.length > 0 || processingRef.current,
    [],
  );

  const refetch = useCallback(async () => {
    if (queueIsBusy()) {
      dirtyRef.current = true;
      return;
    }
    const identity = identityRef.current;
    if (!identity) return;
    const supabase = getClient();
    const mutation = mutationRef.current;
    const seq = ++fetchSeqRef.current;
    const result = await readEverything(supabase, identity.householdId);
    if (seq !== fetchSeqRef.current) return;
    if (result.kind === "network") {
      setNetworkDown(true);
      return;
    }
    if (result.kind === "error") return;
    // Something changed while reading: this read is already old.
    if (mutation !== mutationRef.current || queueIsBusy()) {
      dirtyRef.current = true;
      return;
    }
    setNetworkDown(false);
    applyRead(result.rows, result.members);
  }, [applyRead, getClient, queueIsBusy]);

  const scheduleRefetch = useCallback(() => {
    window.clearTimeout(refetchTimer.current);
    refetchTimer.current = window.setTimeout(() => {
      void refetch();
    }, REFETCH_DELAY_MS);
  }, [refetch]);

  const resolveId = useCallback((id: string): string | null => {
    const mapped = idMapRef.current.get(id) ?? id;
    return mapped.startsWith("tmp-") ? null : mapped;
  }, []);

  const runOp = useCallback(
    async (op: Op): Promise<OpResult> => {
      const supabase = getClient();

      if (op.type === "add") {
        if (!op.inserted) {
          const { error } = await supabase
            .from("shopping_items")
            .insert({ name: op.name });
          if (error) {
            if (isNetworkError(error)) return "network";
            setItems((current) => current.filter((i) => i.id !== op.tempId));
            if (error.code === "23505") {
              // Someone else added the same thing a moment ago.
              showToast({ lead: op.name, text: "è già in lista.", icon: null });
            } else {
              toastRejected();
              onAddRejectedRef.current(op.name);
            }
            dirtyRef.current = true;
            return "done";
          }
          op.inserted = true;
        }
        // The new row's id is the database's: read it back (no select after write).
        const identity = identityRef.current;
        if (!identity) return "done";
        const read = await readEverything(supabase, identity.householdId);
        if (read.kind === "network") return "network";
        if (read.kind === "error") return "done";
        const known = new Set(itemsRef.current.map((i) => i.id));
        const match = read.rows
          .filter(
            (row) =>
              !known.has(row.id) &&
              row.checked_at === null &&
              nameKey(row.name) === nameKey(op.name),
          )
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
        if (match) {
          idMapRef.current.set(op.tempId, match.id);
          setItems((current) =>
            current.map((item) =>
              item.id === op.tempId
                ? { ...item, id: match.id, createdAt: match.created_at }
                : item,
            ),
          );
        }
        return "done";
      }

      if (op.type === "check") {
        const id = resolveId(op.id);
        if (!id) return "done";
        const { error } = await supabase
          .from("shopping_items")
          .update({ checked_at: op.checked ? new Date().toISOString() : null })
          .eq("id", id);
        if (error) {
          if (isNetworkError(error)) return "network";
          setItems((current) =>
            current.map((item) =>
              item.id === op.id || item.id === id
                ? { ...item, checkedAt: op.previousCheckedAt }
                : item,
            ),
          );
          toastRejected();
          dirtyRef.current = true;
        }
        return "done";
      }

      if (op.type === "clear") {
        const ids = op.items
          .map((item) => resolveId(item.id))
          .filter((id): id is string => id !== null);
        if (ids.length === 0) return "done";
        const { error } = await supabase.rpc("clear_checked_shopping_items", {
          item_ids: ids,
        });
        if (error) {
          if (isNetworkError(error)) return "network";
          setItems((current) => mergeBack(current, op.items));
          toastRejected();
          dirtyRef.current = true;
        }
        return "done";
      }

      // restore
      const ids = op.items
        .map((item) => resolveId(item.id))
        .filter((id): id is string => id !== null);
      if (ids.length === 0) return "done";
      const { error } = await supabase.rpc("restore_shopping_items", {
        item_ids: ids,
      });
      if (error) {
        if (isNetworkError(error)) return "network";
        const keys = new Set(op.items.map((item) => item.key));
        setItems((current) => current.filter((item) => !keys.has(item.key)));
        toastRejected();
        dirtyRef.current = true;
      }
      return "done";
    },
    [getClient, resolveId, setItems, showToast, toastRejected],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    let blocked = false;
    let ran = false;
    try {
      for (;;) {
        const op = queueRef.current[0];
        if (!op) break;
        inFlightRef.current = op;
        ran = true;
        const result = await runOp(op);
        inFlightRef.current = null;
        if (result === "network") {
          blocked = true;
          break;
        }
        queueRef.current.shift();
      }
    } finally {
      inFlightRef.current = null;
      processingRef.current = false;
    }
    if (blocked) {
      setNetworkDown(true);
      return;
    }
    if (ran) setNetworkDown(false);
    if (dirtyRef.current) {
      dirtyRef.current = false;
      void refetch();
    }
  }, [refetch, runOp]);

  const enqueue = useCallback(
    (op: Op) => {
      mutationRef.current += 1;
      queueRef.current.push(op);
      void processQueue();
    },
    [processQueue],
  );

  // First read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getClient();
      const identity = await readIdentity(supabase);
      if (cancelled) return;
      if (!identity) {
        setStatus("error");
        return;
      }
      const result = await readEverything(supabase, identity.householdId);
      if (cancelled) return;
      if (result.kind !== "ok") {
        setStatus("error");
        return;
      }
      identityRef.current = identity;
      setHouseholdId(identity.householdId);
      setMeMemberId(identity.meMemberId);
      applyRead(result.rows, result.members);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRead, getClient]);

  // Browser connection.
  useEffect(() => {
    const update = () => setBrowserOffline(!navigator.onLine);
    const handleOnline = () => {
      update();
      void processQueue();
      void refetch();
    };
    update();
    window.addEventListener("offline", update);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", handleOnline);
    };
  }, [processQueue, refetch]);

  // Realtime: other members' changes arrive without reloading.
  useEffect(() => {
    if (status !== "ready" || !householdId) return;
    const supabase = getClient();
    let closed = false;
    let subscribedBefore = false;
    let channel: ReturnType<Client["channel"]> | null = null;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (closed) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`shopping-items-${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "shopping_items",
            filter: `household_id=eq.${householdId}`,
          },
          scheduleRefetch,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "shopping_items",
            filter: `household_id=eq.${householdId}`,
          },
          scheduleRefetch,
        )
        .on(
          // Deletions cannot be filtered by Nest: they arrive with the bare id,
          // also from other Nests. The unknown ids are ignored.
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "shopping_items" },
          (payload) => {
            const id = (payload.old as { id?: string }).id;
            if (id && itemsRef.current.some((item) => item.id === id)) {
              scheduleRefetch();
            }
          },
        )
        .subscribe((state) => {
          const connected = state === "SUBSCRIBED";
          setRealtimeOk(connected);
          // Events missed while the channel was down are not sent again.
          if (connected && subscribedBefore) scheduleRefetch();
          if (connected) subscribedBefore = true;
        });
    })();
    return () => {
      closed = true;
      window.clearTimeout(refetchTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [getClient, householdId, scheduleRefetch, status]);

  // Back on screen (after a sleep timers and sockets may have been stopped).
  useEffect(() => {
    if (status !== "ready") return;
    const handleVisible = () => {
      if (document.visibilityState === "visible") scheduleRefetch();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [scheduleRefetch, status]);

  // Safety net: no realtime channel -> read again every few seconds.
  useEffect(() => {
    if (status !== "ready" || realtimeOk) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, FALLBACK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [realtimeOk, refetch, status]);

  // While the connection is down the queue is tried again by itself.
  useEffect(() => {
    if (!networkDown) return;
    const timer = window.setInterval(() => {
      if (queueRef.current.length > 0) void processQueue();
      else void refetch();
    }, FALLBACK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [networkDown, processQueue, refetch]);

  useEffect(() => {
    const timers = settleTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  const addItem = useCallback(
    (name: string) => {
      const existing = itemsRef.current.find(
        (item) =>
          item.checkedAt === null && nameKey(item.name) === nameKey(name),
      );
      if (existing) {
        showToast({ lead: existing.name, text: "è già in lista.", icon: null });
        return;
      }
      tempCounter.current += 1;
      const tempId = `tmp-${tempCounter.current}`;
      setItems((current) => [
        ...current,
        {
          key: tempId,
          id: tempId,
          name,
          quantity: null,
          checkedAt: null,
          createdAt: new Date().toISOString(),
          authorId: identityRef.current?.meMemberId ?? null,
        },
      ]);
      setAnnouncement(`Aggiunto: ${name}`);
      enqueue({ type: "add", tempId, name, inserted: false });
    },
    [enqueue, setItems, showToast],
  );

  const toggleItem = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((i) => i.key === key);
      if (!item) return;
      const checked = item.checkedAt === null;
      const rowHadFocus = rootRef.current
        ?.querySelector(`[data-item-key="${key}"] [role="checkbox"]`)
        ?.contains(document.activeElement);

      const running = settleTimers.current.get(key);
      if (running !== undefined) {
        // A second tap while waiting cancels the move.
        window.clearTimeout(running);
        settleTimers.current.delete(key);
        setSettling((set) => set.delete(key));
      } else {
        setSettling((set) => set.add(key));
        const timer = window.setTimeout(() => {
          settleTimers.current.delete(key);
          if (rowHadFocus) {
            requestFocus([`[data-item-key="${key}"] [role="checkbox"]`]);
          }
          setSettling((set) => set.delete(key));
        }, readSettleMs());
        settleTimers.current.set(key, timer);
      }

      setItems((current) =>
        current.map((i) =>
          i.key === key
            ? { ...i, checkedAt: checked ? new Date().toISOString() : null }
            : i,
        ),
      );
      enqueue({
        type: "check",
        id: item.id,
        checked,
        previousCheckedAt: item.checkedAt,
      });
    },
    [enqueue, requestFocus, rootRef, setItems, setSettling],
  );

  const retry = useCallback(() => {
    setRetrying(true);
    void (async () => {
      await processQueue();
      if (queueRef.current.length === 0) await refetch();
      setRetrying(false);
    })();
  }, [processQueue, refetch]);

  const tear = useCallback(
    (fromKeyboard: boolean) => {
      // Only what the list shows as taken (and is really taken) goes away.
      const removed = itemsRef.current
        .filter(
          (item) =>
            item.checkedAt !== null && !settlingRef.current.has(item.key),
        )
        .sort(byLastTaken);
      if (removed.length === 0) return;
      const removedKeys = new Set(removed.map((item) => item.key));
      const token = ++tearToken.current;
      setItems((current) =>
        current.filter((item) => !removedKeys.has(item.key)),
      );
      enqueue({ type: "clear", token, items: removed });

      const undo = () => {
        const queue = queueRef.current;
        const index = queue.findIndex(
          (op) => op.type === "clear" && op.token === token,
        );
        if (index >= 0 && queue[index] !== inFlightRef.current) {
          // Not sent yet: nothing to take back from the server.
          queue.splice(index, 1);
          mutationRef.current += 1;
        } else {
          enqueue({ type: "restore", items: removed });
        }
        setItems((current) => mergeBack(current, removed));
        requestFocus([".strappo__lama"]);
      };

      showToast({
        lead: thingsLabel(removed.length),
        text:
          removed.length === 1 ? "tolta dalla lista." : "tolte dalla lista.",
        icon: "scissors",
        onUndo: undo,
      });

      if (fromKeyboard) {
        // The toast stays while it has the focus: the keyboard goes to "Annulla".
        window.setTimeout(() => {
          document.querySelector<HTMLElement>(".toast__azione")?.focus();
        }, 0);
      } else {
        requestFocus([
          '[data-focus="to-take-heading"]',
          '[data-focus="common-heading"]',
          ".campo-rapido__input",
        ]);
      }
    },
    [enqueue, requestFocus, setItems, showToast],
  );

  return {
    status,
    items,
    members,
    meMemberId,
    settling,
    offline: networkDown || browserOffline,
    retrying,
    announcement,
    addItem,
    toggleItem,
    tear,
    retry,
    requestFocus,
  };
}

/** Puts back items that are not in the list (by key), without duplicates. */
function mergeBack(
  current: ShoppingItem[],
  back: ShoppingItem[],
): ShoppingItem[] {
  const present = new Set(current.map((item) => item.key));
  const missing = back.filter((item) => !present.has(item.key));
  return missing.length === 0
    ? current
    : [...current, ...missing].sort(byCreation);
}
