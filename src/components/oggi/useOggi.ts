"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { isNetworkError } from "@/components/casa-spesa/useShoppingList";
import {
  subscribeListsChanged,
  type ListKind,
} from "@/components/aggiungi/coordination";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { subscribeEventsChanged } from "@/lib/events-changed";
import { createClient } from "@/lib/supabase/client";
import type { MemberWelcome } from "@/lib/welcome";
import type { KeyedEvent } from "@/components/calendario/model";
import type { SpaceKey } from "@/lib/spaces";
import {
  readHouse,
  readOggi,
  type Client,
  type House,
  type Household,
  type InviteEntry,
  type OpenTodo,
  type People,
} from "./read";

/** What the page keeps of its readings: the last good value of every part. */
export type OggiData = {
  people: People | null;
  events: KeyedEvent[] | null;
  todos: OpenTodo[] | null;
  house: House | null;
  household: Household | null;
  invites: InviteEntry[] | null;
  pinned: SpaceKey[] | null;
  welcome: MemberWelcome | null;
};

/** Parts that failed and have never been read: their section shows the error. */
export type OggiFailed = {
  people: boolean;
  events: boolean;
  todos: boolean;
  house: boolean;
};

/** A thing to do ticked here: crossed out while its toast is on screen. */
export type DoneEntry = { todo: OpenTodo; barred: boolean };

type Op = { id: string; doneAt: string | null };

const EMPTY_DATA: OggiData = {
  people: null,
  events: null,
  todos: null,
  house: null,
  household: null,
  invites: null,
  pinned: null,
  welcome: null,
};
const NOT_FAILED: OggiFailed = {
  people: false,
  events: false,
  todos: false,
  house: false,
};
const NO_DONE: ReadonlyMap<string, DoneEntry> = new Map();

const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
const TODO_GONE = "Questa cosa da fare non c'è più.";
/** While a read or a write does not get through, it is tried again this often. */
const RETRY_MS = 4000;
const REFETCH_DELAY_MS = 120;

export type Oggi = {
  /** `loading` until the first reading is over */
  phase: "loading" | "ready";
  data: OggiData;
  failed: OggiFailed;
  /** The whole page could not be read */
  pageError: boolean;
  /** The browser is offline, or a reading or a writing did not get through */
  offline: boolean;
  /** Epoch ms of the last reading that worked */
  lastOkAt: number;
  /** Epoch ms of the last reading of the numbers of the house */
  houseAt: number;
  retrying: boolean;
  retry: () => void;
  /** Things ticked here, by id */
  done: ReadonlyMap<string, DoneEntry>;
  toggleTodo: (id: string) => void;
};

/**
 * Reads everything Oggi shows (impegni, da fare, casa, lista di partenza,
 * spazi), keeps it as it was when a reading fails, ticks the things to do
 * (they show at once and wait in a queue while the connection is down) and
 * follows the shopping list in real time. The rest is read again when
 * someone saves from Aggiungi, when the connection comes back, with
 * «Riprova» and after midnight.
 */
