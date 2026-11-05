import {
  addDaysToDayKey,
  formatDayNumber,
  formatTime,
  formatTimeRange,
  getWeekStartKey,
  toDateFieldValue,
  toDayKey,
  toTimeFieldValue,
  type Instant,
} from "@/lib/datetime";
import {
  deleteDialogText,
  formatDayInSentence,
  formatRecurrence,
  joinNames,
  saveAllText,
  saveChoiceText,
  type RecurrenceInfo,
  type SaveChange,
} from "@/lib/event-texts";
import type { EventOccurrence } from "@/lib/household-events";
import {
  BASE_REPEAT_OPTIONS,
  dayDiff,
  meFirst,
  type EventFormValues,
  type EventMember,
  type Locks,
  type RepeatChoice,
} from "@/components/evento-modulo/model";

/**
 * Pure logic of the detail page and of «Modifica impegno» (issue #19). The
 * logic of the form itself lives in `@/components/evento-modulo/model`.
 * No React, no database.
 */

/* ---------- Words ---------- */

function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase("it-IT") + text.slice(1);
}

/** `Martedì 20 ottobre`, with the year when it is not the year of `now`. */
export function formatDayHeading(dayKey: string, now: Instant): string {
  return capitalizeFirst(formatDayInSentence(dayKey, now));
}

function hourOf(value: Instant): number {
  return Number.parseInt(formatTime(value), 10);
}

/** `alle 17:00`, but `all'1:00`. */
function atTime(value: Instant): string {
  return hourOf(value) === 1
    ? `all'${formatTime(value)}`
    : `alle ${formatTime(value)}`;
}

/** `dalle 17:00`, but `dall'1:00`. */
function fromTime(value: Instant): string {
  return hourOf(value) === 1
    ? `dall'${formatTime(value)}`
    : `dalle ${formatTime(value)}`;
}

export type TimeTexts = {
  /** `17:00 – 18:30` */
  range: string;
  /** ` (martedì 20)` when it ends on another day, else null */
  endNote: string | null;
  /** For screen readers: `dalle 17:00 alle 18:30` */
  spoken: string;
};

/** The hours of an occurrence, with the day of the end when it is another one. */
export function timeTexts(startsAt: Instant, endsAt: Instant): TimeTexts {
  const range = formatTimeRange(startsAt, endsAt);
  const startKey = toDayKey(startsAt);
  const endKey = toDayKey(endsAt);
  if (startKey === endKey) {
    return {
      range,
      endNote: null,
      spoken: `${fromTime(startsAt)} ${atTime(endsAt)}`,
    };
  }
  const withMonth = startKey.slice(0, 7) !== endKey.slice(0, 7);
  const endDay = formatDayNumber(endsAt, { capitalized: false, withMonth });
  const startDay = formatDayNumber(startsAt, {
    capitalized: false,
    withMonth,
  });
  return {
    range,
    endNote: ` (${endDay})`,
    spoken: `${fromTime(startsAt)} di ${startDay} ${atTime(endsAt)} di ${endDay}`,
  };
}

function membersByIds(
  members: ReadonlyArray<EventMember>,
  ids: ReadonlyArray<string>,
): EventMember[] {
  const wanted = new Set(ids);
  return members.filter((m) => wanted.has(m.id));
}

export type PeopleTexts = {
  title: string;
  info: string;
  /** The participants in the order of the title (me first) */
  people: EventMember[];
};

/**
 * The people row of the card. Title: the participants, «Tu» first. Info: who it
 * is about and who created it.
 */
export function peopleTexts(
  occurrence: Pick<EventOccurrence, "memberIds" | "authorMemberId">,
  members: ReadonlyArray<EventMember>,
  meId: string,
): PeopleTexts {
  const people = meFirst(membersByIds(members, occurrence.memberIds), meId);
  const author = members.find((m) => m.id === occurrence.authorMemberId);
  const created =
    occurrence.authorMemberId === meId
      ? "creato da te"
      : author
        ? `creato da ${author.name}`
        : null;

  if (people.length === 0) {
    const createdBy =
      occurrence.authorMemberId === meId
        ? "Creato da te"
        : author
          ? `Creato da ${author.name}`
          : "";
    return { title: "Nessun partecipante", info: createdBy, people };
  }

  const names = people.map((m) => (m.id === meId ? "Tu" : m.name));
  const meIn = people.some((m) => m.id === meId);
  let about: string;
  if (!meIn) {
    about = `Impegno di ${joinNames(names)}`;
  } else if (people.length === 1) {
    about = "Impegno tuo";
  } else {
    const parts = names.map((name, index) =>
      index === 0 ? "tuo" : `di ${name}`,
    );
    about = `Impegno ${joinNames(parts)}`;
  }
  return {
    title: joinNames(names),
    info: created ? `${about}, ${created}` : about,
    people,
  };
}

