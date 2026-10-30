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
import {
  isNetworkError,
  readIdentity,
  readSettleMs,
  type Identity,
} from "@/components/casa-spesa/useShoppingList";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import {
  countOpen,
  filterAnnouncement,
  groupTodos,
  type Todo,
  type TodoFilter,
  type TodoMember,
} from "./model";

type Client = SupabaseClient<Database>;
type TodoRow = Pick<
  Database["public"]["Tables"]["todos"]["Row"],
  | "id"
  | "title"
  | "assignee_member_id"
  | "for_member_id"
  | "due_date"
  | "is_private"
  | "done_at"
  | "done_by_member_id"
  | "created_at"
>;

export type TodosStatus = "loading" | "ready" | "error";

type DoneState = Pick<Todo, "doneAt" | "doneSortAt" | "doneById">;

type Op =
  | { type: "add"; tempId: string; title: string; inserted: boolean }
  | { type: "done"; id: string; doneAt: string | null; previous: DoneState };

type OpResult = "done" | "network";

const SAVE_FAILED =
  "Non siamo riusciti a salvare la modifica. Riprova tra qualche secondo.";
/** While the connection is down the queue is tried again this often. */
const RETRY_MS = 4000;
/** How often "now" is read again (the day can change under an open page). */
const CLOCK_MS = 60 * 1000;

function checkboxSelector(key: string): string {
  return `[data-item-key="${CSS.escape(key)}"] [role="checkbox"]`;
}

function toTodo(row: TodoRow, keys: Map<string, string>): Todo {
  return {
    key: keys.get(row.id) ?? row.id,
    id: row.id,
    title: row.title,
    assigneeId: row.assignee_member_id,
    forId: row.for_member_id,
    dueDate: row.due_date,
    isPrivate: row.is_private,
    doneAt: row.done_at,
    doneSortAt: row.done_at,
    doneById: row.done_by_member_id,
    createdAt: row.created_at,
  };
}

type ReadResult =
  | { kind: "ok"; rows: TodoRow[]; members: TodoMember[] }
  | { kind: "network" }
  | { kind: "error" };

const TODO_COLUMNS =
  "id, title, assignee_member_id, for_member_id, due_date, is_private, done_at, done_by_member_id, created_at";

async function readTodoRows(
  supabase: Client,
  householdId: string,
): Promise<
  { kind: "ok"; rows: TodoRow[] } | { kind: "network" } | { kind: "error" }
> {
  const { data, error } = await supabase
    .from("todos")
    .select(TODO_COLUMNS)
    .eq("household_id", householdId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error)
    return isNetworkError(error) ? { kind: "network" } : { kind: "error" };
  return { kind: "ok", rows: data ?? [] };
}

