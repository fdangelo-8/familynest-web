"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { takeAddText } from "../../lib/add-text-handoff";
import { notifyEventsChanged } from "../../lib/events-changed";
import type { EventVisibility } from "../../lib/calendar";
import {
  daysUntilDay,
  getCalendarDay,
  howMuch,
  isUrgent,
  isValidDayKey,
  toDayKey,
  toTimeFieldValue,
} from "../../lib/datetime";
import {
  listHouseholdEvents,
  type ListEventsResult,
} from "../../lib/household-events";
import { createClient } from "../../lib/supabase/client";
import { nameKey } from "../casa-spesa/model";
import { useNest } from "../ui/AppFrame/NestProvider";
import { useLens } from "../ui/Lens/Lens";
import { Alert } from "../ui/Alert/Alert";
import { Avatar } from "../ui/Avatar/Avatar";
import { Button } from "../ui/Button/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog/ConfirmDialog";
import { Chip } from "../ui/Chip/Chip";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/EmptyState/EmptyState";
import { DateField, FieldPair, TextField, TimeField } from "../ui/Field/Field";
import { useIsDesktop } from "../ui/overlay";
import { SegmentedControl } from "../ui/SegmentedControl/SegmentedControl";
import { Sheet } from "../ui/Sheet/Sheet";
import { Skeleton, SkeletonGroup } from "../ui/Skeleton/Skeleton";
import { useToast } from "../ui/Toast/ToastProvider";
import {
  PeopleChips,
  fieldId as eventFieldId,
  focusField,
} from "../evento-modulo/EventFormFields";
import { Icon } from "../ui/Icon/Icon";
import {
  ERROR_TEXTS,
  endsOtherDayHint,
  firstErrorField,
  meFirst,
  newEventRepetition,
  validateForm,
  visibilityHelp,
  type EventFormValues,
  type FormErrors,
} from "../evento-modulo/model";
import {
  focusAfterSheet,
  notifyListsChanged,
  readOpener,
  waitListsRefreshed,
  type ListKind,
} from "./coordination";
import { DetailsButton } from "./DetailsButton";
import { detectType, type AddType } from "./detect-type";
import {
  formSubmitLabel,
  initialFormValues,
  slotOfFields,
  type EventFields,
} from "./new-event";
import { NewEventForm } from "./NewEventForm";
import {
  MEMBERS_FAILED_TEXT,
  MISSING_DAY_TEXT,
  MISSING_TIME_TEXT,
  SAVE_FAILED_TEXT,
  UNDO_FAILED_TEXT,
  atTime,
  dayInSentence,
  joinNames,
  longDayLabel,
  validatePhrase,
} from "./labels";
import { parseShopping } from "./parse-list";
import { parsePhrase, slotOf, type ParsedPhrase } from "./parse-phrase";
import { parseDeadline, parseTodo } from "./parse-todo";
import { escortNotice, type NestPerson } from "./preview";
import {
  createDeadline,
  createEvent,
  createTodo,
  deleteDeadline,
  deleteNewEvent,
  deleteTodo,
  looksLikeId,
  readDeadline,
  readTodo,
  deleteShoppingItem,
  findShoppingDuplicate,
  readShoppingItem,
  readToTake,
  saveShopping,
  undoShopping,
  updateDeadline,
  updateShoppingItem,
  updateTodo,
  type DeadlineRecord,
  type ShoppingRecord,
  type ShoppingValues,
  type ShoppingWriteResult,
  type TodoRecord,
  type TodoValues,
  type WriteResult,
} from "./save";
import {
  DEFAULT_REMINDERS,
  DELETE_FAILED_TEXT,
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
  shoppingDuplicateText,
  shoppingSubmitLabel,
  thingsCount,
  todoSubmitLabel,
  validateDeadline,
  validateShopping,
  validateShoppingEdit,
  validateThingDate,
  validateTodo,
} from "./texts";
import {
  DeadlinePreview,
  EventVisibilityGroup,
  ReminderGroup,
  RemovableLabel,
  ShoppingPreview,
  VisibilityGroup,
  WhoManyGroup,
} from "./ThingBlocks";

type PeopleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; people: NestPerson[]; meId: string | null };

type Client = ReturnType<typeof createClient>;

type EditKind = "da-fare" | "scadenza" | "spesa";

type EditState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "gone" }
  | { status: "ready"; kind: "da-fare"; record: TodoRecord }
  | { status: "ready"; kind: "scadenza"; record: DeadlineRecord }
  | { status: "ready"; kind: "spesa"; record: ShoppingRecord };

/** The full form «Nuovo impegno» while it is open: what was typed and where it was opened from. */
type FormDraft = {
  values: EventFormValues;
  errors: FormErrors;
};

/** The fields of an Impegno the user changed by hand (#333, R2): they win over the phrase. */
type EventManual = Partial<{
  day: string;
  from: string;
  to: string;
  memberIds: string[];
  visibility: EventVisibility;
}>;

/** An error under a field of the sheet (not under the phrase). */
type FieldErrors = Partial<
  Record<"day" | "from" | "to" | "people" | "date", string>
>;

/** What the phrase says for each field: when it changes, the field follows the phrase again (R3). */
type Recognized = {
  assignee: string;
  date: string;
  day: string;
  from: string;
  to: string;
  people: string;
};