/**
 * What stands at the right of the people row: nothing for nobody, one avatar,
 * a group of avatars (2 to 4), or a label for 5 or more.
 */
export function peopleBadge(
  people: ReadonlyArray<EventMember>,
  members: ReadonlyArray<EventMember>,
):
  | { kind: "none" }
  | { kind: "avatars"; people: ReadonlyArray<EventMember> }
  | { kind: "label"; text: string } {
  if (people.length === 0) return { kind: "none" };
  if (people.length <= 4) return { kind: "avatars", people };
  // Pets do not count for «Tutto il Nest».
  const everyone = members
    .filter((m) => m.kind !== "pet")
    .every((m) => people.some((p) => p.id === m.id));
  return {
    kind: "label",
    text: everyone ? "Tutto il Nest" : `${people.length} persone`,
  };
}

export function recurrenceInfoOf(occ: EventOccurrence): RecurrenceInfo {
  return {
    recurrence: occ.recurrence,
    weekdays: occ.recurrenceWeekdays,
    seriesDay: toDayKey(occ.seriesStartsAt),
    until: occ.recurrenceUntil,
  };
}

/** Text of the «Ripete» row, or null when the event does not repeat. */
export function repeatRowText(
  occ: EventOccurrence,
  now: Instant,
): string | null {
  if (occ.recurrence === "none") return null;
  const rule = formatRecurrence(recurrenceInfoOf(occ), now);
  if (!rule) return null;
  return occ.isModified ? `${rule}, questa volta con modifiche` : rule;
}

/** Address of Google Maps for the place (opened only when the user taps). */
export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** The calendar week (its Monday) of an occurrence, for the way back. */
export function calendarHref(startsAt: Instant): string {
  return `/calendario?settimana=${getWeekStartKey(toDayKey(startsAt))}`;
}

/** The occurrence is the first one of its series. */
export function isFirstOccurrence(occ: EventOccurrence): boolean {
  return occ.occurrenceDate <= toDayKey(occ.seriesStartsAt);
}

/** Names told by the delete dialog: everyone concerned but me and the pets. */
export function peopleToTell(
  occ: EventOccurrence,
  members: ReadonlyArray<EventMember>,
  meId: string,
): string[] {
  const ids = new Set<string>(occ.memberIds);
  if (occ.authorMemberId) ids.add(occ.authorMemberId);
  if (occ.escortMemberId) ids.add(occ.escortMemberId);
  return members
    .filter((m) => ids.has(m.id) && m.id !== meId && m.kind !== "pet")
    .map((m) => m.name);
}

export function deleteTextOf(
  occ: EventOccurrence,
  members: ReadonlyArray<EventMember>,
  meId: string,
  now: Instant,
): string {
  return deleteDialogText(
    recurrenceInfoOf(occ),
    peopleToTell(occ, members, meId),
    now,
  );
}

/* ---------- Form ---------- */

export function initialRepeat(occ: EventOccurrence): RepeatChoice {
  if (occ.recurrence === "none") return "none";
  if (occ.recurrence === "monthly") return "monthly";
  return occ.recurrenceWeekdays.length === 1 ? "weekly" : "current";
}

/** The values the form shows when it opens for an occurrence. */
export function initialValues(occ: EventOccurrence): EventFormValues {
  return {
    title: occ.title,
    day: toDateFieldValue(occ.startsAt),
    from: toTimeFieldValue(occ.startsAt),
    to: toTimeFieldValue(occ.endsAt),
    repeat: initialRepeat(occ),
    place: occ.location ?? "",
    memberIds: [...occ.memberIds],
    escortId: occ.escortMemberId,
    visibility: occ.visibility,
    notes: occ.notes ?? "",
  };
}

/** Days between the start day and the end day of an occurrence (usually 0). */
export function endDayOffset(occ: EventOccurrence): number {
  return dayDiff(toDayKey(occ.startsAt), toDayKey(occ.endsAt));
}

export function repeatOptions(
  occ: EventOccurrence,
  now: Instant,
): Array<{ value: RepeatChoice; label: string }> {
  const options: Array<{ value: RepeatChoice; label: string }> = [
    ...BASE_REPEAT_OPTIONS,
  ];
  if (initialRepeat(occ) === "current") {
    options.unshift({
      value: "current",
      label: formatRecurrence(recurrenceInfoOf(occ), now, { withUntil: false }),
    });
  }
  return options;
}

/* ---------- Who sees what, and what is locked ---------- */

/** The person sees the event already (database rule for the escort of one occurrence). */
export function seesEvent(
  occ: EventOccurrence,
  members: ReadonlyArray<EventMember>,
  memberId: string,
): boolean {
  if (occ.visibility === "household") {
    return members.some((m) => m.id === memberId && m.kind === "adult");
  }
  return (
    occ.authorMemberId === memberId ||
    occ.escortMemberId === memberId ||
    occ.memberIds.includes(memberId)
  );
}

