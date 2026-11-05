"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useToast } from "@/components/ui/Toast/ToastProvider";
import { setAddText } from "@/lib/add-text-handoff";
import {
  addRecentSearch,
  cleanSearchText,
  clearRecentSearches,
  readRecentSearches,
  restoreRecentSearches,
} from "@/lib/recent-searches";
import { createClient } from "@/lib/supabase/client";
import { readDraft, releaseDraft, writeDraft } from "./draft";
import {
  EXAMPLES,
  RECENTS_CLEARED_TEXT,
  SAVE_FAILED_TEXT,
  buildGroups,
  countRows,
  eventGroupInfo,
  resultsAnnouncement,
  type FilterKey,
  type PersonView,
  type RowGroups,
  type RowModel,
} from "./model";
import { useSearch, type SearchPhase } from "./useSearch";
import { useSearchContext } from "./useSearchContext";

export type SurfaceMode = "page" | "palette";

/** Something the arrows can select in the palette. */
export type NavItem = { key: string; activate: () => void };

const NO_PEOPLE: PersonView[] = [];

/** Order of the groups on screen. */
const GROUP_ORDER = ["event", "deadline", "todo", "shopping_item"] as const;

/**
 * Everything the search does, for the page (mobile) and for the palette
 * (desktop) alike (issue #40). The two shapes only differ in how they draw it
 * and how they leave.
 */