/** The values of a Da fare or a Scadenza, as the sheet holds them. */
type ThingValues = TodoValues & { reminders: number[]; note: string | null };

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

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * The fields of an Impegno: what the phrase says (the day, the times, the
 * people named, otherwise whoever writes), unless the user changed the field
 * by hand (#333, R1 and R2).
 */
function eventFieldsOf(args: {
  parsed: ParsedPhrase;
  manual: EventManual;
  todayKey: string;
  meId: string | null;
  visibility: EventVisibility;
}): EventFields {
  const { parsed, manual, todayKey, meId, visibility } = args;
  const slot = slotOf(parsed, todayKey);
  const named =
    parsed.memberIds.length > 0 ? parsed.memberIds : meId ? [meId] : [];
  return {
    day: manual.day ?? parsed.dayKey ?? (parsed.time ? todayKey : ""),
    from: manual.from ?? (slot ? toTimeFieldValue(slot.startsAt) : ""),
    to: manual.to ?? (slot ? toTimeFieldValue(slot.endsAt) : ""),
    memberIds: manual.memberIds ?? named,
    visibility: manual.visibility ?? visibility,
  };
}

/** The note a Scadenza already has (a Da fare has none), to send it back unchanged. */
function noteOf(record: TodoRecord | DeadlineRecord): string | null {
  return "note" in record ? (record as DeadlineRecord).note : null;
}

/** The errors under the fields of an Impegno (the title is checked under the phrase). */
function eventFieldErrors(fields: EventFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!isValidDayKey(fields.day)) errors.day = MISSING_DAY_TEXT;
  if (!fields.from) errors.from = MISSING_TIME_TEXT;
  else if (!fields.to) errors.to = MISSING_TIME_TEXT;
  else if (fields.from === fields.to) errors.to = ERROR_TEXTS.sameTime;
  if (fields.memberIds.length === 0) errors.people = ERROR_TEXTS.people;
  return errors;
}