export function locksFor(occ: EventOccurrence, meId: string): Locks {
  const isAuthor = occ.authorMemberId === meId;
  return {
    visibility: !isAuthor,
    people: occ.visibility !== "household" && !isAuthor,
  };
}

export function peopleLockedHelp(authorName: string | null): string {
  return authorName
    ? `Le persone le sceglie ${authorName}, che l'ha creato.`
    : "Chi l'ha creato non è più nel Nest: le persone restano così.";
}

/* ---------- What a save changes ---------- */

export type SaveKind =
  /** Nothing changed */
  | { kind: "none" }
  /** The event does not repeat: it is saved at once */
  | { kind: "direct" }
  /** Repeated, only details changed: «Solo questo» or «Tutti i prossimi» */
  | { kind: "choice" }
  /** Repeated, something of the series changed: only «Tutti i prossimi» */
  | {
      kind: "all";
      changes: SaveChange[];
      toNever: boolean;
      /** Name of the escort who does not see the event yet */
      escortUnseen: string | null;
    };

const norm = (text: string) => text.trim();

function sameSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Compares what the user wrote with the values of the opening (table A of the specification). */
export function classifySave(
  occ: EventOccurrence,
  initial: EventFormValues,
  current: EventFormValues,
  members: ReadonlyArray<EventMember>,
): SaveKind {
  const detailsChanged =
    norm(initial.title) !== norm(current.title) ||
    initial.day !== current.day ||
    initial.from !== current.from ||
    initial.to !== current.to ||
    norm(initial.place) !== norm(current.place) ||
    norm(initial.notes) !== norm(current.notes);
  const membersChanged = !sameSet(initial.memberIds, current.memberIds);
  const visibilityChanged = initial.visibility !== current.visibility;
  const repeatChanged = initial.repeat !== current.repeat;
  const escortChanged = initial.escortId !== current.escortId;
  const anyChange =
    detailsChanged ||
    membersChanged ||
    visibilityChanged ||
    repeatChanged ||
    escortChanged;

  if (!anyChange) return { kind: "none" };
  if (occ.recurrence === "none") return { kind: "direct" };

  const escortUnseenMember =
    escortChanged && current.escortId
      ? members.find((m) => m.id === current.escortId)
      : undefined;
  const escortUnseen =
    escortUnseenMember && !seesEvent(occ, members, escortUnseenMember.id)
      ? escortUnseenMember.name
      : null;

  const changes: SaveChange[] = [];
  if (repeatChanged) changes.push("recurrence");
  if (membersChanged) changes.push("members");
  if (visibilityChanged) changes.push("visibility");

  if (changes.length === 0 && !escortUnseen) return { kind: "choice" };
  return {
    kind: "all",
    changes,
    toNever: repeatChanged && current.repeat === "none",
    escortUnseen,
  };
}

/** The shift of the form's day from the day the occurrence starts on now. */
export function shiftOf(occ: EventOccurrence, values: { day: string }): number {
  return dayDiff(toDayKey(occ.startsAt), values.day);
}

/** Dialog with two choices: title and text. */
export function choiceDialogText(
  occ: EventOccurrence,
  values: EventFormValues,
  now: Instant,
): string {
  const shift = shiftOf(occ, values);
  const openDay = toDayKey(occ.startsAt);
  const moved = occ.isModified && openDay !== occ.occurrenceDate;
  return saveChoiceText({
    info: recurrenceInfoOf(occ),
    openDay,
    isFirst: isFirstOccurrence(occ),
    movedAloneTo: moved ? addDaysToDayKey(occ.occurrenceDate, shift) : null,
    now,
  });
}

/** Dialog with the only choice «Salva tutti i prossimi»: its text. */
export function allDialogText(
  occ: EventOccurrence,
  values: EventFormValues,
  kind: Extract<SaveKind, { kind: "all" }>,
  now: Instant,
): string {
  const newRule = values.repeat !== initialRepeat(occ);
  const fromDay = newRule
    ? values.day
    : addDaysToDayKey(occ.occurrenceDate, shiftOf(occ, values));
  return saveAllText({
    info: recurrenceInfoOf(occ),
    fromDay,
    isFirst: isFirstOccurrence(occ),
    changes: kind.changes,
    toNever: kind.toNever,
    escortUnseen: kind.escortUnseen,
    now,
  });
}

/** Error under «La porta» when the database refuses an escort who does not see the event. */
export function escortRefusedText(name: string): string {
  return `${name} non vede questo impegno: puoi scegliere ${name} in «La porta» solo con «Salva tutti i prossimi».`;
}

/** Error under «Giorno» when another occurrence of the series starts on that day. */
export function dayTakenText(dayKey: string, now: Instant): string {
  return `${formatDayHeading(dayKey, now)} c'è già un'altra volta di questo impegno: scegli un altro giorno.`;
}