async function readEverything(
  supabase: Client,
  householdId: string,
): Promise<ReadResult> {
  const [todosResult, membersResult] = await Promise.all([
    readTodoRows(supabase, householdId),
    supabase
      .from("household_members")
      .select("id, name, color, kind")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (todosResult.kind !== "ok") return todosResult;
  if (membersResult.error) {
    return isNetworkError(membersResult.error)
      ? { kind: "network" }
      : { kind: "error" };
  }
  return {
    kind: "ok",
    rows: todosResult.rows,
    members: membersResult.data ?? [],
  };
}

export type Todos = {
  status: TodosStatus;
  todos: Todo[];
  members: TodoMember[];
  /** The member of the signed-in user */
  meMemberId: string | null;
  /** Keys of the rows that were just toggled and wait before changing group */
  settling: ReadonlySet<string>;
  /** The Rome day and time the page works with */
  now: Date;
  filter: TodoFilter;
  /** The browser is offline or a request did not reach the server */
  offline: boolean;
  retrying: boolean;
  /** Text for the polite live region */
  announcement: string;
  setFilter: (value: TodoFilter) => void;
  addTodo: (title: string) => void;
  toggleTodo: (key: string) => void;
  retry: () => void;
  /** After the next render, focuses the first of these selectors that is on screen */
  requestFocus: (selectors: string[]) => void;
};

/**
 * Reads the things to do of the Nest and sends the changes. Changes show at
 * once and wait in a queue (in memory) while the connection is down. The list
 * is read when the page opens: what others change shows after a reload.
 */
export function useTodos({
  rootRef,
  onAddRejected,
}: {
  /** The page element: focus requests look for their target inside it */
  rootRef: RefObject<HTMLElement | null>;
  /** The server refused a new thing: gives back its text for the field */
  onAddRejected: (title: string) => void;
}): Todos {
  const { showToast, hideToast } = useToast();
  const [status, setStatus] = useState<TodosStatus>("loading");
  const [meMemberId, setMeMemberId] = useState<string | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const [todos, setTodosState] = useState<Todo[]>([]);
  const [members, setMembers] = useState<TodoMember[]>([]);
  const [settling, setSettlingState] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilterState] = useState<TodoFilter>("all");
  const [networkDown, setNetworkDown] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Counts the retries of the first read (only this list is read again).
  const [attempt, setAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const clientRef = useRef<Client | null>(null);
  const todosRef = useRef<Todo[]>([]);
  const membersRef = useRef<TodoMember[]>([]);
  const settlingRef = useRef<Set<string>>(new Set());
  const settleStops = useRef(
    new Map<string, { kind: "done" | "undone"; stop: () => void }>(),
  );
  const queueRef = useRef<Op[]>([]);
  const processingRef = useRef(false);
  const idMapRef = useRef(new Map<string, string>());
  const mutationRef = useRef(0);
  const fetchSeqRef = useRef(0);
  const dirtyRef = useRef(false);
  const tempCounter = useRef(0);
  const focusRequest = useRef<string[] | null>(null);
  const onAddRejectedRef = useRef(onAddRejected);
  const toggleRef = useRef<(key: string) => void>(() => {});

  useEffect(() => {
    onAddRejectedRef.current = onAddRejected;
  }, [onAddRejected]);

  const getClient = useCallback((): Client => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  const setTodos = useCallback((update: (current: Todo[]) => Todo[]) => {
    todosRef.current = update(todosRef.current);
    setTodosState(todosRef.current);
  }, []);

  const setSettling = useCallback((update: (set: Set<string>) => void) => {
    const next = new Set(settlingRef.current);
    update(next);
    settlingRef.current = next;
    setSettlingState(next);
  }, []);

  const requestFocus = useCallback((selectors: string[]) => {
    focusRequest.current = selectors;
  }, []);

  // Moves the focus after the render that follows a change (rows change group).
  useLayoutEffect(() => {
    const selectors = focusRequest.current;
    const root = rootRef.current;
    if (!selectors || !root) return;
    for (const selector of selectors) {
      const target = Array.from(
        root.querySelectorAll<HTMLElement>(selector),
      ).find((element) => element.getClientRects().length > 0);
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
    (rows: TodoRow[], nextMembers: TodoMember[]) => {
      const keys = new Map<string, string>();
      for (const todo of todosRef.current) keys.set(todo.id, todo.key);
      // Remember what had the focus: a change by someone else can remove it.
      const active = document.activeElement;
      const root = rootRef.current;
      if (root && active && root.contains(active)) {
        const row = active.closest<HTMLElement>("[data-item-key]");
        if (row?.dataset.itemKey) {
          focusRequest.current = [
            checkboxSelector(row.dataset.itemKey),
            "[data-focus='todo-heading']",
          ];
        }
      }
      setTodos(() => rows.map((row) => toTodo(row, keys)));
      membersRef.current = nextMembers;
      setMembers(nextMembers);
      setNow(new Date());
    },
    [rootRef, setTodos],
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
    const mutation = mutationRef.current;
    const seq = ++fetchSeqRef.current;
    const result = await readEverything(getClient(), identity.householdId);
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

  const resolveId = useCallback((id: string): string | null => {
    const mapped = idMapRef.current.get(id) ?? id;
    return mapped.startsWith("tmp-") ? null : mapped;
  }, []);

  /** A rejected change: the row goes back at once, no waiting in the wrong group. */
  const stopSettling = useCallback(
    (key: string) => {
      const running = settleStops.current.get(key);
      if (!running) return;
      running.stop();
      settleStops.current.delete(key);
      setSettling((set) => set.delete(key));
    },
    [setSettling],
  );

  const runOp = useCallback(
    async (op: Op): Promise<OpResult> => {
      const supabase = getClient();

      if (op.type === "add") {
        if (!op.inserted) {
          const { error } = await supabase
            .from("todos")
            .insert({ title: op.title });
          if (error) {
            if (isNetworkError(error)) return "network";
            setTodos((current) => current.filter((t) => t.id !== op.tempId));
            toastRejected();
            onAddRejectedRef.current(op.title);
            dirtyRef.current = true;
            return "done";
          }
          op.inserted = true;
        }
        // The new row's id is the database's: read it back (no select after write).
        const identity = identityRef.current;
        if (!identity) return "done";
        const read = await readTodoRows(supabase, identity.householdId);
        if (read.kind === "network") return "network";
        if (read.kind === "error") return "done";
        const known = new Set(todosRef.current.map((t) => t.id));
        const match = read.rows
          .filter(
            (row) =>
              !known.has(row.id) &&
              row.done_at === null &&
              row.title === op.title,
          )
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
        if (match) {
          idMapRef.current.set(op.tempId, match.id);
          setTodos((current) =>
            current.map((todo) =>
              todo.id === op.tempId
                ? { ...todo, id: match.id, createdAt: match.created_at }
                : todo,
            ),
          );
        }
        return "done";
      }

      const id = resolveId(op.id);
      if (!id) return "done";
      const { error } = await supabase
        .from("todos")
        .update({ done_at: op.doneAt })
        .eq("id", id);
      if (error) {
        if (isNetworkError(error)) return "network";
        for (const todo of todosRef.current) {
          if (todo.id === op.id || todo.id === id) stopSettling(todo.key);
        }
        setTodos((current) =>
          current.map((todo) =>
            todo.id === op.id || todo.id === id
              ? { ...todo, ...op.previous }
              : todo,
          ),
        );
        toastRejected();
        dirtyRef.current = true;
      }
      return "done";
    },
    [getClient, resolveId, setTodos, stopSettling, toastRejected],
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
        setRetrying(false);
        return;
      }
      const result = await readEverything(supabase, identity.householdId);
      if (cancelled) return;
      if (result.kind !== "ok") {
        setStatus("error");
        setRetrying(false);
        return;
      }
      identityRef.current = identity;
      setMeMemberId(identity.meMemberId);
      applyRead(result.rows, result.members);
      setStatus("ready");
      setRetrying(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRead, getClient, attempt]);

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

  // While the connection is down the queue is tried again by itself.
  useEffect(() => {
    if (!networkDown) return;
    const timer = window.setInterval(() => {
      if (queueRef.current.length > 0) void processQueue();
      else void refetch();
    }, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [networkDown, processQueue, refetch]);

  // The day can change while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // The waits of the rows end with the page.
  useEffect(() => {
    const stops = settleStops.current;
    return () => {
      for (const running of stops.values()) running.stop();
    };
  }, []);

  const setFilter = useCallback(
    (value: TodoFilter) => {
      if (value === filter) return;
      setFilterState(value);
      const groups = groupTodos(todosRef.current, {
        settling: settlingRef.current,
        filter: value,
        meMemberId: identityRef.current?.meMemberId ?? null,
        now: new Date(),
      });
      setAnnouncement(
        filterAnnouncement({
          filter: value,
          filterName:
            membersRef.current.find((member) => member.id === value)?.name ??
            "",
          open: countOpen([...groups.thisWeek, ...groups.later]),
          shown:
            groups.thisWeek.length + groups.later.length + groups.done.length,
        }),
      );
    },
    [filter],
  );

  const addTodo = useCallback(
    (title: string) => {
      tempCounter.current += 1;
      const tempId = `tmp-${tempCounter.current}`;
      setTodos((current) => [
        ...current,
        {
          key: tempId,
          id: tempId,
          title,
          assigneeId: null,
          forId: null,
          dueDate: null,
          isPrivate: false,
          doneAt: null,
          doneSortAt: null,
          doneById: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      // A new thing has nobody in charge: with a filter on it would stay hidden.
      setFilterState("all");
      setAnnouncement(`Aggiunto: ${title}`);
      enqueue({ type: "add", tempId, title, inserted: false });
    },
    [enqueue, setTodos],
  );

  const toggleTodo = useCallback(
    (key: string) => {
      const todo = todosRef.current.find((t) => t.key === key);
      if (!todo) return;
      const markDone = todo.doneAt === null;
      const waiting = settleStops.current.get(key);
      const previous: DoneState = {
        doneAt: todo.doneAt,
        doneSortAt: todo.doneSortAt,
        doneById: todo.doneById,
      };
      const doneAt = markDone ? new Date().toISOString() : null;

      /** The row has waited enough: it changes group and keeps the focus. */
      const settle = () => {
        settleStops.current.delete(key);
        const checkbox = rootRef.current?.querySelector(checkboxSelector(key));
        if (checkbox?.contains(document.activeElement)) {
          requestFocus([checkboxSelector(key)]);
        }
        setSettling((set) => set.delete(key));
      };

      if (waiting) {
        // A second tap while waiting cancels the move (and the toast).
        waiting.stop();
        settleStops.current.delete(key);
        setSettling((set) => set.delete(key));
        if (waiting.kind === "done") hideToast();
      } else if (markDone) {
        setSettling((set) => set.add(key));
        // The row waits for its toast to close; the stop cancels the wait.
        let cancelled = false;
        settleStops.current.set(key, {
          kind: "done",
          stop: () => {
            cancelled = true;
          },
        });
        showToast({
          text: "Fatto:",
          emphasis: todo.title,
          after: ".",
          onClose: () => {
            if (!cancelled) settle();
          },
          onUndo: () => {
            toggleRef.current(key);
            requestFocus([checkboxSelector(key)]);
          },
        });
      } else {
        setSettling((set) => set.add(key));
        const timer = window.setTimeout(settle, readSettleMs());
        settleStops.current.set(key, {
          kind: "undone",
          stop: () => window.clearTimeout(timer),
        });
      }

      setTodos((current) =>
        current.map((t) =>
          t.key === key
            ? markDone
              ? {
                  ...t,
                  doneAt,
                  doneSortAt: doneAt,
                  doneById: identityRef.current?.meMemberId ?? null,
                }
              : { ...t, doneAt: null }
            : t,
        ),
      );
      setNow(new Date());
      enqueue({ type: "done", id: todo.id, doneAt, previous });
    },
    [
      enqueue,
      hideToast,
      requestFocus,
      rootRef,
      setSettling,
      setTodos,
      showToast,
    ],
  );

  useEffect(() => {
    toggleRef.current = toggleTodo;
  }, [toggleTodo]);

  const retry = useCallback(() => {
    setRetrying(true);
    if (status === "error") {
      // The first read failed: read this list again, nothing else.
      setAttempt((n) => n + 1);
      return;
    }
    void (async () => {
      await processQueue();
      if (queueRef.current.length === 0) await refetch();
      setRetrying(false);
    })();
  }, [processQueue, refetch, status]);

  return {
    status,
    todos,
    members,
    meMemberId,
    settling,
    now,
    filter,
    offline: networkDown || browserOffline,
    retrying,
    announcement,
    setFilter,
    addTodo,
    toggleTodo,
    retry,
    requestFocus,
  };
}