/** Moves the focus to a field of the sheet by its id (a group takes it on its pressed voice). */
function focusById(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  if (element.getAttribute("role") === "group") {
    (
      element.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      element.querySelector<HTMLElement>("button:not(:disabled)")
    )?.focus();
    return;
  }
  element.focus();
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
  const [lens] = useLens();
  const { defaultVisibility } = useNest();
  // Lens «Nest»: everyone sees it. Lens «Io»: the visibility chosen in the profile.
  const newEventVisibility: EventVisibility =
    lens === "nest" ? "household" : defaultVisibility;
  const isEdit = editId !== null;

  const uid = useId();
  const prefix = desktop ? "d" : "m";
  const formId = `${uid}-form`;
  const moduleFormId = `${uid}-modulo`;
  const modulePrefix = `n-${uid}`;
  const fieldId = `${prefix}-${uid}-frase`;
  const errorId = `${prefix}-${uid}-frase-errore`;
  const quantityId = `${prefix}-${uid}-quantita`;
  // The fields of the sheet: «Giorno», «Dalle», «Alle», «Chi» of an Impegno ...
  const fieldsPrefix = `${prefix}-${uid}-campo`;
  const dateId = `${fieldsPrefix}-data`;
  const visibilityId = `${fieldsPrefix}-vede`;

  // Text left by another page (the search): read once, then forgotten.
  const [handoff] = useState(() => (editId ? null : takeAddText()));
  const startType = initialType ?? handoff?.type ?? null;

  const [open, setOpen] = useState(true);
  const [closeRequested, setCloseRequested] = useState(false);
  const [phrase, setPhrase] = useState(handoff?.text ?? "");
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
    isEdit ? "da-fare" : (startType ?? "impegno"),
  );
  const [toTake, setToTake] = useState<ToTakeState>({ status: "idle" });
  // undefined = follows the text; a list (even empty) = chosen by hand
  const [assigneeManual, setAssigneeManual] = useState<string[] | undefined>(
    undefined,
  );
  // undefined = follows the text; a day or "" = chosen by hand («Data»)
  const [dateManual, setDateManual] = useState<string | undefined>(undefined);
  const [eventManual, setEventManual] = useState<EventManual>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPrivate, setIsPrivate] = useState(false);
  const [reminders, setReminders] = useState<number[]>([...DEFAULT_REMINDERS]);
  const [forRemoved, setForRemoved] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(
    isEdit ? { status: "loading" } : null,
  );
  const [editAttempt, setEditAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Edit of a thing of Spesa: the quantity, its error, and the people chosen by
  // hand (null = the saved ones)
  const [quantity, setQuantity] = useState("");
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [shoppingWho, setShoppingWho] = useState<string[] | null>(null);
  // null: the sheet shows the phrase; otherwise the full form «Nuovo impegno»
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [opener] = useState(() => (editId ? readOpener(editId) : null));

  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const peopleLoad = useRef<Promise<PeopleState> | null>(null);
  const requestedDays = useRef(new Set<string>());
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // The type was chosen by hand (or by the address): the text no longer changes it
  const manualRef = useRef(startType !== null || isEdit);
  const typeRef = useRef(type);
  const phraseRef = useRef(phrase);
  const toTakeLoad = useRef<Promise<void> | null>(null);
  const toTakeKeys = useRef<Set<string> | null>(null);
  // After «Togli Per …» the focus moves on to the voice chosen in «Chi lo vede»
  const pendingFocus = useRef(false);
  // The form «Nuovo impegno» was just opened (its title takes the focus), or just closed
  // (the button that opened it gets the focus back)
  const formFocus = useRef(false);
  const returnFocus = useRef(false);

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
          if (kind === "spesa") {
            const read = await readShoppingItem(supabase, editId);
            if (read.status === "found") {
              next = { status: "ready", kind, record: read.record };
              break;
            }
            if (read.status === "failed") {
              next = { status: "failed" };
              break;
            }
          } else if (kind === "da-fare") {
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
      if (next.status === "ready" && next.kind === "spesa") {
        phraseRef.current = next.record.name;
        setPhrase(next.record.name);
        setQuantity(next.record.quantity ?? "");
        updateType("spesa");
      } else if (next.status === "ready") {
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
  const shoppingEdit = editReady?.kind === "spesa" ? editReady : null;
  const thingEdit = editReady && editReady.kind !== "spesa" ? editReady : null;
  const record = thingEdit ? thingEdit.record : null;
  const formShown =
    !isEdit || (editReady !== null && peopleState.status !== "loading");
  const empty = phrase.trim() === "";
  const isImpegno = type === "impegno" && !isEdit;

  // ----- Impegno
  const parsed = useMemo(
    () => parsePhrase(phrase, todayKey, people),
    [phrase, todayKey, people],
  );
  const hasTitle = parsed.title !== "";
  // The fields of the sheet: the phrase, unless changed by hand
  const eventFields = useMemo(
    () =>
      eventFieldsOf({
        parsed,
        manual: eventManual,
        todayKey,
        meId,
        visibility: newEventVisibility,
      }),
    [parsed, eventManual, todayKey, meId, newEventVisibility],
  );
  const fieldsSlot = useMemo(() => slotOfFields(eventFields), [eventFields]);
  // A title and a time: the notice can show
  const readySlot = hasTitle ? fieldsSlot : null;

  // The events of the day: read when the fields get a title and a time, then
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

  const dayResult = readySlot ? results[readySlot.dayKey] : undefined;
  const noticeText =
    isImpegno && readySlot && dayResult?.ok
      ? escortNotice({
          events: dayResult.events,
          members: people,
          meId,
          participantIds: eventFields.memberIds,
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
  // «Data»: chosen by hand, otherwise the phrase, otherwise the saved one ("" = none)
  const phraseDate = useParsed && common ? common.dueDate : null;
  const dueDate = dateManual ?? phraseDate ?? record?.dueDate ?? "";
  const baseFor = record && !forRemoved ? record.forId : null;
  const aboutRaw = todoParsed
    ? todoParsed.forId
    : deadlineParsed
      ? deadlineParsed.aboutId
      : null;
  const forId = (useParsed ? aboutRaw : null) ?? baseFor;
  // «Chi se ne occupa»: chosen by hand, otherwise «<Nome> deve», otherwise the
  // saved ones; a new Scadenza starts with «Tu»
  const assigneeAuto: string[] =
    useParsed && common?.assigneeWritten
      ? common.assigneeId
        ? [common.assigneeId]
        : []
      : record
        ? record.assigneeIds
        : type === "scadenza" && meId
          ? [meId]
          : [];
  const assigneeIds = assigneeManual ?? assigneeAuto;
  const isAuthor = !record || (meId !== null && record.createdById === meId);

  const whoList = useMemo(() => {
    const adults = people.filter((p) => p.kind !== "pet");
    const me = adults.find((p) => p.id === meId);
    return [...(me ? [me] : []), ...adults.filter((p) => p.id !== meId)];
  }, [people, meId]);
  // Spesa, edit: the people saved (only those still in the Nest, once known)
  // and the ones shown now.
  const savedWho = useMemo(() => {
    if (!shoppingEdit) return [];
    const saved = shoppingEdit.record.assigneeIds;
    return peopleState.status === "ready"
      ? saved.filter((id) => whoList.some((person) => person.id === id))
      : saved;
  }, [shoppingEdit, peopleState.status, whoList]);
  const whoIds = shoppingWho ?? savedWho;

  function toggleShoppingWho(id: string) {
    if (savingRef.current) return;
    setShoppingWho((current) => {
      const base = current ?? savedWho;
      return base.includes(id)
        ? base.filter((value) => value !== id)
        : [...base, id];
    });
  }

  const personOf = (id: string | null) =>
    id ? people.find((p) => p.id === id) : undefined;
  const forPerson = personOf(forId);
  // The people of «Dai a …»: the others, not the author, in the order of the group
  const otherNames = whoList
    .filter((p) => p.id !== meId && assigneeIds.includes(p.id))
    .map((p) => p.name);

  /** What a phrase says for each field of the type shown now (#333, R3). */
  function recognize(text: string): Recognized {
    const lead = parseTodo(text, todayKey, people, meId);
    const event = parsePhrase(text, todayKey, people);
    const date =
      typeRef.current === "scadenza"
        ? parseDeadline(text, todayKey, people, meId).dueDate
        : lead.dueDate;
    return {
      assignee: lead.assigneeWritten ? (lead.assigneeId ?? "me") : "none",
      date: date ?? "",
      day: event.dayKey ?? "",
      from: event.time ? String(event.time.start) : "",
      to: event.time ? String(event.time.end ?? "auto") : "",
      people: event.memberIds.join(","),
    };
  }

  /**
   * A new type: every choice made by hand is forgotten, except «Data» between
   * Da fare and Scadenza (#333, R5). Changing the type never saves.
   */
  function changeTypeTo(next: AddType) {
    const previous = typeRef.current;
    if (next === previous) return;
    updateType(next);
    setAssigneeManual(undefined);
    setShoppingWho(null);
    setEventManual({});
    setIsPrivate(false);
    setReminders([...DEFAULT_REMINDERS]);
    setFieldErrors({});
    const both = [previous, next].every(
      (kind) => kind === "da-fare" || kind === "scadenza",
    );
    if (!both) setDateManual(undefined);
  }

  function detect(value: string) {
    if (manualRef.current || isEdit) return;
    const detected = detectType(value, todayKey, people, meId);
    if (detected && detected !== typeRef.current) changeTypeTo(detected);
  }

  function changePhrase(value: string) {
    const before = phraseRef.current;
    const next = value.replace(/\r\n|\r|\n/g, " ");
    phraseRef.current = next;
    setPhrase(next);
    setError(null);
    setFieldErrors({});
    setSaveFailed(false);
    setGoneAlert(false);
    detect(next);

    // A field goes back to the phrase when what the phrase says for it changes:
    // «Laura deve …» written anew wins over an earlier tap on a person, a new
    // day over a day chosen by hand. Other words touch nothing.
    const was = recognize(before);
    const now = recognize(next);
    if (was.assignee !== now.assignee) {
      setAssigneeManual(undefined);
      const lead = parseTodo(next, todayKey, people, meId);
      if (
        isPrivate &&
        lead.assigneeWritten &&
        lead.assigneeId !== null &&
        lead.assigneeId !== meId
      ) {
        setIsPrivate(false);
      }
    }
    if (was.date !== now.date) setDateManual(undefined);
    const forgotten = (["day", "from", "to", "people"] as const).filter(
      (key) => was[key] !== now[key],
    );
    if (forgotten.length > 0) {
      setEventManual((current) => {
        const rest = { ...current };
        for (const key of forgotten) {
          if (key === "people") delete rest.memberIds;
          else delete rest[key];
        }
        return rest;
      });
    }
  }

  function pickType(next: AddType) {
    if (savingRef.current) return;
    manualRef.current = true;
    changeTypeTo(next);
    setError(null);
  }

  function toggleAssignee(id: string) {
    if (savingRef.current) return;
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((value) => value !== id)
      : [...assigneeIds, id];
    setAssigneeManual(next);
    // «Lo vedo solo io» has nobody but the author
    if (isPrivate && next.some((value) => value !== meId)) setIsPrivate(false);
  }

  function changeVisibility(nowPrivate: boolean) {
    if (savingRef.current) return;
    setIsPrivate(nowPrivate);
    if (nowPrivate && assigneeIds.some((value) => value !== meId)) {
      setAssigneeManual(meId ? [meId] : []);
    }
  }

  function changeDate(value: string) {
    if (savingRef.current) return;
    setDateManual(value);
    setFieldErrors((current) => ({ ...current, date: undefined }));
    setSaveFailed(false);
  }

  function changeEventFields(patch: EventManual) {
    if (savingRef.current) return;
    setEventManual((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => {
      const next = { ...current };
      if (patch.day !== undefined) delete next.day;
      if (patch.from !== undefined) delete next.from;
      if (patch.to !== undefined) delete next.to;
      if (patch.memberIds !== undefined) delete next.people;
      return next;
    });
    setSaveFailed(false);
  }

  function toggleEventMember(id: string) {
    const current = eventFields.memberIds;
    changeEventFields({
      memberIds: current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    });
  }

  function toggleReminder(days: number) {
    if (savingRef.current) return;
    setReminders((current) =>
      current.includes(days)
        ? current.filter((value) => value !== days)
        : [...current, days].sort((a, b) => b - a),
    );
  }

  function removeFor() {
    pendingFocus.current = true;
    setForRemoved(true);
  }

  // After «Togli Per …» the focus moves on to the voice chosen in «Chi lo
  // vede» (nothing is read aloud).
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const root = document.querySelector('[data-testid="aggiungi-foglio"]');
    const order = [
      '[data-testid="aggiungi-visibilita"] button[aria-pressed="true"]',
      "textarea",
    ];
    for (const selector of order) {
      const target = root?.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        return;
      }
    }
  });

  // Edit, or text handed over by another page: the field takes the focus
  // with the cursor at the end.
  const hasStartText = handoff !== null;
  useEffect(() => {
    if ((!isEdit && !hasStartText) || !formShown) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [isEdit, hasStartText, formShown]);

  // Edit: the thing is gone, «Chiudi» takes the focus.
  const goneOnOpen = edit?.status === "gone";
  useEffect(() => {
    if (!goneOnOpen) return;
    document
      .querySelector<HTMLElement>('[data-testid="aggiungi-gone-chiudi"]')
      ?.focus();
  }, [goneOnOpen]);

  function fail(problem: string) {
    setError(problem);
    fieldRef.current?.focus();
  }

  /** Errors under the phrase and under the fields; the focus goes to the first wrong one. */
  function failFields(title: string | null, errors: FieldErrors) {
    setError(title);
    setFieldErrors(errors);
    if (title) {
      fieldRef.current?.focus();
      return;
    }
    if (errors.day) focusField(fieldsPrefix, "day");
    else if (errors.from) focusField(fieldsPrefix, "from");
    else if (errors.to) focusField(fieldsPrefix, "to");
    else if (errors.people) focusField(fieldsPrefix, "people");
    else if (errors.date) focusById(dateId);
  }

  function finishSaved() {
    savedRef.current = true;
    setCloseRequested(true);
  }

  function undoFailed(text: string) {
    showToast({ text, icon: null });
  }

  /** The new event is saved, from the phrase or from the form: same toast, same «Annulla». */
  function announceCreated(
    supabase: Client,
    event: { id: string; title: string; dayKey: string; startsAt: Date },
  ) {
    notifyEventsChanged();
    showToast({
      text: "Messo in",
      emphasis: dayInSentence(event.dayKey, todayKey),
      after: `: ${event.title} ${atTime(event.startsAt)}.`,
      onUndo: () => {
        void (async () => {
          if (await deleteNewEvent(supabase, event.id)) notifyEventsChanged();
          else undoFailed(UNDO_FAILED_TEXT);
        })();
      },
    });
    finishSaved();
  }

  // ----- Full form «Nuovo impegno» (#171)
  const canOpenForm =
    isImpegno && hasTitle && peopleState.status === "ready" && meId !== null;

  // The form starts from the fields of the sheet, not from the phrase alone.
  function openForm() {
    if (savingRef.current || !canOpenForm || meId === null) return;
    formFocus.current = true;
    setSaveFailed(false);
    setDraft({
      values: initialFormValues(parsed.title, eventFields),
      errors: {},
    });
  }

  // X, Esc, the veil and the drag: back to the phrase, nothing is saved.
  function backToPhrase() {
    if (!draft) return;
    returnFocus.current = true;
    setSaveFailed(false);
    setDraft(null);
  }

  function changeForm(patch: Partial<EventFormValues>) {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, ...patch } } : null,
    );
  }

  async function submitForm() {
    if (!draft || meId === null || savingRef.current) return;
    setSaveFailed(false);
    const { values } = draft;
    const { errors, times } = validateForm(values, 0);
    setDraft((current) => (current ? { ...current, errors } : null));
    const first = firstErrorField(errors);
    if (first) {
      focusField(modulePrefix, first);
      return;
    }
    if (!times) return;

    savingRef.current = true;
    setSaving(true);
    const supabase = createClient();
    const title = values.title.trim();
    const created = await createEvent(supabase, {
      title,
      startsAt: times.start,
      endsAt: times.end,
      visibility: values.visibility,
      memberIds: values.memberIds,
      place: values.place.trim(),
      escortId: values.escortId,
      repetition: newEventRepetition(values.repeat, values.day),
      notes: values.notes.trim(),
    });
    if (created.status === "failed") {
      savingRef.current = false;
      setSaving(false);
      if (created.reason === "duration") {
        setDraft((current) =>
          current
            ? { ...current, errors: { repeat: ERROR_TEXTS.duration } }
            : null,
        );
        focusField(modulePrefix, "repeat");
      } else {
        setSaveFailed(true);
      }
      return;
    }
    announceCreated(supabase, {
      id: created.id,
      title,
      dayKey: values.day,
      startsAt: times.start,
    });
  }

  // The form was just drawn: scroll to the top and focus the field of the entry.
  // Back on the phrase: the entry that was used gets the focus again.
  useLayoutEffect(() => {
    const root = document.querySelector('[data-testid="aggiungi-foglio"]');
    if (draft && formFocus.current) {
      formFocus.current = false;
      if (root) {
        root.scrollTop = 0;
        for (const part of root.querySelectorAll(
          ".foglio__corpo, .modale__corpo",
        )) {
          part.scrollTop = 0;
        }
      }
      focusField(modulePrefix, "title");
    } else if (!draft && returnFocus.current) {
      returnFocus.current = false;
      root
        ?.querySelector<HTMLElement>(
          '[data-testid="aggiungi-ingresso-details"]',
        )
        ?.focus();
    }
  });

  // ----- Save: Impegno
  async function submitEvent() {
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);

    // Names recognized before the people were read would be lost: wait for them.
    let read = parsed;
    let authorId = meId;
    if (peopleState.status === "loading" && peopleLoad.current) {
      const loaded = await peopleLoad.current;
      if (loaded.status === "ready") {
        authorId = loaded.meId;
        read = parsePhrase(phrase, todayKey, loaded.people);
      }
    }
    const supabase = createClient();
    authorId = authorId ?? (await readMeId(supabase));
    if (
      authorId === null &&
      read.memberIds.length === 0 &&
      eventManual.memberIds === undefined
    ) {
      // Nobody to put in the event, and no way to know who writes
      saveStopped();
      return;
    }
    const fields = eventFieldsOf({
      parsed: read,
      manual: eventManual,
      todayKey,
      meId: authorId,
      visibility: newEventVisibility,
    });
    const problem = validatePhrase(read);
    const errors = eventFieldErrors(fields);
    const slot = slotOfFields(fields);
    if (problem || Object.keys(errors).length > 0 || !slot) {
      savingRef.current = false;
      setSaving(false);
      failFields(problem, errors);
      return;
    }

    try {
      const created = await createEvent(supabase, {
        title: read.title,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        visibility: fields.visibility,
        memberIds: fields.memberIds,
      });
      if (created.status === "failed") throw new Error("not saved");
      announceCreated(supabase, {
        id: created.id,
        title: read.title,
        dayKey: slot.dayKey,
        startsAt: slot.startsAt,
      });
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
      whoIds,
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
  function currentValues(): ThingValues {
    // «Lo vedo solo io» has nobody but the author
    const privateNow =
      isPrivate && assigneeIds.every((value) => value === meId);
    return {
      title: thingTitle,
      dueDate: dueDate === "" ? null : dueDate,
      assigneeIds,
      forId,
      isPrivate: privateNow,
      reminders,
      note: record ? noteOf(record) : null,
    };
  }

  /** The values of a new Da fare or Scadenza, read from the phrase with these people. */
  function newValues(
    list: readonly NestPerson[],
    me: string | null,
  ): ThingValues {
    const read =
      type === "da-fare"
        ? parseTodo(phrase, todayKey, list, me)
        : parseDeadline(phrase, todayKey, list, me);
    const about =
      "forId" in read ? read.forId : "aboutId" in read ? read.aboutId : null;
    const auto: string[] = read.assigneeWritten
      ? read.assigneeId
        ? [read.assigneeId]
        : []
      : type === "scadenza" && me
        ? [me]
        : [];
    const chosen = assigneeManual ?? auto;
    return {
      title: read.title,
      dueDate: (dateManual ?? read.dueDate ?? "") || null,
      assigneeIds: chosen,
      forId: about,
      isPrivate: isPrivate && chosen.every((value) => value === me),
      reminders,
      note: null,
    };
  }

  // ----- Save: Da fare and Scadenza, new
  async function submitThing() {
    const kind: ListKind = type === "da-fare" ? "todos" : "deadlines";
    const supabase = createClient();
    let authorId = meId;
    let list: readonly NestPerson[] = people;
    if (peopleState.status === "loading" && peopleLoad.current) {
      // Names written before the people were read would be lost: wait for them.
      savingRef.current = true;
      setSaving(true);
      const loaded = await peopleLoad.current;
      if (loaded.status === "ready") {
        authorId = loaded.meId;
        list = loaded.people;
      }
    }
    const values = newValues(list, authorId);
    const problem =
      type === "da-fare"
        ? validateTodo(values.title)
        : validateDeadline(values.title);
    const dateProblem = validateThingDate({
      dueDate: values.dueDate,
      todayKey,
      required: type === "scadenza",
      checkRange: true,
    });
    if (problem || dateProblem) {
      savingRef.current = false;
      setSaving(false);
      failFields(problem, dateProblem ? { date: dateProblem } : {});
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    // The people other than the author, in the order of the group
    const others = list
      .filter((person) => person.id !== authorId)
      .filter((person) => values.assigneeIds.includes(person.id))
      .map((person) => person.name);

    const created =
      type === "da-fare"
        ? await createTodo(supabase, values)
        : await createDeadline(supabase, {
            ...values,
            dueDate: values.dueDate!,
          });
    if (created.status === "failed") {
      saveStopped();
      return;
    }
    notifyListsChanged(kind);
    const createdId = created.id;
    const onUndo = () => {
      void (async () => {
        const result =
          type === "da-fare"
            ? await deleteTodo(supabase, createdId)
            : await deleteDeadline(supabase, createdId);
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
        others.length > 0
          ? {
              text: "Dato a",
              emphasis: joinNames(others),
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
    values: ThingValues,
  ): Promise<WriteResult> {
    const supabase = createClient();
    return kind === "da-fare"
      ? updateTodo(supabase, id, values)
      : values.dueDate === null
        ? "failed"
        : updateDeadline(supabase, id, { ...values, dueDate: values.dueDate });
  }

  // ----- Save: edit of a thing of Spesa
  async function submitShoppingEdit() {
    if (!shoppingEdit) return;
    const original = shoppingEdit.record;
    const name = phrase.replace(/\s+/g, " ").trim();
    const wanted = quantity.replace(/\s+/g, " ").trim();
    const problems = validateShoppingEdit(name, wanted);
    setQuantityError(problems.quantity);
    if (problems.name || problems.quantity) {
      if (problems.name) fail(problems.name);
      else {
        setError(null);
        document.getElementById(quantityId)?.focus();
      }
      return;
    }

    const before: ShoppingValues = {
      name: original.name,
      quantity: original.quantity,
      assigneeIds: savedWho,
    };
    const values: ShoppingValues = {
      name,
      quantity: wanted === "" ? null : wanted,
      assigneeIds: whoIds,
    };
    if (
      values.name === before.name &&
      values.quantity === before.quantity &&
      sameIds(values.assigneeIds, before.assigneeIds)
    ) {
      finishSaved();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    setGoneAlert(false);
    const supabase = createClient();
    // The same name as ANOTHER thing still to buy: said before writing (the
    // database says it too, for a thing added in the meantime).
    const other =
      name === original.name
        ? null
        : await findShoppingDuplicate(supabase, original.id, name);
    const result: ShoppingWriteResult =
      typeof other === "string"
        ? { duplicate: other }
        : await updateShoppingItem(supabase, original.id, values);
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
    if (typeof result === "object") {
      savingRef.current = false;
      setSaving(false);
      fail(shoppingDuplicateText(result.duplicate));
      return;
    }

    notifyListsChanged("shopping");
    const focusTargets = opener ? [opener.primary, ...opener.fallbacks] : [];
    if (focusTargets.length > 0) {
      focusAfterSheet(waitListsRefreshed("shopping"), focusTargets);
    }
    showToast({
      text: "Modifiche salvate.",
      onUndo: () => {
        const hadFocus =
          document.activeElement?.classList.contains("toast__azione");
        void (async () => {
          const refreshed = waitListsRefreshed("shopping");
          const undone = await updateShoppingItem(
            supabase,
            original.id,
            before,
          );
          if (undone === "ok") {
            notifyListsChanged("shopping");
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

  async function submitEdit() {
    if (shoppingEdit) {
      await submitShoppingEdit();
      return;
    }
    if (!thingEdit) return;
    const original = thingEdit.record;
    const kind = thingEdit.kind;
    const values = currentValues();
    const problem =
      kind === "da-fare"
        ? validateTodo(values.title)
        : validateDeadline(values.title);
    const dateProblem = validateThingDate({
      dueDate: values.dueDate,
      todayKey,
      required: kind === "scadenza",
      checkRange: values.dueDate !== original.dueDate,
    });
    if (problem || dateProblem) {
      failFields(problem, dateProblem ? { date: dateProblem } : {});
      return;
    }

    const before: ThingValues = {
      title: original.title,
      dueDate: original.dueDate,
      assigneeIds: original.assigneeIds,
      forId: original.forId,
      isPrivate: original.isPrivate,
      reminders: "reminders" in original ? original.reminders : reminders,
      note: noteOf(original),
    };
    const unchanged =
      values.title === before.title &&
      values.dueDate === before.dueDate &&
      sameIds(values.assigneeIds, before.assigneeIds) &&
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
    const supabase = createClient();
    if (shoppingEdit) {
      const { record: gone } = shoppingEdit;
      if ((await deleteShoppingItem(supabase, gone.id)) === "failed") {
        showToast({ text: DELETE_FAILED_TEXT, icon: null });
        return false;
      }
      const refreshed = waitListsRefreshed("shopping");
      notifyListsChanged("shopping");
      if (opener && opener.fallbacks.length > 0) {
        focusAfterSheet(refreshed, opener.fallbacks);
      }
      showToast({ text: "Eliminato:", emphasis: gone.name, after: "." });
      finishSaved();
      return undefined;
    }
    if (!thingEdit) return undefined;
    const { kind, record: original } = thingEdit;
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

  let buttonLabel: string;
  if (type === "impegno") {
    buttonLabel = empty
      ? "Aggiungi"
      : formSubmitLabel(eventFields.day, todayKey);
  } else if (type === "spesa") {
    buttonLabel = shoppingSubmitLabel({
      empty,
      total: shoppingRows.length,
      fresh: freshEntries.length,
    });
  } else if (type === "da-fare") {
    buttonLabel = todoSubmitLabel({ empty, otherNames });
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
  const formOpen = draft !== null && meId !== null;
  const formButton = draft ? (
    <Button
      type="submit"
      form={moduleFormId}
      arrow
      arrowIcon="arrow-up-right"
      full={!desktop}
      loading={saving}
    >
      {formSubmitLabel(draft.values.day, todayKey)}
    </Button>
  ) : null;
  const removeLabel =
    editReady?.kind === "scadenza"
      ? "Elimina scadenza"
      : editReady?.kind === "spesa"
        ? "Elimina dalla spesa"
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
    footer = canOpenForm ? (
      <>
        <DetailsButton
          label="Tutti i dettagli"
          inactive={saving}
          onOpen={openForm}
        />
        {submitButton}
      </>
    ) : (
      submitButton
    );
  } else {
    footer = submitButton;
  }

  // ----- The part under the selector, by type: the fields are there from the start
  const forAvatar = forPerson ? (
    <Avatar name={forPerson.name} color={forPerson.color} size="xs" nameShown />
  ) : undefined;
  const showBlock = isEdit ? formShown : true;
  const dateField = (
    <DateField
      id={dateId}
      label="Data"
      value={dueDate}
      readOnly={saving}
      error={fieldErrors.date}
      onChange={(event) => changeDate(event.target.value)}
    />
  );
  const whoGroup = (
    <WhoManyGroup
      people={whoList}
      meId={meId}
      chosenIds={assigneeIds}
      onToggle={toggleAssignee}
    />
  );
  const visibilityGroup = (
    <VisibilityGroup
      isPrivate={isPrivate}
      onChange={changeVisibility}
      locked={!isAuthor}
    />
  );

  let typeBlock: ReactNode = null;
  if (showBlock && type === "spesa" && isEdit) {
    typeBlock = (
      <>
        <TextField
          id={quantityId}
          label="Quantità"
          value={quantity}
          readOnly={saving}
          error={quantityError ?? undefined}
          onChange={(event) => {
            setQuantity(event.target.value);
            setQuantityError(null);
            setSaveFailed(false);
            setGoneAlert(false);
          }}
        />
        <WhoManyGroup
          people={whoList}
          meId={meId}
          chosenIds={whoIds}
          onToggle={toggleShoppingWho}
        />
      </>
    );
  } else if (showBlock && type === "spesa") {
    typeBlock = (
      <>
        <ShoppingPreview rows={shoppingRows} />
        <WhoManyGroup
          people={whoList}
          meId={meId}
          chosenIds={whoIds}
          onToggle={toggleShoppingWho}
        />
      </>
    );
  } else if (showBlock && type === "da-fare") {
    typeBlock = (
      <>
        {forPerson ? (
          <div className="gruppo-chip" aria-live="polite">
            {isEdit ? (
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
            )}
          </div>
        ) : null}
        {dateField}
        {whoGroup}
        {visibilityGroup}
      </>
    );
  } else if (showBlock && type === "scadenza") {
    const days =
      isValidDayKey(dueDate) && dueDate.slice(0, 4) <= "2100"
        ? daysUntilDay(dueDate, now)
        : null;
    typeBlock = (
      <>
        <DeadlinePreview
          howMuch={days === null ? null : howMuch(days)}
          urgent={days !== null && isUrgent(days)}
          dayText={
            days === null ? "Manca la data" : longDayLabel(dueDate, todayKey)
          }
          title={thingTitle}
        />
        {forPerson ? (
          <div className="gruppo-chip" aria-live="polite">
            <Chip static leading={forAvatar}>
              {forPerson.name}
            </Chip>
          </div>
        ) : null}
        {dateField}
        {whoGroup}
        {visibilityGroup}
        <ReminderGroup chosen={reminders} onToggle={toggleReminder} />
      </>
    );
  }

  const kindIcon =
    editKind === "scadenza"
      ? "file-clock"
      : editKind === "spesa"
        ? "shopping-basket"
        : "square-check";

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
            {editKind === "spesa"
              ? "Nome"
              : isEdit
                ? "Titolo"
                : "Cosa vuoi aggiungere?"}
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
          <div className="contenitore-selettore">
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
          </div>
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
          <>
            <DateField
              id={eventFieldId(fieldsPrefix, "day")}
              label="Giorno"
              value={eventFields.day}
              readOnly={saving}
              error={fieldErrors.day}
              onChange={(event) =>
                changeEventFields({ day: event.target.value })
              }
            />
            <FieldPair>
              <TimeField
                id={eventFieldId(fieldsPrefix, "from")}
                label="Dalle"
                value={eventFields.from}
                readOnly={saving}
                error={fieldErrors.from}
                onChange={(event) =>
                  changeEventFields({ from: event.target.value })
                }
              />
              <TimeField
                id={eventFieldId(fieldsPrefix, "to")}
                label="Alle"
                value={eventFields.to}
                readOnly={saving}
                help={endsOtherDayHint(eventFields, 0) ?? undefined}
                error={fieldErrors.to}
                onChange={(event) =>
                  changeEventFields({ to: event.target.value })
                }
              />
            </FieldPair>
            {meId !== null ? (
              <PeopleChips
                id={eventFieldId(fieldsPrefix, "people")}
                label="Chi"
                people={meFirst(people, meId)}
                meId={meId}
                isPressed={(member) =>
                  eventFields.memberIds.includes(member.id)
                }
                onToggle={(member) => toggleEventMember(member.id)}
                disabled={false}
                error={fieldErrors.people}
              />
            ) : null}
            <EventVisibilityGroup
              id={visibilityId}
              value={eventFields.visibility}
              onChange={(value) => changeEventFields({ visibility: value })}
              text={visibilityHelp(eventFields.visibility, true, null)}
            />
          </>
        ) : null}

        {typeBlock}

        {isImpegno ? notice : null}

        {!desktop && canOpenForm ? (
          <DetailsButton
            label="Più dettagli"
            inactive={saving}
            onOpen={openForm}
          />
        ) : null}

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

  if (draft && meId !== null) {
    body = (
      <NewEventForm
        formId={moduleFormId}
        idPrefix={modulePrefix}
        members={people}
        meId={meId}
        values={draft.values}
        errors={draft.errors}
        saveFailed={saveFailed}
        onChange={changeForm}
        onSubmit={() => void submitForm()}
      />
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
        title={formOpen ? "Nuovo impegno" : isEdit ? "Modifica" : "Aggiungi"}
        info={
          formOpen ? undefined : (
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
          )
        }
        tall={formOpen}
        locked={saving || confirmOpen}
        closeRequested={closeRequested}
        onClose={handleClose}
        onBack={formOpen ? backToPhrase : undefined}
        className={saving ? "is-in-corso" : undefined}
        footerEnd={formOpen || (!isEdit && !(desktop && canOpenForm))}
        footer={formOpen ? formButton : footer}
        data-testid="aggiungi-foglio"
      >
        {body}
      </Sheet>
      <ConfirmDialog
        open={confirmOpen && editReady !== null}
        aboveSheet
        onClose={() => setConfirmOpen(false)}
        title={`Eliminare «${shoppingEdit?.record.name ?? record?.title ?? ""}»?`}
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
        errorText={DELETE_FAILED_TEXT}
        data-testid="aggiungi-elimina-dialogo"
      />
    </>
  );
}
