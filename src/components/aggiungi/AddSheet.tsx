"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { notifyEventsChanged } from "../../lib/events-changed";
import {
  getLensSnapshot,
  getServerLensSnapshot,
  subscribeLens,
} from "../../lib/lens";
import { formatTime, getCalendarDay, toDayKey } from "../../lib/datetime";
import {
  listHouseholdEvents,
  type ListEventsResult,
} from "../../lib/household-events";
import { createClient } from "../../lib/supabase/client";
import { Alert } from "../ui/Alert/Alert";
import { Avatar } from "../ui/Avatar/Avatar";
import { Button } from "../ui/Button/Button";
import { Chip } from "../ui/Chip/Chip";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon/Icon";
import { useIsDesktop } from "../ui/overlay";
import { Sheet } from "../ui/Sheet/Sheet";
import { Spinner } from "../ui/Spinner/Spinner";
import { useToast } from "../ui/Toast/ToastProvider";
import { AddPreview, type DayState } from "./AddPreview";
import {
  EXAMPLE_PHRASE,
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
import { parsePhrase, slotOf } from "./parse-phrase";
import { escortNotice, type NestPerson } from "./preview";

type PeopleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; people: NestPerson[]; meId: string | null };

type Client = ReturnType<typeof createClient>;

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
    return { status: "ready", people, meId: me?.id ?? null };
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

/**
 * Body of the Add sheet, type «Impegno» (issue #20, phase 1).
 * - Opened from inside the app (intercepted route): closing goes back to the
 *   page below.
 * - Opened directly (typed address, reload, link): nothing to go back to, so
 *   closing loads `/oggi` as a normal page.
 * Everything typed is read in the browser; only the saved event travels.
 */
export function AddSheet({ direct = false }: { direct?: boolean }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { showToast } = useToast();
  const lens = useSyncExternalStore(
    subscribeLens,
    getLensSnapshot,
    getServerLensSnapshot,
  );

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
  const [todayKey] = useState(() => toDayKey(new Date()));
  const [peopleState, setPeopleState] = useState<PeopleState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<Record<string, ListEventsResult>>({});

  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const peopleLoad = useRef<Promise<PeopleState> | null>(null);
  const requestedDays = useRef(new Set<string>());
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // The people of the Nest, to recognize their names.
  useEffect(() => {
    let alive = true;
    const load = loadPeople();
    peopleLoad.current = load;
    load.then((state) => {
      if (alive) setPeopleState(state);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const people = useMemo(
    () => (peopleState.status === "ready" ? peopleState.people : []),
    [peopleState],
  );
  const meId = peopleState.status === "ready" ? peopleState.meId : null;

  const parsed = useMemo(
    () => parsePhrase(phrase, todayKey, people),
    [phrase, todayKey, people],
  );
  const slot = useMemo(() => slotOf(parsed, todayKey), [parsed, todayKey]);
  const hasTitle = parsed.title !== "";
  // A title and a time: the preview and the notice can show
  const readySlot = hasTitle ? slot : null;
  const empty = phrase.trim() === "";

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
    readySlot && peopleState.status === "ready" ? readySlot.dayKey : null;
  useEffect(() => {
    if (!dayToRead || requestedDays.current.has(dayToRead)) return;
    requestedDays.current.add(dayToRead);
    const day = getCalendarDay(dayToRead);
    listHouseholdEvents(day.start, day.end).then((result) => {
      setResults((previous) => ({ ...previous, [dayToRead]: result }));
    });
  }, [dayToRead]);

  let day: DayState | null = null;
  if (readySlot) {
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
    readySlot && day?.status === "ready"
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

  function changePhrase(value: string) {
    setPhrase(value.replace(/\r\n|\r|\n/g, " "));
    setError(null);
    setSaveFailed(false);
  }

  function pickExample(text: string) {
    flushSync(() => changePhrase(text));
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(text.length, text.length);
  }

  async function submit() {
    if (savingRef.current || empty) return;
    const problem = validatePhrase(parsed);
    if (problem || !slot) {
      setError(problem);
      fieldRef.current?.focus();
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
      savedRef.current = true;
      setCloseRequested(true);
    } catch {
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
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

  // Labels under the field
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

  const buttonLabel = submitLabel(phrase, parsed, todayKey);
  const submitButton = (
    <button
      type="submit"
      form={formId}
      className={cx(
        "btn-primary btn-primary--freccia",
        !desktop && "btn--pieno",
        saving && "is-caricamento",
      )}
      disabled={empty}
      aria-busy={saving || undefined}
      aria-disabled={saving || undefined}
    >
      <span className="btn__testo">{buttonLabel}</span>
      <span className="btn__icona-box">
        {saving ? <Spinner /> : <Icon name="arrow-up-right" />}
      </span>
    </button>
  );

  const examples = (
    <button
      type="button"
      className="chip"
      onClick={() => pickExample(EXAMPLE_PHRASE)}
    >
      {EXAMPLE_PHRASE}
    </button>
  );

  const side =
    day && readySlot ? (
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

  return (
    <Sheet
      open={open}
      title="Aggiungi"
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
      locked={saving}
      closeRequested={closeRequested}
      onClose={handleClose}
      side={side}
      footer={
        desktop ? (
          <>
            {/* Keeps the button on the right: the foot spreads its children apart */}
            <span aria-hidden="true" />
            {submitButton}
          </>
        ) : (
          <>
            {submitButton}
            {empty ? (
              <div className="gruppo-chip" role="group" aria-label="Esempi">
                {examples}
              </div>
            ) : null}
          </>
        )
      }
    >
      <form id={formId} className="modulo-membro" onSubmit={onSubmit}>
        <div className={cx("campo", error && "campo--errore")}>
          <label className="visivamente-nascosto" htmlFor={fieldId}>
            Cosa vuoi aggiungere?
          </label>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className="campo-frase"
            rows={2}
            placeholder="Cosa c'è da fare?"
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

        <div
          className="selettore selettore--carta"
          role="group"
          aria-label="Tipo"
        >
          <button type="button" className="selettore__voce" aria-pressed="true">
            <Icon name="calendar" size="s" />
            Impegno
          </button>
        </div>

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

        {desktop && hasTitle ? (
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

        {desktop ? null : notice}

        {saveFailed ? <Alert variant="errore">{SAVE_FAILED_TEXT}</Alert> : null}
      </form>
    </Sheet>
  );
}