export function useSearchController({
  mode,
  onClose,
  addByReplace,
}: {
  mode: SurfaceMode;
  /** Leaves the search (Annulla, Esc, the veil) */
  onClose: () => void;
  /** Aggiungi takes the place of the search in the history (read when used) */
  addByReplace: () => boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const uid = useId();
  const context = useSearchContext();
  const people = context.status === "loading" ? NO_PEOPLE : context.people;
  const userId = context.status === "loading" ? null : context.userId;
  const meId = context.status === "loading" ? null : context.meId;

  const [text, setTextState] = useState(() => readDraft());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [recentsTick, setRecentsTick] = useState(0);
  const immediateRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const search = useSearch({
    text,
    people,
    ready: context.status !== "loading",
    immediateRef,
  });
  const { phase } = search;

  const setText = useCallback((value: string) => {
    writeDraft(value);
    setTextState(value);
  }, []);
  /** An example, a recent search or a person was chosen: no waiting. */
  const setTextNow = useCallback(
    (value: string) => {
      immediateRef.current = true;
      setText(value);
      inputRef.current?.focus();
    },
    [setText],
  );

  useEffect(() => () => releaseDraft(), []);

  // The field has the focus as the search opens.
  useEffect(() => {
    const field = inputRef.current;
    field?.focus();
    const frame = window.requestAnimationFrame(() => field?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Esc closes the search and does not empty the field. Not while Aggiungi,
  // opened from here, is over it.
  useEffect(() => {
    if (pathname !== "/ricerca") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]:not(.palette)')) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const groups: RowGroups = useMemo(
    () =>
      buildGroups(search.hits, {
        now: search.now,
        words: search.words,
        people: peopleById,
      }),
    [search.hits, search.now, search.words, peopleById],
  );
  const counts = useMemo(() => countRows(groups), [groups]);
  const eventInfo = useMemo(
    () => eventGroupInfo(search.hits, search.now),
    [search.hits, search.now],
  );

  const searchable = text.replace(/\s/g, "").length >= 2;
  const announcement =
    searchable && search.announcedText !== null
      ? resultsAnnouncement(
          search.announcedText,
          filter === "all" ? counts.all : counts[filter],
          filter,
        )
      : "";

  // ---- recent searches ----

  const recents = useMemo(
    () => (userId ? readRecentSearches(userId) : []),
    // `recentsTick` says the storage changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, recentsTick],
  );

  const remember = useCallback(() => {
    if (!userId) return;
    addRecentSearch(userId, text);
    setRecentsTick((value) => value + 1);
  }, [userId, text]);

  const clearRecents = useCallback(() => {
    if (!userId) return;
    const previous = clearRecentSearches(userId);
    setRecentsTick((value) => value + 1);
    inputRef.current?.focus();
    showToast({
      text: RECENTS_CLEARED_TEXT,
      withoutNav: mode === "page",
      onUndo: () => {
        restoreRecentSearches(userId, previous);
        setRecentsTick((value) => value + 1);
      },
    });
  }, [mode, showToast, userId]);

  // ---- leaving: a result, Aggiungi ----

  const open = useCallback(
    (row: RowModel) => {
      if (row.href === null) return;
      remember();
      router.replace(row.href);
    },
    [remember, router],
  );

  /** A click on a result: the plain click goes through here, a modified one opens a tab. */
  const onRowClick = useCallback(
    (row: RowModel, event: MouseEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      open(row);
    },
    [open],
  );

  const goAdd = useCallback(() => {
    remember();
    setAddText({ text: cleanSearchText(text), type: "impegno" });
    if (addByReplace()) router.replace("/aggiungi");
    else router.push("/aggiungi");
  }, [addByReplace, remember, router, text]);

  const onAddClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      goAdd();
    },
    [goAdd],
  );

  // ---- things to do ticked from the page (mobile) ----

  const [ticked, setTicked] = useState<{
    version: number;
    ids: ReadonlySet<string>;
  }>({ version: 0, ids: new Set() });
  const doneIds: ReadonlySet<string> =
    ticked.version === search.version ? ticked.ids : NO_IDS;
  const saving = useRef(new Set<string>());

  const changeTicked = useCallback(
    (id: string, done: boolean) => {
      setTicked((current) => {
        const ids = new Set(
          current.version === search.version ? current.ids : [],
        );
        if (done) ids.add(id);
        else ids.delete(id);
        return { version: search.version, ids };
      });
    },
    [search.version],
  );

  const writeDone = useCallback(async (id: string, done: boolean) => {
    const { error } = await createClient()
      .from("todos")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    return error === null;
  }, []);

  const toggleTodo = useCallback(
    async (row: RowModel, position: number) => {
      const id = row.todoId;
      if (id === null || saving.current.has(id)) return;
      const markDone = !doneIds.has(id);
      saving.current.add(id);
      changeTicked(id, markDone);
      const saved = await writeDone(id, markDone);
      saving.current.delete(id);
      if (!saved) {
        changeTicked(id, !markDone);
        showToast({ text: SAVE_FAILED_TEXT, icon: null, withoutNav: true });
        return;
      }
      if (!markDone) return;
      showToast({
        text: "Fatto:",
        emphasis: row.titleText,
        after: ".",
        withoutNav: true,
        onUndo: () => {
          void (async () => {
            changeTicked(id, false);
            const undone = await writeDone(id, false);
            if (!undone) {
              changeTicked(id, true);
              showToast({
                text: SAVE_FAILED_TEXT,
                icon: null,
                withoutNav: true,
              });
            }
            window.requestAnimationFrame(() => {
              document
                .querySelector<HTMLElement>(
                  `[data-todo-position="${position}"] [role="checkbox"]`,
                )
                ?.focus();
            });
          })();
        },
      });
    },
    [changeTicked, doneIds, showToast, writeDone],
  );

  // ---- keyboard selection in the palette ----

  const items: NavItem[] = useMemo(() => {
    if (mode !== "palette") return [];
    if (phase === "ready") {
      const list: NavItem[] = [];
      for (const kind of GROUP_ORDER) {
        for (const row of groups[kind]) {
          if (row.masked) continue;
          list.push({ key: row.key, activate: () => open(row) });
        }
      }
      if (list.length > 0 || counts.all > 0) {
        list.push({ key: "add", activate: goAdd });
      }
      return list;
    }
    if (phase === "idle") {
      return [
        ...recents.map((recent, index) => ({
          key: `recent-${index}`,
          activate: () => setTextNow(recent),
        })),
        ...EXAMPLES.map((example, index) => ({
          key: `example-${index}`,
          activate: () => setTextNow(example),
        })),
      ];
    }
    return [];
  }, [mode, phase, groups, counts.all, recents, open, goAdd, setTextNow]);

  const scope = `${phase}:${search.version}`;
  const [selected, setSelected] = useState<{
    scope: string;
    key: string | null;
  }>({ scope: "", key: null });
  const defaultKey = phase === "ready" ? (items[0]?.key ?? null) : null;
  const activeKey = selected.scope === scope ? selected.key : defaultKey;
  const select = useCallback(
    (key: string | null) => setSelected({ scope, key }),
    [scope],
  );
  const move = useCallback(
    (delta: 1 | -1) => {
      if (items.length === 0) return;
      const index = items.findIndex((item) => item.key === activeKey);
      if (index < 0) {
        if (delta === 1) select(items[0]?.key ?? null);
        return;
      }
      const next = Math.min(items.length - 1, Math.max(0, index + delta));
      select(items[next]?.key ?? null);
    },
    [activeKey, items, select],
  );
  const activateSelected = useCallback((): boolean => {
    const item = items.find((candidate) => candidate.key === activeKey);
    if (!item) return false;
    item.activate();
    return true;
  }, [activeKey, items]);

  // The selected row stays in view.
  useEffect(() => {
    if (activeKey === null) return;
    document
      .getElementById(`${uid}-${activeKey}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeKey, uid]);

  const itemId = useCallback((key: string) => `${uid}-${key}`, [uid]);

  const controller = {
    uid,
    mode,
    context,
    people,
    peopleById,
    meId,
    text,
    setText,
    setTextNow,
    filter,
    setFilter,
    phase: phase as SearchPhase,
    retrying: search.retrying,
    retry: search.retry,
    groups,
    counts,
    eventInfo,
    announcement,
    shownText: cleanSearchText(text),
    recents,
    clearRecents,
    remember,
    onRowClick,
    onAddClick,
    open,
    goAdd,
    doneIds,
    toggleTodo,
    items,
    activeKey,
    select,
    move,
    activateSelected,
    itemId,
    close: onClose,
  };
  // The field's ref travels apart: an object holding a ref cannot be read
  // while rendering.
  return { ctrl: controller, inputRef };
}

const NO_IDS: ReadonlySet<string> = new Set();

export type SearchController = ReturnType<typeof useSearchController>["ctrl"];
