import type { MemberColor } from "@/components/ui/Avatar/Avatar";
import type { EventVisibility } from "@/lib/calendar";
import {
  addDaysToDayKey,
  formatDayNumber,
  fromFieldValues,
  isValidDayKey,
  toDayKey,
} from "@/lib/datetime";

/**
 * Pure logic of the event form, shared by «Modifica impegno» (#19) and the
 * full form «Nuovo impegno» of Aggiungi (#20, #171). No React, no database.
 */

export type MemberKind = "adult" | "child" | "pet";

/** A member of the Nest, as the form needs it. */
export type EventMember = {
  id: string;
  name: string;
  color: MemberColor;
  kind: MemberKind;
  /** Has an account: only these are «me» */
  userId: string | null;
};

export const TITLE_MAX_LENGTH = 100;
export const PLACE_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 500;

/** A repeated event lasts at most this many milliseconds (database rule). */
const MAX_REPEATED_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Members in Nest order, «me» first. */
export function meFirst(
  members: ReadonlyArray<EventMember>,
  meId: string,
): EventMember[] {
  return [
    ...members.filter((m) => m.id === meId),
    ...members.filter((m) => m.id !== meId),
  ];
}

/** «Si ripete»: `current` is the multi-day weekly rule the event already has. */
export type RepeatChoice = "current" | "none" | "weekly" | "monthly";

export type EventFormValues = {
  title: string;
  /** `YYYY-MM-DD` */
  day: string;
  /** `HH:MM` */
  from: string;
  /** `HH:MM` */
  to: string;
  repeat: RepeatChoice;
  place: string;
  memberIds: string[];
  escortId: string | null;
  visibility: EventVisibility;
  notes: string;
};

export type FieldKey =
  "title" | "day" | "from" | "to" | "repeat" | "people" | "escort";

/** Where the focus can be moved: a field, or the «Chi lo vede» group (no error of its own). */
export type FocusKey = FieldKey | "visibility";

export type FormErrors = Partial<Record<FieldKey, string>>;

/** Order of the fields in the form: the first wrong one gets the focus. */
export const FIELD_ORDER: ReadonlyArray<FieldKey> = [
  "title",
  "day",
  "from",
  "to",
  "repeat",
  "people",
  "escort",
];