export function useOggi(
  todayKey: string,
  rootRef: RefObject<HTMLElement | null>,
): Oggi {
  const { showToast, hideToast } = useToast();
  const [data, setData] = useState<OggiData>(EMPTY_DATA);
  const [failed, setFailed] = useState<OggiFailed>(NOT_FAILED);
  const [stale, setStale] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [lastOkAt, setLastOkAt] = useState(0);
  const [houseAt, setHouseAt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [networkDown, setNetworkDown] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [done, setDoneState] =
    useState<ReadonlyMap<string, DoneEntry>>(NO_DONE);

  const dataRef = useRef<OggiData>(EMPTY_DATA);
  const doneRef = useRef<ReadonlyMap<string, DoneEntry>>(NO_DONE);
  const clientRef = useRef<Client | null>(null);
  const todayKeyRef = useRef(todayKey);
  const sequence = useRef(0);
  const queueRef = useRef<Op[]>([]);
  const processingRef = useRef(false);
  const dirtyRef = useRef(false);
  const waits = useRef(new Map<string, { cancel: () => void }>());
  const focusRequest = useRef<{ ids: string[]; heading: boolean } | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const processRef = useRef<() => Promise<void>>(async () => {});
  const refetchTimer = useRef<number | undefined>(undefined);

  const getClient = useCallback((): Client => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  const setDone = useCallback(
    (
      update: (
        current: ReadonlyMap<string, DoneEntry>,
      ) => ReadonlyMap<string, DoneEntry>,
    ) => {
      doneRef.current = update(doneRef.current);
      setDoneState(doneRef.current);
    },
    [],
  );

  const queueBusy = useCallback(
    () => queueRef.current.length > 0 || processingRef.current,
    [],
  );

  /* ---------- Reading ---------- */

  const refresh = useCallback(async (): Promise<void> => {
    if (queueBusy()) {
      // Something is being written: this reading would show it undone.
      dirtyRef.current = true;
      return;
    }
    const mine = ++sequence.current;
    const before = dataRef.current;
    const needsWelcome =
      before.welcome === null || before.welcome.status === "error";
    const result = await readOggi(
      getClient(),
      todayKeyRef.current,
      needsWelcome,
    );
    // A newer reading wins; a write that started meanwhile makes this one old.
    if (mine !== sequence.current) return;
    if (queueBusy()) {
      dirtyRef.current = true;
      return;
    }

    const next: OggiData = {
      people: result.people ?? before.people,
      events: result.events ?? before.events,
      todos: result.todos ?? before.todos,
      house: result.house ?? before.house,
      household: result.household ?? before.household,
      invites: result.invites ?? before.invites,
      pinned: result.pinned ?? before.pinned,
      welcome: result.welcome ?? before.welcome,
    };
    const nextFailed: OggiFailed = { ...NOT_FAILED };
    let anyStale = false;
    for (const part of ["people", "events", "todos", "house"] as const) {
      if (result[part] !== null) continue;
      if (before[part] !== null) anyStale = true;
      else nextFailed[part] = true;
    }

    dataRef.current = next;
    setData(next);
    setFailed(nextFailed);
    setStale(anyStale);
    if (!anyStale) setLastOkAt(Date.now());
    if (result.house) setHouseAt(Date.now());
    // What was ticked here is now in the database: only the rows that still
    // wait for their toast stay apart.
    setDone((current) => {
      const waiting = new Map<string, DoneEntry>();
      for (const [id, entry] of current) {
        if (entry.barred) waiting.set(id, entry);
      }
      return waiting;
    });
    setPhase("ready");
  }, [getClient, queueBusy, setDone]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // First reading, and again when the day changes.
  useEffect(() => {
    todayKeyRef.current = todayKey;
    void refresh();
  }, [refresh, todayKey]);

  /* ---------- Focus after a row leaves ---------- */

  useLayoutEffect(() => {
    const request = focusRequest.current;
    const root = rootRef.current;
    if (!request || !root) return;
    focusRequest.current = null;
    const visible = (elements: HTMLElement[]) =>
      elements.find((element) => element.getClientRects().length > 0);
    for (const id of request.ids) {
      const target = visible(
        Array.from(
          root.querySelectorAll<HTMLElement>(
            `[data-todo-id="${CSS.escape(id)}"] [role="checkbox"]`,
          ),
        ),
      );
      if (target) {
        target.focus();
        return;
      }
    }
    if (request.heading) {
      const heading = visible(
        Array.from(
          root.querySelectorAll<HTMLElement>("[data-focus='todo-heading']"),
        ),
      );
      if (heading) {
        heading.focus();
        return;
      }
    }
    visible(Array.from(root.querySelectorAll<HTMLElement>("h1")))?.focus();
  });

  /* ---------- Ticking things to do ---------- */

  /** The write was refused or the thing is gone: the row goes back or leaves. */
  const rejected = useCallback(
    async (op: Op): Promise<void> => {
      dirtyRef.current = true;
      let exists = true;
      try {
        const { data: row, error } = await getClient()
          .from("todos")
          .select("id")
          .eq("id", op.id)
          .maybeSingle();
        if (!error && row === null) exists = false;
      } catch {
        exists = true;
      }
      const running = waits.current.get(op.id);
      running?.cancel();
      waits.current.delete(op.id);
      if (!exists) {
        // Someone else removed it: it leaves for good.
        const todos = dataRef.current.todos;
        if (todos) {
          dataRef.current = {
            ...dataRef.current,
            todos: todos.filter((todo) => todo.id !== op.id),
          };
          setData(dataRef.current);
        }
        setDone((current) => {
          const next = new Map(current);
          next.delete(op.id);
          return next;
        });
        showToast({ text: TODO_GONE, icon: null });
        return;
      }
      setDone((current) => {
        const next = new Map(current);
        next.delete(op.id);
        return next;
      });
      showToast({ text: SAVE_FAILED, icon: null });
    },
    [getClient, setDone, showToast],
  );

  const runOp = useCallback(
    async (op: Op): Promise<"done" | "network"> => {
      let error: { code?: string | null } | null = null;
      let count: number | null = null;
      try {
        const result = await getClient()
          .from("todos")
          .update({ done_at: op.doneAt }, { count: "exact" })
          .eq("id", op.id);
        error = result.error;
        count = result.count;
      } catch {
        return "network";
      }
      if (error) {
        if (isNetworkError(error)) return "network";
        await rejected(op);
        return "done";
      }
      if (count === 0) await rejected(op);
      return "done";
    },
    [getClient, rejected],
  );

  const processQueue = useCallback(async (): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;
    let blocked = false;
    let ran = false;
    try {
      for (;;) {
        const op = queueRef.current[0];
        if (!op) break;
        ran = true;
        const result = await runOp(op);
        if (result === "network") {
          blocked = true;
          break;
        }
        queueRef.current.shift();
      }
    } finally {
      processingRef.current = false;
    }
    if (blocked) {
      setNetworkDown(true);
      return;
    }
    setNetworkDown(false);
    if (ran || dirtyRef.current) {
      dirtyRef.current = false;
      await refreshRef.current();
    }
  }, [runOp]);

  useEffect(() => {
    processRef.current = processQueue;
  }, [processQueue]);

  const enqueue = useCallback(
    (op: Op) => {
      // Reading again while this is written would undo it on screen.
      sequence.current += 1;
      queueRef.current.push(op);
      void processQueue();
    },
    [processQueue],
  );

  /** The row leaves once its toast is gone; the focus moves on. */
  const settle = useCallback(
    (id: string) => {
      waits.current.delete(id);
      const active = document.activeElement;
      const row = active instanceof HTMLElement ? active.closest("li") : null;
      if (
        row?.dataset.todoId === id &&
        active instanceof HTMLElement &&
        active.getAttribute("role") === "checkbox"
      ) {
        const neighbours = [row.nextElementSibling, row.previousElementSibling]
          .map((element) =>
            element instanceof HTMLElement ? element.dataset.todoId : undefined,
          )
          .filter((value): value is string => value !== undefined);
        focusRequest.current = { ids: neighbours, heading: true };
      }
      setDone((current) => {
        const entry = current.get(id);
        if (!entry) return current;
        return new Map(current).set(id, { ...entry, barred: false });
      });
    },
    [setDone],
  );

  const undo = useCallback(
    (id: string) => {
      waits.current.get(id)?.cancel();
      waits.current.delete(id);
      setDone((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
      focusRequest.current = { ids: [id], heading: false };
      enqueue({ id, doneAt: null });
    },
    [enqueue, setDone],
  );

  const toggleTodo = useCallback(
    (id: string) => {
      const entry = doneRef.current.get(id);
      if (entry) {
        // A second tap while it is crossed out: back to open, no second toast.
        if (entry.barred) {
          // First back to open (it cancels the wait), then the toast goes.
          undo(id);
          hideToast();
        }
        return;
      }
      const todo = dataRef.current.todos?.find((item) => item.id === id);
      if (!todo) return;

      let cancelled = false;
      waits.current.set(id, {
        cancel: () => {
          cancelled = true;
        },
      });
      setDone((current) => new Map(current).set(id, { todo, barred: true }));
      enqueue({ id, doneAt: new Date().toISOString() });
      showToast({
        text: "Fatto:",
        emphasis: todo.title,
        onUndo: () => undo(id),
        onClose: () => {
          if (!cancelled) settle(id);
        },
      });
    },
    [enqueue, hideToast, setDone, settle, showToast, undo],
  );

  // A thing ticked here and then taken away must not wait for a toast.
  useEffect(() => {
    const running = waits.current;
    return () => {
      for (const wait of running.values()) wait.cancel();
    };
  }, []);

  /* ---------- Connection ---------- */

  useEffect(() => {
    const sync = () => setBrowserOffline(!navigator.onLine);
    const handleOnline = () => {
      sync();
      void processRef.current();
      void refreshRef.current();
    };
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // While something does not get through, it is tried again by itself.
  useEffect(() => {
    if (!networkDown && !stale) return;
    const timer = window.setInterval(() => {
      if (queueRef.current.length > 0) void processRef.current();
      else void refreshRef.current();
    }, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [networkDown, stale]);

  // Aggiungi saved something: the lists are read again.
  useEffect(() => {
    const reload = () => void refreshRef.current();
    const kinds: ListKind[] = ["todos", "deadlines", "shopping"];
    const stops = kinds.map((kind) => subscribeListsChanged(kind, reload));
    stops.push(subscribeEventsChanged(reload));
    return () => stops.forEach((stop) => stop());
  }, []);

  /* ---------- Shopping list in real time ---------- */

  const householdId = data.people?.householdId ?? null;

  const refetchHouse = useCallback(async () => {
    if (queueBusy()) return;
    let house: House | null = null;
    try {
      house = await readHouse(getClient(), todayKeyRef.current);
    } catch {
      house = null;
    }
    if (!house) return;
    dataRef.current = { ...dataRef.current, house };
    setData(dataRef.current);
    setHouseAt(Date.now());
  }, [getClient, queueBusy]);

  const scheduleRefetchHouse = useCallback(() => {
    window.clearTimeout(refetchTimer.current);
    refetchTimer.current = window.setTimeout(
      () => void refetchHouse(),
      REFETCH_DELAY_MS,
    );
  }, [refetchHouse]);

  useEffect(() => {
    if (phase !== "ready" || !householdId) return;
    const supabase = getClient();
    let closed = false;
    let channel: ReturnType<Client["channel"]> | null = null;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (closed) return;
      if (session.session) {
        supabase.realtime.setAuth(session.session.access_token);
      }
      channel = supabase
        .channel(`oggi-shopping-${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "shopping_items",
            filter: `household_id=eq.${householdId}`,
          },
          scheduleRefetchHouse,
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "shopping_items",
            filter: `household_id=eq.${householdId}`,
          },
          scheduleRefetchHouse,
        )
        .on(
          // Deletions cannot be filtered by Nest: they arrive with the bare id,
          // also from other Nests. The unknown ids are ignored.
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "shopping_items" },
          (payload) => {
            const id = (payload.old as { id?: string }).id;
            if (
              id &&
              dataRef.current.house?.shopping.some((item) => item.id === id)
            ) {
              scheduleRefetchHouse();
            }
          },
        )
        .subscribe((state) => {
          const connected = state === "SUBSCRIBED";
          setRealtimeOk(connected);
          // What happened while the channel was down is not sent again.
          if (connected) scheduleRefetchHouse();
        });
    })();
    return () => {
      closed = true;
      window.clearTimeout(refetchTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [getClient, householdId, phase, scheduleRefetchHouse]);

  // Safety net: without a working channel the numbers are read again.
  useEffect(() => {
    if (phase !== "ready" || realtimeOk) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetchHouse();
    }, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [phase, realtimeOk, refetchHouse]);

  /* ---------- Riprova ---------- */

  const retry = useCallback(() => {
    setRetrying(true);
    void (async () => {
      try {
        await processRef.current();
        await refreshRef.current();
      } finally {
        setRetrying(false);
      }
    })();
  }, []);

  const pageError =
    phase === "ready" &&
    (failed.people || (failed.events && failed.todos && failed.house));

  return {
    phase,
    data,
    failed,
    pageError,
    offline: browserOffline || stale || networkDown,
    lastOkAt,
    houseAt,
    retrying,
    retry,
    done,
    toggleTodo,
  };
}
