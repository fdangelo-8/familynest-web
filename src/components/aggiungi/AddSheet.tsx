"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { notifyEventsChanged } from "../../lib/events-changed";
import {
  getLensSnapshot,
  getServerLensSnapshot,
  subscribeLens,
} from "../../lib/lens";
import {
  daysUntilDay,
  formatDeadline,
  formatTime,
  getCalendarDay,
  howMuch,
  isUrgent,
  startOfDay,
  toDayKey,
} from "../../lib/datetime";
import {
  listHouseholdEvents,
  type ListEventsResult,
} from "../../lib/household-events";
import { createClient } from "../../lib/supabase/client";
import { nameKey } from "../casa-spesa/model";
import { Alert } from "../ui/Alert/Alert";
import { Avatar } from "../ui/Avatar/Avatar";
import { Button } from "../ui/Button/Button";
import { Chip } from "../ui/Chip/Chip";
import { ConfirmDialog } from "../ui/ConfirmDialog/ConfirmDialog";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState/EmptyState";
import { Icon } from "../ui/Icon/Icon";
import { useIsDesktop } from "../ui/overlay";
import { SegmentedControl } from "../ui/SegmentedControl/SegmentedControl";
import { Sheet } from "../ui/Sheet/Sheet";
import { Skeleton, SkeletonGroup } from "../ui/Skeleton/Skeleton";
import { useToast } from "../ui/Toast/ToastProvider";
import { AddPreview, type DayState } from "./AddPreview";
import {
  focusAfterSheet,
  notifyListsChanged,
  readOpener,
  waitListsRefreshed,
  type ListKind,
} from "./coordination";
import { detectType, type AddType } from "./detect-type";
import {
  MEMBERS_FAILED_TEXT,
  SAVE_FAILED_TEXT,
  UNDO_FAILED_TEXT,
  atTime,
  dayInSentence,
  dayLabel,
  longDayLabel,
  rangeLabel,
  submitLabel,
  validatePhrase,
} from "./labels";
import { parseShopping } from "./parse-list";
import { parsePhrase, slotOf } from "./parse-phrase";
import { parseDeadline, parseTodo } from "./parse-todo";
import { escortNotice, type NestPerson } from "./preview";
import {
  createDeadline,
  createTodo,
  deleteDeadline,
  deleteTodo,
  looksLikeId,
  readDeadline,
  readTodo,
  readToTake,
  saveShopping,
  undoShopping,
  updateDeadline,
  updateTodo,
  type DeadlineRecord,
  type DeadlineValues,
  type TodoRecord,
  type TodoValues,
  type WriteResult,
} from "./save";
import {
  DEFAULT_REMINDERS,
  DELETE_FAILED_TEXT,
  EXAMPLES,
  GONE_ALERT_TEXT,
  GONE_TEXT,
  GONE_TITLE,
  LOAD_FAILED_TEXT,
  SAVE_FAILED_THING_TEXT,
  UNDO_DEADLINE_FAILED_TEXT,
  UNDO_EDIT_FAILED_TEXT,
  UNDO_EDIT_GONE_TEXT,
  UNDO_SHOPPING_FAILED_TEXT,
  UNDO_TODO_FAILED_TEXT,
  deleteConsequence,
  placeholderOf,
  shoppingSubmitLabel,
  thingsCount,
  todoSubmitLabel,
  validateDeadline,
  validateShopping,
  validateTodo,
} from "./texts";
import {
  DeadlinePreview,
  ReminderGroup,
  RemovableLabel,
  ShoppingPreview,
  VisibilityChip,
  VisibilityLabel,
  WhoGroup,
} from "./ThingBlocks";

type PeopleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; people: NestPerson[]; meId: string | null };

type Client = ReturnType<typeof createClient>;

type EditKind = "da-fare" | "scadenza";

type EditState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "gone" }
  | { status: "ready"; kind: "da-fare"; record: TodoRecord }
  | { status: "ready"; kind: "scadenza"; record: DeadlineRecord };

type ToTakeState =
  | { status: "idle" | "loading" | "failed" }
  | { status: "ready"; keys: Set<string> };

/** The people of the signed-in user's Nest (RLS limits the read to it). */
async function loadPeople(): Promise<PeopleState> {
  try {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    const { data, error } = await supabase
      .from("household_members")
      .select("id, name, color, kind, user_id")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error || !userId || !data) return { status: "error" };
    const people: NestPerson[] = data.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      kind: row.kind,
      userId: row.user_id,
    }));
    const me = people.find((p) => p.userId === userId);
    // The other people's user ids are not kept: only «who is me» is needed.
    return {
      status: "ready",
      people: people.map((p) => ({ ...p, userId: null })),
      meId: me?.id ?? null,
    };
  } catch {
    return { status: "error" };
  }
}