/** Whole days between two day keys (`b - a`). */
export function dayDiff(a: string, b: string): number {
  const toMs = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

/** ISO weekday of a day key: 1 = Monday ... 7 = Sunday. */
export function isoWeekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Start and end as UTC instants from the field values. The end keeps the same
 * number of days after the start as before; if it would not be after the
 * start, it moves one day on (22:00 – 1:00 ends the next day).
 */
export function computeTimes(
  values: Pick<EventFormValues, "day" | "from" | "to">,
  offsetDays: number,
): { start: Date; end: Date } | null {
  if (!isValidDayKey(values.day) || !values.from || !values.to) return null;
  const start = fromFieldValues(values.day, values.from);
  const endDay = addDaysToDayKey(values.day, offsetDays);
  let end = fromFieldValues(endDay, values.to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) {
    end = fromFieldValues(addDaysToDayKey(endDay, 1), values.to);
  }
  return { start, end };
}

/** `Finisce mercoledì 21.` when the end falls on another day, else null. */
export function endsOtherDayHint(
  values: Pick<EventFormValues, "day" | "from" | "to">,
  offsetDays: number,
): string | null {
  if (values.from === values.to) return null;
  const times = computeTimes(values, offsetDays);
  if (!times) return null;
  const startKey = toDayKey(times.start);
  const endKey = toDayKey(times.end);
  if (startKey === endKey) return null;
  const withMonth = startKey.slice(0, 7) !== endKey.slice(0, 7);
  return `Finisce ${formatDayNumber(times.end, { capitalized: false, withMonth })}.`;
}

export const ERROR_TEXTS = {
  title: "Scrivi il titolo dell'impegno.",
  day: "Scegli il giorno.",
  from: "Scegli l'ora d'inizio.",
  to: "Scegli l'ora di fine.",
  sameTime: "L'ora di fine deve essere diversa da quella d'inizio.",
  people: "Scegli almeno una persona.",
  duration: "Un impegno che si ripete può durare al massimo 7 giorni.",
} as const;

/** Checks the fields after «Salva le modifiche». */
export function validateForm(
  values: EventFormValues,
  offsetDays: number,
): { errors: FormErrors; times: { start: Date; end: Date } | null } {
  const errors: FormErrors = {};
  if (values.title.trim() === "") errors.title = ERROR_TEXTS.title;
  if (!isValidDayKey(values.day)) errors.day = ERROR_TEXTS.day;
  if (!values.from) errors.from = ERROR_TEXTS.from;
  if (!values.to) errors.to = ERROR_TEXTS.to;
  if (values.from && values.to && values.from === values.to) {
    errors.to = ERROR_TEXTS.sameTime;
  }
  if (values.memberIds.length === 0) errors.people = ERROR_TEXTS.people;

  const times =
    errors.day || errors.from || errors.to
      ? null
      : computeTimes(values, offsetDays);
  if (
    times &&
    values.repeat !== "none" &&
    times.end.getTime() - times.start.getTime() > MAX_REPEATED_DURATION_MS
  ) {
    errors.repeat = ERROR_TEXTS.duration;
  }
  return { errors, times: errors.repeat ? null : times };
}

/** First field with an error, in the order of the form. */
export function firstErrorField(errors: FormErrors): FieldKey | null {
  return FIELD_ORDER.find((key) => errors[key] !== undefined) ?? null;
}

export type Locks = {
  /** «Chi lo vede» can be changed only by who created the event */
  visibility: boolean;
  /** «Chi» and «La porta» on a «Solo io» or «Occupato» of someone else */
  people: boolean;
};

const VISIBILITY_HELP_AUTHOR: Record<EventVisibility, string> = {
  private: "Lo vedi solo tu e chi partecipa.",
  busy: "Gli altri vedono solo che sei occupato.",
  household: "Lo vede tutto il Nest.",
};

const VISIBILITY_HELP_OTHER: Record<EventVisibility, string> = {
  private: "Lo vede solo chi l'ha creato e chi partecipa.",
  busy: "Gli altri vedono solo che c'è un impegno, senza dettagli.",
  household: "Lo vede tutto il Nest.",
};

/** The sentence under «Chi lo vede». */
export function visibilityHelp(
  visibility: EventVisibility,
  isAuthor: boolean,
  authorName: string | null,
): string {
  if (isAuthor) return VISIBILITY_HELP_AUTHOR[visibility];
  const decides = authorName
    ? `Lo decide ${authorName}, che l'ha creato.`
    : "Chi l'ha creato non è più nel Nest: resta così.";
  return `${VISIBILITY_HELP_OTHER[visibility]} ${decides}`;
}

/** The three base choices of «Si ripete»: the only ones for a new event. */
export const BASE_REPEAT_OPTIONS: ReadonlyArray<{
  value: Exclude<RepeatChoice, "current">;
  label: string;
}> = [
  { value: "none", label: "Mai" },
  { value: "weekly", label: "Ogni settimana" },
  { value: "monthly", label: "Ogni mese" },
];

/** The repetition arguments of `create_event`, left out when the event does not repeat. */
export type NewEventRepetition = {
  p_recurrence: "none" | "weekly" | "monthly";
  p_recurrence_weekdays?: number[];
};

/**
 * Turns «Si ripete» into the repetition of a new event: weekly repeats on the
 * weekday of `day` (`YYYY-MM-DD`), monthly on the same day of the month, no
 * last day. «current» only exists for events already saved: it counts as «Mai».
 */
export function newEventRepetition(
  repeat: RepeatChoice,
  day: string,
): NewEventRepetition {
  if (repeat === "weekly") {
    return {
      p_recurrence: "weekly",
      p_recurrence_weekdays: [isoWeekdayOf(day)],
    };
  }
  if (repeat === "monthly") return { p_recurrence: "monthly" };
  return { p_recurrence: "none" };
}