/** Only the member of the signed-in user, for when the whole list is not available. */
async function readMeId(supabase: Client): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return error ? null : (data?.id ?? null);
  } catch {
    return null;
  }
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * Body of the Add sheet: Impegno (issue #20), Spesa, Da fare and Scadenza, and
 * the edit of a Da fare or a Scadenza (issue #22).
 * - Opened from inside the app (intercepted route): closing goes back to the
 *   page below.
 * - Opened directly (typed address, reload, link): nothing to go back to, so
 *   closing loads `/oggi` as a normal page.
 * Everything typed is read in the browser; only what is saved travels.
 */
export function AddSheet({
  direct = false,
  initialType = null,
  editId = null,
  editKind = null,
}: {
  direct?: boolean;
  /** Type chosen by the address (`?tipo=`), as if the user had tapped it */
  initialType?: AddType | null;
  /** Id of the Da fare or Scadenza to edit (`?modifica=`) */
  editId?: string | null;
  /** Which kind the address says; without it both are tried */
  editKind?: EditKind | null;
}) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { showToast } = useToast();
  const lens = useSyncExternalStore(
    subscribeLens,
    getLensSnapshot,
    getServerLensSnapshot,
  );
  const isEdit = editId !== null;

  const uid = useId();
  const prefix = desktop ? "d" : "m";
  const formId = `${uid}-form`;
  const fieldId = `${prefix}-${uid}-frase`;
  const errorId = `${prefix}-${uid}-frase-errore`;
  const examplesId = `${prefix}-${uid}-esempi`;

  const [open, setOpen] = useState(true);
  const [closeRequested, setCloseRequested] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [goneAlert, setGoneAlert] = useState(false);
  const [todayKey] = useState(() => toDayKey(new Date()));
  const [now] = useState(() => new Date());
  const [peopleState, setPeopleState] = useState<PeopleState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<Record<string, ListEventsResult>>({});

  // Type, Spesa, Da fare, Scadenza
  const [type, setType] = useState<AddType>(
    isEdit ? "da-fare" : (initialType ?? "impegno"),
  );
  const [toTake, setToTake] = useState<ToTakeState>({ status: "idle" });
  // undefined = follows the text; null or an id = chosen by hand
  const [assigneeManual, setAssigneeManual] = useState<
    string | null | undefined
  >(undefined);
  const [isPrivate, setIsPrivate] = useState(false);
  const [reminders, setReminders] = useState<number[]>([...DEFAULT_REMINDERS]);
  const [dateRemoved, setDateRemoved] = useState(false);
  const [forRemoved, setForRemoved] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(
    isEdit ? { status: "loading" } : null,
  );
  const [editAttempt, setEditAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [opener] = useState(() => (editId ? readOpener(editId) : null));

  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const peopleLoad = useRef<Promise<PeopleState> | null>(null);
  const requestedDays = useRef(new Set<string>());
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // The type was chosen by hand (or by the address): the text no longer changes it
  const manualRef = useRef(initialType !== null || isEdit);
  const typeRef = useRef(type);
  const phraseRef = useRef(phrase);
  // What the text said about «chi se ne occupa» the last time it changed
  const writtenRef = useRef<string>("none");
  const toTakeLoad = useRef<Promise<void> | null>(null);
  const toTakeKeys = useRef<Set<string> | null>(null);
  const pendingFocus = useRef<"for" | "visibility" | null>(null);

  function updateType(next: AddType) {
    typeRef.current = next;
    setType(next);
  }

  // The people of the Nest, to recognize their names.
  useEffect(() => {
    let alive = true;
    const load = loadPeople();
    peopleLoad.current = load;
    load.then((state) => {
      if (!alive) return;
      setPeopleState(state);
      if (state.status === "ready" && !manualRef.current) {
        const detected = detectType(
          phraseRef.current,
          todayKey,
          state.people,
          state.meId,
        );
        if (detected && detected !== typeRef.current) updateType(detected);
      }
    });
    return () => {
      alive = false;
    };
  }, [attempt, todayKey]);

  const people = useMemo(
    () => (peopleState.status === "ready" ? peopleState.people : []),
    [peopleState],
  );
  const meId = peopleState.status === "ready" ? peopleState.meId : null;

  // The thing to edit, read by its id.
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    void (async () => {
      let next: EditState = { status: "gone" };
      if (looksLikeId(editId)) {
        const supabase = createClient();
        const kinds: EditKind[] = editKind
          ? [editKind]
          : ["da-fare", "scadenza"];
        for (const kind of kinds) {
          if (kind === "da-fare") {
            const read = await readTodo(supabase, editId);
            if (read.status === "found") {
              next = { status: "ready", kind, record: read.record };
              break;
            }
            if (read.status === "failed") {
              next = { status: "failed" };
              break;
            }
          } else {
            const read = await readDeadline(supabase, editId);
            if (read.status === "found") {
              next = { status: "ready", kind, record: read.record };
              break;
            }
            if (read.status === "failed") {
              next = { status: "failed" };
              break;
            }
          }
        }
      }
      if (!alive) return;
      if (next.status === "ready") {
        phraseRef.current = next.record.title;
        setPhrase(next.record.title);
        updateType(next.kind);
        setIsPrivate(next.record.isPrivate);
        if (next.kind === "scadenza") setReminders(next.record.reminders);
      }
      setEdit(next);
    })();
    return () => {
      alive = false;
    };
  }, [editId, editKind, editAttempt]);

  // The things still to take, read when the type Spesa is first shown.
  function loadToTake() {
    const load = readToTake(createClient()).then((result) => {
      toTakeKeys.current = result ? result.keys : null;
      setToTake(
        result ? { status: "ready", keys: result.keys } : { status: "failed" },
      );
    });
    toTakeLoad.current = load;
    return load;
  }
  useEffect(() => {
    if (type !== "spesa" || isEdit || toTakeLoad.current) return;
    void loadToTake();
  }, [type, isEdit]);

  const editReady = edit && edit.status === "ready" ? edit : null;
  const record = editReady ? editReady.record : null;
  const formShown =
    !isEdit || (editReady !== null && peopleState.status !== "loading");
  const empty = phrase.trim() === "";
  const isImpegno = type === "impegno" && !isEdit;

  // ----- Impegno
  const parsed = useMemo(
    () => parsePhrase(phrase, todayKey, people),
    [phrase, todayKey, people],
  );
  const slot = useMemo(() => slotOf(parsed, todayKey), [parsed, todayKey]);
  const hasTitle = parsed.title !== "";
  // A title and a time: the preview and the notice can show
  const readySlot = hasTitle ? slot : null;

  // Who takes part: the people named, otherwise whoever writes.
  const participants = useMemo(() => {
    const ids =
      parsed.memberIds.length > 0 ? parsed.memberIds : meId ? [meId] : [];
    const chosen = people.filter((p) => ids.includes(p.id));
    // Whoever writes first («Tu»), the others in the order of the Nest.
    return [
      ...chosen.filter((p) => p.id === meId),
      ...chosen.filter((p) => p.id !== meId),
    ];
  }, [parsed.memberIds, people, meId]);

  // The events of the day: read when the phrase gets a title and a time, then
  // only when the day changes. The request carries dates, never the phrase.
  const dayToRead =
    isImpegno && readySlot && peopleState.status === "ready"
      ? readySlot.dayKey
      : null;
  useEffect(() => {
    if (!dayToRead || requestedDays.current.has(dayToRead)) return;
    requestedDays.current.add(dayToRead);
    const day = getCalendarDay(dayToRead);
    listHouseholdEvents(day.start, day.end).then((result) => {
      setResults((previous) => ({ ...previous, [dayToRead]: result }));
    });
  }, [dayToRead]);

  let day: DayState | null = null;
  if (isImpegno && readySlot) {
    if (peopleState.status === "error") day = { status: "failed" };
    else if (peopleState.status === "loading") day = { status: "loading" };
    else {
      const result = results[readySlot.dayKey];
      day = !result
        ? { status: "loading" }
        : result.ok
          ? { status: "ready", events: result.events }
          : { status: "failed" };
    }
  }

  const noticeText =
    isImpegno && readySlot && day?.status === "ready"
      ? escortNotice({
          events: day.events,
          members: people,
          meId,
          participantIds: participants.map((p) => p.id),
          slot: readySlot,
        })
      : null;
  const notice = noticeText ? (
    <Alert variant="avviso">{noticeText}</Alert>
  ) : null;

  // ----- Spesa
  const shoppingEntries = useMemo(
    () => (type === "spesa" && !isEdit ? parseShopping(phrase) : []),
    [type, isEdit, phrase],
  );
  const shoppingRows = shoppingEntries.map((entry) => ({
    ...entry,
    inList: toTake.status === "ready" && toTake.keys.has(nameKey(entry.name)),
  }));
  const freshEntries = shoppingRows.filter((row) => !row.inList);

  // ----- Da fare and Scadenza
  const todoParsed = useMemo(
    () =>
      type === "da-fare" ? parseTodo(phrase, todayKey, people, meId) : null,
    [type, phrase, todayKey, people, meId],
  );
  const deadlineParsed = useMemo(
    () =>
      type === "scadenza"
        ? parseDeadline(phrase, todayKey, people, meId)
        : null,
    [type, phrase, todayKey, people, meId],
  );
  const common = todoParsed ?? deadlineParsed;
  // In edit the text counts only once it has been changed
  const useParsed = !record || phrase !== record.title;
  const thingTitle = !common ? "" : useParsed ? common.title : record.title;
  const baseDate = record && !dateRemoved ? record.dueDate : null;
  const dueDate = (useParsed && common ? common.dueDate : null) ?? baseDate;
  const baseFor = record && !forRemoved ? record.forId : null;
  const aboutRaw = todoParsed
    ? todoParsed.forId
    : deadlineParsed
      ? deadlineParsed.aboutId
      : null;
  const forId = (useParsed ? aboutRaw : null) ?? baseFor;
  const assigneeAuto: string | null =
    useParsed && common?.assigneeWritten
      ? common.assigneeId
      : record
        ? record.assigneeId
        : type === "scadenza"
          ? meId
          : null;
  const assigneeId =
    assigneeManual !== undefined ? assigneeManual : assigneeAuto;
  const isAuthor = !record || (meId !== null && record.createdById === meId);

  const whoList = useMemo(() => {
    const adults = people.filter((p) => p.kind !== "pet");
    const me = adults.find((p) => p.id === meId);
    return [...(me ? [me] : []), ...adults.filter((p) => p.id !== meId)];
  }, [people, meId]);
  const personOf = (id: string | null) =>
    id ? people.find((p) => p.id === id) : undefined;
  const assignee = personOf(assigneeId);
  const forPerson = personOf(forId);
  const otherName = assignee && assignee.id !== meId ? assignee.name : null;

  function detect(value: string) {
    if (manualRef.current || isEdit) return;
    const detected = detectType(value, todayKey, people, meId);
    if (detected && detected !== typeRef.current) {
      updateType(detected);
      setAssigneeManual(undefined);
    }
  }

  function changePhrase(value: string, byExample = false) {
    const next = value.replace(/\r\n|\r|\n/g, " ");
    phraseRef.current = next;
    setPhrase(next);
    setError(null);
    setSaveFailed(false);
    setGoneAlert(false);
    if (byExample) manualRef.current = false;
    detect(next);

    // «Laura deve …» written anew wins over an earlier tap on a person.
    const lead = parseTodo(next, todayKey, people, meId);
    const written = lead.assigneeWritten ? (lead.assigneeId ?? "me") : "none";
    if (written !== writtenRef.current) {
      writtenRef.current = written;
      setAssigneeManual(undefined);
      if (
        isPrivate &&
        lead.assigneeWritten &&
        lead.assigneeId !== null &&
        lead.assigneeId !== meId
      ) {
        setIsPrivate(false);
      }
    }
  }

  function pickType(next: AddType) {
    if (savingRef.current) return;
    manualRef.current = true;
    updateType(next);
    setAssigneeManual(undefined);
    setError(null);
  }

  function chooseAssignee(id: string) {
    if (savingRef.current) return;
    const next = id === assigneeId ? null : id;
    setAssigneeManual(next);
    if (next !== null && next !== meId && isPrivate) setIsPrivate(false);
  }

  function toggleVisibility() {
    if (savingRef.current) return;
    if (isPrivate) {
      setIsPrivate(false);
      return;
    }
    setIsPrivate(true);
    if (assigneeId !== null && assigneeId !== meId) setAssigneeManual(meId);
  }

  function toggleReminder(days: number) {
    if (savingRef.current) return;
    setReminders((current) =>
      current.includes(days)
        ? current.filter((value) => value !== days)
        : [...current, days].sort((a, b) => b - a),
    );
  }

  function removeDate() {
    pendingFocus.current = "for";
    setDateRemoved(true);
  }

  function removeFor() {
    pendingFocus.current = "visibility";
    setForRemoved(true);
  }

  // After a label is taken away the focus moves on (nothing is read aloud).
  useLayoutEffect(() => {
    const wanted = pendingFocus.current;
    if (!wanted) return;
    pendingFocus.current = null;
    const root = document.querySelector('[data-testid="aggiungi-foglio"]');
    const order =
      wanted === "for"
        ? [
            '[data-testid="aggiungi-togli-per"]',
            '[data-testid="aggiungi-visibilita"]',
            "textarea",
          ]
        : ['[data-testid="aggiungi-visibilita"]', "textarea"];
    for (const selector of order) {
      const target = root?.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        return;
      }
    }
  });

  // Edit: the field takes the focus with the cursor at the end.
  useEffect(() => {
    if (!isEdit || !formShown) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [isEdit, formShown]);

  // Edit: the thing is gone, «Chiudi» takes the focus.
  const goneOnOpen = edit?.status === "gone";
  useEffect(() => {
    if (!goneOnOpen) return;
    document
      .querySelector<HTMLElement>('[data-testid="aggiungi-gone-chiudi"]')
      ?.focus();
  }, [goneOnOpen]);

  function pickExample(text: string) {
    flushSync(() => changePhrase(text, true));
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(text.length, text.length);
  }

  function fail(problem: string) {
    setError(problem);
    fieldRef.current?.focus();
  }

  function finishSaved() {
    savedRef.current = true;
    setCloseRequested(true);
  }

  function undoFailed(text: string) {
    showToast({ text, icon: null });
  }

  // ----- Save: Impegno
  async function submitEvent() {
    const problem = validatePhrase(parsed);
    if (problem || !slot) {
      fail(problem ?? "");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);

    // Names recognized before the people were read would be lost: wait for them.
    let ids = parsed.memberIds;
    let authorId = meId;
    if (peopleState.status === "loading" && peopleLoad.current) {
      const loaded = await peopleLoad.current;
      if (loaded.status === "ready") {
        authorId = loaded.meId;
        ids = parsePhrase(phrase, todayKey, loaded.people).memberIds;
      }
    }

    const supabase = createClient();
    try {
      if (ids.length === 0) {
        authorId = authorId ?? (await readMeId(supabase));
        if (authorId) ids = [authorId];
      }
      if (ids.length === 0) throw new Error("no participants");
      const { data, error: rpcError } = await supabase.rpc("create_event", {
        p_title: parsed.title,
        p_starts_at: slot.startsAt.toISOString(),
        p_ends_at: slot.endsAt.toISOString(),
        p_visibility: getLensSnapshot() === "nest" ? "household" : "busy",
        p_member_ids: ids,
      });
      if (rpcError || typeof data !== "string") throw new Error("not saved");
      const eventId = data;

      notifyEventsChanged();
      showToast({
        text: "Messo in",
        emphasis: dayInSentence(slot.dayKey, todayKey),
        after: `: ${parsed.title} ${atTime(slot.startsAt)}.`,
        onUndo: () => {
          void (async () => {
            let failed = false;
            try {
              const { error: deleteError } = await supabase
                .from("events")
                .delete()
                .eq("id", eventId);
              failed = deleteError !== null;
            } catch {
              failed = true;
            }
            if (failed) showToast({ text: UNDO_FAILED_TEXT, icon: null });
            else notifyEventsChanged();
          })();
        },
      });
      finishSaved();
    } catch {
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  }

  function saveStopped() {
    savingRef.current = false;
    setSaving(false);
    setSaveFailed(true);
  }

  // ----- Save: Spesa
  async function submitShopping() {
    const problem = validateShopping(shoppingEntries);
    if (problem) {
      fail(problem);
      return;
    }
    if (freshEntries.length === 0) return;

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    const supabase = createClient();
    const result = await saveShopping(
      supabase,
      freshEntries.map(({ name, quantity }) => ({ name, quantity })),
    );
    if (result.status === "failed") {
      void loadToTake();
      saveStopped();
      return;
    }
    if (result.saved === 0) {
      // Everything was added by someone else in the meantime.
      void loadToTake();
      savingRef.current = false;
      setSaving(false);
      return;
    }
    notifyListsChanged("shopping");
    showToast({
      lead: thingsCount(result.saved),
      text: `${result.saved === 1 ? "aggiunta" : "aggiunte"} alla spesa.`,
      onUndo: () => {
        void (async () => {
          const done = await undoShopping(supabase, result.ids);
          if (done) notifyListsChanged("shopping");
          else undoFailed(UNDO_SHOPPING_FAILED_TEXT);
        })();
      },
    });
    finishSaved();
  }

  /** The values the form holds now, for a Da fare or a Scadenza. */
  function currentValues(): TodoValues & { reminders: number[] } {
    let privateNow = isPrivate;
    if (privateNow && assigneeId !== null && assigneeId !== meId) {
      privateNow = false;
    }
    return {
      title: thingTitle,
      dueDate,
      assigneeId,
      forId,
      isPrivate: privateNow,
      reminders,
    };
  }

  // ----- Save: Da fare and Scadenza, new
  async function submitThing() {
    const values = currentValues();
    const kind: ListKind = type === "da-fare" ? "todos" : "deadlines";
    const problem =
      type === "da-fare"
        ? validateTodo(values.title)
        : validateDeadline({
            title: values.title,
            dueDate: values.dueDate,
            todayKey,
            checkPast: true,
          });
    if (problem) {
      fail(problem);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    const supabase = createClient();
    let authorId = meId;
    if (peopleState.status === "loading" && peopleLoad.current) {
      const loaded = await peopleLoad.current;
      if (loaded.status === "ready") authorId = loaded.meId;
    }

    const created =
      type === "da-fare"
        ? await createTodo(supabase, values, authorId)
        : await createDeadline(
            supabase,
            { ...values, dueDate: values.dueDate! },
            authorId,
          );
    if (created.status === "failed") {
      saveStopped();
      return;
    }
    notifyListsChanged(kind);
    const onUndo = () => {
      void (async () => {
        const id = await created.findId();
        const result =
          id === null
            ? "failed"
            : type === "da-fare"
              ? await deleteTodo(supabase, id)
              : await deleteDeadline(supabase, id);
        if (result === "ok") notifyListsChanged(kind);
        else
          undoFailed(
            type === "da-fare"
              ? UNDO_TODO_FAILED_TEXT
              : UNDO_DEADLINE_FAILED_TEXT,
          );
      })();
    };
    if (type === "da-fare") {
      showToast(
        otherName
          ? {
              text: "Dato a",
              emphasis: otherName,
              after: `: ${values.title}.`,
              onUndo,
            }
          : {
              text: "Aggiunto ai da fare:",
              emphasis: values.title,
              after: ".",
              onUndo,
            },
      );
    } else {
      showToast({
        text: "Aggiunta alle scadenze:",
        emphasis: values.title,
        after: ".",
        onUndo,
      });
    }
    finishSaved();
  }

  // ----- Save: edit
  async function writeThing(
    id: string,
    kind: EditKind,
    values: TodoValues & { reminders: number[] },
  ): Promise<WriteResult> {
    const supabase = createClient();
    return kind === "da-fare"
      ? updateTodo(supabase, id, values)
      : updateDeadline(supabase, id, {
          ...values,
          dueDate: values.dueDate ?? "",
        } as DeadlineValues);
  }

  async function submitEdit() {
    if (!editReady) return;
    const original = editReady.record;
    const kind = editReady.kind;
    const values = currentValues();
    const problem =
      kind === "da-fare"
        ? validateTodo(values.title)
        : validateDeadline({
            title: values.title,
            dueDate: values.dueDate,
            todayKey,
            checkPast: values.dueDate !== original.dueDate,
          });
    if (problem) {
      fail(problem);
      return;
    }

    const before: TodoValues & { reminders: number[] } = {
      title: original.title,
      dueDate: original.dueDate,
      assigneeId: original.assigneeId,
      forId: original.forId,
      isPrivate: original.isPrivate,
      reminders: "reminders" in original ? original.reminders : reminders,
    };
    const unchanged =
      values.title === before.title &&
      values.dueDate === before.dueDate &&
      values.assigneeId === before.assigneeId &&
      values.forId === before.forId &&
      values.isPrivate === before.isPrivate &&
      (kind === "da-fare" || sameSet(values.reminders, before.reminders));
    if (unchanged) {
      finishSaved();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    setGoneAlert(false);
    const result = await writeThing(original.id, kind, values);
    if (result === "gone") {
      savingRef.current = false;
      setSaving(false);
      setGoneAlert(true);
      return;
    }
    if (result === "failed") {
      saveStopped();
      return;
    }

    const list: ListKind = kind === "da-fare" ? "todos" : "deadlines";
    notifyListsChanged(list);
    const focusTargets = opener ? [opener.primary, ...opener.fallbacks] : [];
    if (focusTargets.length > 0) {
      focusAfterSheet(waitListsRefreshed(list), focusTargets);
    }
    showToast({
      text: "Modifiche salvate.",
      onUndo: () => {
        const hadFocus =
          document.activeElement?.classList.contains("toast__azione");
        void (async () => {
          const refreshed = waitListsRefreshed(list);
          const undone = await writeThing(original.id, kind, before);
          if (undone === "ok") {
            notifyListsChanged(list);
            if (hadFocus && focusTargets.length > 0) {
              focusAfterSheet(refreshed, focusTargets);
            }
          } else if (undone === "gone") {
            undoFailed(UNDO_EDIT_GONE_TEXT);
          } else {
            undoFailed(UNDO_EDIT_FAILED_TEXT);
          }
        })();
      },
    });
    finishSaved();
  }

  async function doDelete(): Promise<boolean | undefined> {
    if (!editReady) return undefined;
    const { kind, record: original } = editReady;
    const supabase = createClient();
    const result =
      kind === "da-fare"
        ? await deleteTodo(supabase, original.id)
        : await deleteDeadline(supabase, original.id);
    if (result === "failed") {
      showToast({ text: DELETE_FAILED_TEXT, icon: null });
      return false;
    }
    const list: ListKind = kind === "da-fare" ? "todos" : "deadlines";
    const refreshed = waitListsRefreshed(list);
    notifyListsChanged(list);
    if (opener && opener.fallbacks.length > 0) {
      focusAfterSheet(refreshed, opener.fallbacks);
    }
    showToast({
      text: "Eliminato:",
      emphasis: original.title,
      after: ".",
    });
    finishSaved();
    return undefined;
  }

  async function submit() {
    if (savingRef.current) return;
    if (isEdit) {
      if (!editReady) return;
      await submitEdit();
      return;
    }
    if (empty) return;
    if (type === "impegno") await submitEvent();
    else if (type === "spesa") await submitShopping();
    else await submitThing();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    // Enter saves; Shift+Enter does not break the line either.
    event.preventDefault();
    if (!event.shiftKey) void submit();
  }

  function retryPeople() {
    setPeopleState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function retryEdit() {
    setEdit({ status: "loading" });
    setEditAttempt((value) => value + 1);
  }

  function handleClose() {
    setOpen(false);
    if (savedRef.current) {
      // Saved: the toast must survive, so no page load.
      if (direct) router.replace("/oggi");
      else router.back();
    } else if (direct) {
      // A normal page load: a fresh Today, the focus starts at the top
      window.location.assign(new URL("/oggi", window.location.href).href);
    } else {
      router.back();
    }
  }

  // Labels under the field (Impegno)
  const dayKeyShown = parsed.dayKey ?? (parsed.time ? todayKey : null);
  const timeText = slot
    ? parsed.time?.end === null
      ? formatTime(slot.startsAt)
      : `${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`
    : null;
  const label = (person: NestPerson) =>
    person.id === meId ? "Tu" : person.name;
  const showPeople = hasTitle && participants.length > 0;

  const everyone = people.filter((p) => p.kind !== "pet");
  const everyoneIn = everyone.every((p) =>
    participants.some((q) => q.id === p.id),
  );
  const whoText =
    participants.length === 0
      ? "Tu"
      : participants.length <= 4
        ? participants.length === 1
          ? label(participants[0]!)
          : `${participants
              .slice(0, -1)
              .map(label)
              .join(", ")} e ${label(participants[participants.length - 1]!)}`
        : everyoneIn
          ? "Tutto il Nest"
          : `${participants.length} persone`;

  let buttonLabel: string;
  if (type === "impegno") buttonLabel = submitLabel(phrase, parsed, todayKey);
  else if (type === "spesa") {
    buttonLabel = shoppingSubmitLabel({
      empty,
      total: shoppingRows.length,
      fresh: freshEntries.length,
    });
  } else if (type === "da-fare") {
    buttonLabel = todoSubmitLabel({ empty, otherName });
  } else {
    buttonLabel = empty ? "Aggiungi" : "Aggiungi alle scadenze";
  }
  const allInList =
    type === "spesa" && shoppingRows.length > 0 && freshEntries.length === 0;

  const submitButton = isEdit ? (
    <Button
      type="submit"
      form={formId}
      full={!desktop}
      icon="check"
      loading={saving}
      disabled={!editReady || !formShown}
    >
      Salva
    </Button>
  ) : (
    <Button
      type="submit"
      form={formId}
      arrow
      arrowIcon="arrow-up-right"
      full={!desktop}
      loading={saving}
      disabled={empty || allInList}
    >
      {buttonLabel}
    </Button>
  );
  const removeLabel =
    editReady?.kind === "scadenza"
      ? "Elimina scadenza"
      : "Elimina cosa da fare";
  const removeButton = (
    <Button
      variant="pericolo"
      inactive={saving}
      onClick={() => setConfirmOpen(true)}
    >
      {removeLabel}
    </Button>
  );

  const examples = EXAMPLES.map((text) => (
    <button
      key={text}
      type="button"
      className="chip"
      onClick={() => pickExample(text)}
    >
      {text}
    </button>
  ));

  const side = isEdit ? undefined : isImpegno && day && readySlot ? (
    <AddPreview
      parsed={parsed}
      slot={readySlot}
      todayKey={todayKey}
      people={people}
      participants={participants}
      day={day}
      notice={notice}
    />
  ) : (
    <>
      <p className="sottotitolo-gruppo" id={examplesId}>
        Esempi
      </p>
      <div className="gruppo-chip" role="group" aria-labelledby={examplesId}>
        {examples}
      </div>
    </>
  );

  let footer;
  if (isEdit) {
    footer = formShown ? (
      desktop ? (
        <>
          {removeButton}
          {submitButton}
        </>
      ) : (
        <>
          {submitButton}
          {removeButton}
        </>
      )
    ) : undefined;
  } else if (desktop) {
    footer = submitButton;
  } else {
    footer = (
      <>
        {submitButton}
        {empty ? (
          <div className="gruppo-chip" role="group" aria-label="Esempi">
            {examples}
          </div>
        ) : null}
      </>
    );
  }

  // ----- The part under the selector, by type
  const dateLabelText = dueDate
    ? formatDeadline(startOfDay(dueDate), now)
    : null;
  const forAvatar = forPerson ? (
    <Avatar name={forPerson.name} color={forPerson.color} size="xs" nameShown />
  ) : undefined;
  const visibility =
    isAuthor || !record ? (
      <VisibilityChip isPrivate={isPrivate} onToggle={toggleVisibility} />
    ) : (
      <VisibilityLabel />
    );
  const showBlock = isEdit ? formShown : !empty;

  let typeBlock: ReactNode = null;
  if (showBlock && type === "spesa") {
    typeBlock = <ShoppingPreview rows={shoppingRows} />;
  } else if (showBlock && type === "da-fare") {
    typeBlock = (
      <>
        <div className="gruppo-chip" aria-live="polite">
          {dateLabelText ? (
            isEdit ? (
              <RemovableLabel
                icon="calendar"
                removeLabel="Togli la data"
                onRemove={removeDate}
                testId="aggiungi-togli-data"
              >
                {dateLabelText}
              </RemovableLabel>
            ) : (
              <Chip static icon="calendar">
                {dateLabelText}
              </Chip>
            )
          ) : null}
          {forPerson ? (
            isEdit ? (
              <RemovableLabel
                leading={forAvatar}
                removeLabel={`Togli Per ${forPerson.name}`}
                onRemove={removeFor}
                testId="aggiungi-togli-per"
              >
                {`Per ${forPerson.name}`}
              </RemovableLabel>
            ) : (
              <Chip static leading={forAvatar}>
                {`Per ${forPerson.name}`}
              </Chip>
            )
          ) : null}
          {visibility}
        </div>
        <WhoGroup
          people={whoList}
          meId={meId}
          chosenId={assigneeId}
          onChoose={chooseAssignee}
        />
      </>
    );
  } else if (showBlock && type === "scadenza") {
    const days = dueDate ? daysUntilDay(dueDate, now) : null;
    typeBlock = (
      <>
        <DeadlinePreview
          howMuch={days === null ? null : howMuch(days)}
          urgent={days !== null && isUrgent(days)}
          dayText={dueDate ? longDayLabel(dueDate, todayKey) : "Manca la data"}
          title={thingTitle}
        />
        <div className="gruppo-chip" aria-live="polite">
          {forPerson ? (
            <Chip static leading={forAvatar}>
              {forPerson.name}
            </Chip>
          ) : null}
          {visibility}
        </div>
        <WhoGroup
          people={whoList}
          meId={meId}
          chosenId={assigneeId}
          onChoose={chooseAssignee}
        />
        <ReminderGroup chosen={reminders} onToggle={toggleReminder} />
      </>
    );
  }

  const kindIcon = editKind === "scadenza" ? "file-clock" : "square-check";

  let body: ReactNode;
  if (isEdit && !formShown) {
    if (edit?.status === "gone") {
      body = (
        <EmptyState
          icon={kindIcon}
          title={GONE_TITLE}
          text={GONE_TEXT}
          actions={
            <Button
              variant="secondary"
              full
              onClick={() => setCloseRequested(true)}
              data-testid="aggiungi-gone-chiudi"
            >
              Chiudi
            </Button>
          }
        />
      );
    } else if (edit?.status === "failed") {
      body = (
        <Alert
          variant="errore"
          action={
            <Button variant="link" onClick={retryEdit}>
              Riprova
            </Button>
          }
        >
          {LOAD_FAILED_TEXT}
        </Alert>
      );
    } else {
      body = (
        <SkeletonGroup data-testid="aggiungi-caricamento">
          <Skeleton shape="riga" />
          <Skeleton shape="testo-corto" />
          <Skeleton shape="riga" />
        </SkeletonGroup>
      );
    }
  } else {
    body = (
      <form id={formId} className="modulo-foglio" onSubmit={onSubmit}>
        <div className={cx("campo", error && "campo--errore")}>
          <label className="visivamente-nascosto" htmlFor={fieldId}>
            {isEdit ? "Titolo" : "Cosa vuoi aggiungere?"}
          </label>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className="campo-frase"
            rows={2}
            placeholder={placeholderOf(type)}
            value={phrase}
            readOnly={saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => changePhrase(event.target.value)}
            onKeyDown={onFieldKeyDown}
          />
          {error ? (
            <p className="campo__errore" id={errorId}>
              <Icon name="circle-alert" size="s" />
              {error}
            </p>
          ) : null}
        </div>

        {isEdit ? null : (
          <SegmentedControl<AddType>
            aria-label="Tipo"
            paper
            value={type}
            onChange={pickType}
            options={[
              { value: "impegno", label: "Impegno", icon: "calendar" },
              { value: "da-fare", label: "Da fare", icon: "square-check" },
              { value: "spesa", label: "Spesa", icon: "shopping-basket" },
              { value: "scadenza", label: "Scadenza", icon: "file-clock" },
            ]}
          />
        )}

        {peopleState.status === "error" ? (
          <Alert
            variant="errore"
            action={
              <Button variant="link" onClick={retryPeople}>
                Riprova
              </Button>
            }
          >
            {MEMBERS_FAILED_TEXT}
          </Alert>
        ) : null}

        {isImpegno ? (
          <div className="gruppo-chip" aria-live="polite">
            {dayKeyShown ? (
              <Chip static icon="calendar">
                {dayLabel(dayKeyShown, todayKey)}
              </Chip>
            ) : null}
            {timeText ? (
              <Chip static icon="clock">
                {timeText}
              </Chip>
            ) : null}
            {showPeople
              ? participants.map((person) => (
                  <Chip
                    static
                    key={person.id}
                    leading={
                      <Avatar
                        name={person.name}
                        color={person.color}
                        size="xs"
                        nameShown
                      />
                    }
                  >
                    {label(person)}
                  </Chip>
                ))
              : null}
          </div>
        ) : null}

        {typeBlock}

        {isImpegno && desktop && hasTitle ? (
          <div>
            <div className="riga-opzione">
              <Icon name="calendar" />
              <span className="riga-opzione__nome">
                {dayKeyShown ? longDayLabel(dayKeyShown, todayKey) : "Quando"}
              </span>
              <span className="riga-opzione__valore">
                {slot ? rangeLabel(slot, todayKey) : "Scegli"}
              </span>
            </div>
            <div className="riga-opzione">
              <Icon name="users" />
              <span className="riga-opzione__nome">Chi</span>
              <span className="riga-opzione__valore">
                {participants.length > 0 && participants.length <= 4 ? (
                  <span className="avatar-gruppo">
                    {participants.map((p) => (
                      <Avatar
                        key={p.id}
                        name={p.name}
                        color={p.color}
                        nameShown
                      />
                    ))}
                  </span>
                ) : null}
                {whoText}
              </span>
            </div>
            <div className="riga-opzione">
              <Icon name="car" />
              <span className="riga-opzione__nome">La porta</span>
              <span className="riga-opzione__valore">Scegli</span>
            </div>
            <div className="riga-opzione">
              <Icon name="eye" />
              <span className="riga-opzione__nome">Chi lo vede</span>
              <span className="riga-opzione__valore">
                {lens === "nest" ? "Tutto il Nest" : "Occupato"}
              </span>
            </div>
          </div>
        ) : null}

        {desktop || !isImpegno ? null : notice}

        {goneAlert ? (
          <Alert
            variant="errore"
            action={
              <Button
                variant="link"
                onClick={() => setCloseRequested(true)}
                data-testid="aggiungi-gone-avviso-chiudi"
              >
                Chiudi
              </Button>
            }
          >
            {GONE_ALERT_TEXT}
          </Alert>
        ) : null}

        {saveFailed ? (
          <Alert variant="errore">
            {isImpegno ? SAVE_FAILED_TEXT : SAVE_FAILED_THING_TEXT}
          </Alert>
        ) : null}
      </form>
    );
  }

  // The notice about the gone thing takes the focus when it appears.
  useEffect(() => {
    if (!goneAlert) return;
    document
      .querySelector<HTMLElement>('[data-testid="aggiungi-gone-avviso-chiudi"]')
      ?.focus();
  }, [goneAlert]);

  return (
    <>
      <Sheet
        open={open}
        title={isEdit ? "Modifica" : "Aggiungi"}
        info={
          <>
            scrivi come parli
            {desktop ? (
              <>
                {" "}
                <kbd className="kbd" aria-hidden="true">
                  esc
                </kbd>
              </>
            ) : null}
          </>
        }
        locked={saving || confirmOpen}
        closeRequested={closeRequested}
        onClose={handleClose}
        side={side}
        footerEnd={!isEdit}
        footer={footer}
        data-testid="aggiungi-foglio"
      >
        {body}
      </Sheet>
      <ConfirmDialog
        open={confirmOpen && editReady !== null}
        aboveSheet
        onClose={() => setConfirmOpen(false)}
        title={`Eliminare «${record?.title ?? ""}»?`}
        text={deleteConsequence(
          editReady?.kind ?? "da-fare",
          Boolean(record?.isPrivate),
        )}
        actions={[
          {
            label: removeLabel,
            variant: "pericolo-pieno",
            onClick: doDelete,
          },
        ]}
        data-testid="aggiungi-elimina-dialogo"
      />
    </>
  );
}
